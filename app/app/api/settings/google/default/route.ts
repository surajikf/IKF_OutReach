import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";
import { getBackendSession } from "@/backend/lib/auth";

export async function POST(request: Request) {
    try {
        const session = await getBackendSession(request);
        if (!session?.user?.id) {
            return error("UNAUTHORIZED", "Sign in required.", { status: 401 });
        }

        const { accountId } = await request.json();
        if (!accountId) return error("VALIDATION_ERROR", "Account ID required");

        const account = await (prisma as any).gmailAccount.findFirst({
            where: { id: accountId, userId: session.user.id },
            select: { id: true },
        });
        if (!account) {
            return error("FORBIDDEN", "Access denied for this account.", { status: 403 });
        }

        try {
            // Priority 1: Try Prisma Client (Standard)
            await (prisma as any).gmailAccount.updateMany({
                where: { userId: session.user.id },
                data: { isDefault: false }
            });
            const updated = await (prisma as any).gmailAccount.update({
                where: { id: account.id },
                data: { isDefault: true }
            });
            return ok({ message: "Default synchronization node updated via client.", account: updated });
        } catch (clientErr) {
            console.warn("Prisma client model missing. Falling back to direct SQL transmission.");
            // Priority 2: Direct SQL Fallback (Bypass Client Lock)
            try {
                await prisma.$executeRawUnsafe(`UPDATE "GmailAccount" SET "isDefault" = false WHERE "userId" = $1`, session.user.id);
                await prisma.$executeRawUnsafe(`UPDATE "GmailAccount" SET "isDefault" = true WHERE id = $1 AND "userId" = $2`, account.id, session.user.id);
                return ok({ message: "Default node reconfigured via direct SQL override." });
            } catch (sqlErr: any) {
                console.error("SQL override failed:", sqlErr);
                throw sqlErr;
            }
        }

        return ok({ message: "Default node reconfiguration command completed." });
    } catch (err: any) {
        console.error("Failed to update default account:", err);
        return error("INTERNAL_ERROR", "Failed to switch default transition node.");
    }
}
