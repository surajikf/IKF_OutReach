import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { getBackendSession, isAdmin } from "@/services/auth";
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
                onboardingSkippedSteps: true,
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
        const session = await getBackendSession(req);
        if (!session || session.user.role !== "ADMIN") {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const { userId, action } = await req.json();

        if (!userId || !action) {
            return error("BAD_REQUEST", "UserId and action are required.");
        }

        const target = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                canAccessInvoiceData: true,
                onboardingSkippedSteps: true,
            },
        });

        if (!target) {
            return error("NOT_FOUND", "User not found in database.");
        }

        const actorId = session.user.id;
        const targetEmail = (target.email || "").toLowerCase();
        const isSelf = actorId === target.id;
        const isPrimaryAdmin = targetEmail === "suraj.sonnar@ikf.co.in";

        if (isPrimaryAdmin && (action === "BAN" || action === "REVOKE_ADMIN" || action === "DELETE_USER")) {
            return error("BAD_REQUEST", "Cannot revoke, demote, or delete the primary administrator.");
        }

        if (isSelf && (action === "BAN" || action === "REVOKE_ADMIN" || action === "DELETE_USER")) {
            return error("BAD_REQUEST", "You cannot apply this action to your own account.");
        }

        const approvedAdminCount = await prisma.user.count({
            where: { role: "ADMIN", status: "APPROVED" },
        });

        const targetIsApprovedAdmin = target.role === "ADMIN" && target.status === "APPROVED";
        const removingLastApprovedAdmin =
            targetIsApprovedAdmin &&
            approvedAdminCount <= 1 &&
            (action === "BAN" || action === "REVOKE_ADMIN" || action === "DELETE_USER");

        if (removingLastApprovedAdmin) {
            return error("BAD_REQUEST", "Cannot remove the last approved administrator.");
        }

        let updateData: any = {};

        switch (action) {
            case "APPROVE":
                if (target.status === "APPROVED") return ok({ updated: false, user: target });
                updateData.status = "APPROVED" as UserStatus;
                break;
            case "BAN":
                if (target.status === "BANNED") return ok({ updated: false, user: target });
                updateData.status = "BANNED" as UserStatus;
                break;
            case "UNBAN":
                if (target.status !== "BANNED") return error("BAD_REQUEST", "Only banned users can be unbanned.");
                updateData.status = "APPROVED" as UserStatus;
                break;
            case "MAKE_ADMIN":
                if (target.status !== "APPROVED") {
                    return error("BAD_REQUEST", "Only approved users can be promoted to admin.");
                }
                updateData.role = "ADMIN" as UserRole;
                break;
            case "REVOKE_ADMIN":
                if (target.role !== "ADMIN") return ok({ updated: false, user: target });
                updateData.role = "USER" as UserRole;
                break;
            case "GRANT_INVOICE_ACCESS": {
                const skipped = target.onboardingSkippedSteps || [];
                const hasStaleRequest = skipped.includes("invoice_access_requested");
                if (target.canAccessInvoiceData && !hasStaleRequest) return ok({ updated: false, user: target });
                updateData.canAccessInvoiceData = true;
                updateData.onboardingSkippedSteps = {
                    set: skipped.filter((s) => s !== "invoice_access_requested"),
                };
                break;
            }
            case "REVOKE_INVOICE_ACCESS":
                if (isPrimaryAdmin || target.role === "ADMIN") {
                    return error("BAD_REQUEST", "Cannot revoke invoice access from an administrator.");
                }
                if (!target.canAccessInvoiceData) return ok({ updated: false, user: target });
                updateData.canAccessInvoiceData = false;
                break;
            case "CLEAR_INVOICE_REQUEST":
                updateData.onboardingSkippedSteps = {
                    set: (target.onboardingSkippedSteps || []).filter((s) => s !== "invoice_access_requested"),
                };
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
