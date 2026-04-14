import prisma from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPrimaryAdminEmail, PRIMARY_ADMIN_EMAIL } from "@/lib/auth-primary";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import type { UserRole, UserStatus } from "@prisma/client";

function mapRole(v: unknown): UserRole {
    return v === "ADMIN" ? "ADMIN" : "USER";
}

function mapStatus(v: unknown): UserStatus {
    if (v === "BANNED" || v === "APPROVED") return v;
    return "APPROVED";
}

function authUserToRow(u: SupabaseAuthUser) {
    const meta = u.user_metadata || {};
    return {
        id: u.id,
        name: (meta.full_name as string) || (meta.name as string) || null,
        email: u.email || "",
        role: mapRole(meta.role),
        status: mapStatus(meta.status),
        createdAt: u.created_at,
    };
}

async function listAllAuthUsers() {
    const admin = createSupabaseAdminClient();
    const all: SupabaseAuthUser[] = [];
    let page = 1;
    const perPage = 200;
    for (;;) {
        const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage });
        if (listError) throw listError;
        all.push(...data.users);
        if (data.users.length < perPage) break;
        page += 1;
    }
    return all;
}

async function syncPrismaFromAuthUser(u: SupabaseAuthUser) {
    const row = authUserToRow(u);
    if (!row.email) return;
    await prisma.user.upsert({
        where: { id: u.id },
        create: {
            id: u.id,
            email: row.email,
            name: row.name,
            role: row.role,
            status: row.status,
        },
        update: {
            email: row.email,
            name: row.name,
            role: row.role,
            status: row.status,
        },
    });
}

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user || user.user_metadata?.role !== "ADMIN") {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const all = await listAllAuthUsers();
        const rows = all.map((u) => authUserToRow(u)).sort((a, b) => {
            const ta = new Date(a.createdAt).getTime();
            const tb = new Date(b.createdAt).getTime();
            return tb - ta;
        });

        return Response.json(rows);
    } catch (err: any) {
        console.error("Admin Users GET Error:", err);
        const msg = err?.message?.includes("SUPABASE_SERVICE_ROLE_KEY")
            ? "Server missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env for Supabase Auth admin listing."
            : "Failed to fetch users from Supabase Auth.";
        return error("INTERNAL_ERROR", msg);
    }
}

export async function PUT(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user || user.user_metadata?.role !== "ADMIN") {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const { userId, action } = await req.json();

        if (!userId || !action) {
            return error("BAD_REQUEST", "UserId and action are required.");
        }

        const admin = createSupabaseAdminClient();
        const { data: targetData, error: getErr } = await admin.auth.admin.getUserById(userId);
        if (getErr || !targetData.user) {
            return error("NOT_FOUND", "User not found in Supabase Auth.");
        }

        const target = targetData.user;
        if (isPrimaryAdminEmail(target.email) && (action === "BAN" || action === "DELETE_USER")) {
            return error("BAD_REQUEST", "Cannot revoke or delete the primary administrator account.");
        }

        if (action === "DELETE_USER") {
            const { error: delErr } = await admin.auth.admin.deleteUser(userId);
            if (delErr) {
                console.error(delErr);
                return error("INTERNAL_ERROR", "Failed to delete user in Supabase Auth.");
            }
            try {
                await prisma.user.delete({ where: { id: userId } });
            } catch {
                // Row may not exist in Prisma
            }
            return ok({ deleted: true });
        }

        const meta = { ...(target.user_metadata || {}) };

        switch (action) {
            case "APPROVE":
                meta.status = "APPROVED";
                break;
            case "BAN":
                meta.status = "BANNED";
                break;
            case "MAKE_ADMIN":
                meta.role = "ADMIN";
                break;
            case "REVOKE_ADMIN":
                meta.role = "USER";
                break;
            default:
                return error("BAD_REQUEST", "Invalid action.");
        }

        const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(userId, {
            user_metadata: meta,
        });
        if (updErr || !updated.user) {
            console.error(updErr);
            return error("INTERNAL_ERROR", "Failed to update user in Supabase Auth.");
        }

        await syncPrismaFromAuthUser(updated.user);

        return ok({ updated: true });
    } catch (err) {
        console.error("Admin Users PUT Error:", err);
        return error("INTERNAL_ERROR", "Failed to update user.");
    }
}

/**
 * Purge every Supabase Auth user except the primary admin email, and remove matching Prisma rows.
 */
export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user || user.user_metadata?.role !== "ADMIN") {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        if (body.action !== "PURGE_ALL_EXCEPT_PRIMARY") {
            return error("BAD_REQUEST", "Unsupported action.");
        }

        const admin = createSupabaseAdminClient();
        const all = await listAllAuthUsers();
        const primaryLower = PRIMARY_ADMIN_EMAIL.toLowerCase();

        let deletedAuth = 0;
        for (const u of all) {
            const email = (u.email || "").toLowerCase();
            if (email === primaryLower) continue;
            const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
            if (delErr) {
                console.error("[PURGE] deleteUser failed:", u.id, delErr);
            } else {
                deletedAuth += 1;
            }
        }

        const prismaUsers = await prisma.user.findMany({ select: { id: true, email: true } });
        let deletedPrisma = 0;
        for (const row of prismaUsers) {
            if (row.email.toLowerCase() === primaryLower) continue;
            try {
                await prisma.user.delete({ where: { id: row.id } });
                deletedPrisma += 1;
            } catch (e) {
                console.error("[PURGE] prisma delete failed:", row.id, e);
            }
        }

        const primaryAuth = all.find((u) => (u.email || "").toLowerCase() === primaryLower);
        if (primaryAuth) {
            const meta = {
                ...(primaryAuth.user_metadata || {}),
                full_name: (primaryAuth.user_metadata?.full_name as string) || "Suraj Sonnar",
                role: "ADMIN",
                status: "APPROVED",
            };
            const { data: fixed } = await admin.auth.admin.updateUserById(primaryAuth.id, {
                user_metadata: meta,
            });
            if (fixed?.user) await syncPrismaFromAuthUser(fixed.user);
        }

        return ok({
            deletedAuthUsers: deletedAuth,
            deletedPrismaUsers: deletedPrisma,
            primaryEmail: PRIMARY_ADMIN_EMAIL,
        });
    } catch (err: any) {
        console.error("Admin Users POST Error:", err);
        const msg = err?.message?.includes("SUPABASE_SERVICE_ROLE_KEY")
            ? "Server missing SUPABASE_SERVICE_ROLE_KEY."
            : "Purge failed.";
        return error("INTERNAL_ERROR", msg);
    }
}
