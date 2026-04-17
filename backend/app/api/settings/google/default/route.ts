import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";

export async function POST(request: Request) {
    try {
        const { accountId } = await request.json();
        if (!accountId) return error("VALIDATION_ERROR", "Account ID required");

        try {
            // Priority 1: Try Prisma Client (Standard)
            await (prisma as any).gmailAccount.updateMany({
                data: { isDefault: false }
            });
            const updated = await (prisma as any).gmailAccount.update({
                where: { id: accountId },
                data: { isDefault: true }
            });
            return ok({ message: "Default synchronization node updated via client.", account: updated });
        } catch (clientErr) {
            console.warn("Prisma client model missing. Falling back to direct SQL transmission.");
            // Priority 2: Direct SQL Fallback (Bypass Client Lock)
            try {
                await prisma.$executeRawUnsafe(`UPDATE "GmailAccount" SET "isDefault" = false`);
                await prisma.$executeRawUnsafe(`UPDATE "GmailAccount" SET "isDefault" = true WHERE id = '${accountId}'`);
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
