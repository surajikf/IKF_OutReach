import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";
import { isAdmin } from "@/backend/lib/auth";
import type { UserRole, UserStatus } from "@prisma/client";

export async function GET(req: Request) {
    try {
        if (!await isAdmin(req)) {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                canAccessInvoiceData: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return Response.json(users);
    } catch (err: any) {
        console.error("Admin Users GET Error:", err);
        return error("INTERNAL_ERROR", "Failed to fetch users from database.");
    }
}

export async function PUT(req: Request) {
    try {
        if (!await isAdmin(req)) {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const { userId, action } = await req.json();

        if (!userId || !action) {
            return error("BAD_REQUEST", "UserId and action are required.");
        }

        const target = await prisma.user.findUnique({ where: { id: userId } });
        if (!target) {
            return error("NOT_FOUND", "User not found in database.");
        }

        // Primary admin protection
        if (target.email === "suraj.sonnar@ikf.co.in" && (action === "BAN" || action === "REVOKE_ADMIN")) {
            return error("BAD_REQUEST", "Cannot revoke or ban the primary administrator.");
        }

        let updateData: any = {};

        switch (action) {
            case "APPROVE":
                updateData.status = "APPROVED";
                break;
            case "BAN":
                updateData.status = "BANNED";
                break;
            case "UNBAN":
                updateData.status = "APPROVED";
                break;
            case "MAKE_ADMIN":
                updateData.role = "ADMIN";
                updateData.canAccessInvoiceData = true;
                break;
            case "REVOKE_ADMIN":
                updateData.role = "USER";
                break;
            case "GRANT_INVOICE_ACCESS":
                updateData.canAccessInvoiceData = true;
                break;
            case "REVOKE_INVOICE_ACCESS":
                if (target.email === "suraj.sonnar@ikf.co.in") {
                    return error("BAD_REQUEST", "Cannot revoke invoice access from the primary administrator.");
                }
                updateData.canAccessInvoiceData = false;
                break;
            case "DELETE_USER":
                await prisma.user.delete({ where: { id: userId } });
                return ok({ deleted: true });
            default:
                return error("BAD_REQUEST", "Invalid action.");
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        return ok({ updated: true, user: updated });
    } catch (err: any) {
        console.error("Admin Users PUT Error:", err);
        return error("INTERNAL_ERROR", "Failed to update user.");
    }
}
