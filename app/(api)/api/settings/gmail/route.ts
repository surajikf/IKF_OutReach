import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { getBackendSession } from "@/services/auth";

export async function GET(request: Request) {
    try {
        const session = await getBackendSession(request);
        if (!session?.user?.id) {
            return error("UNAUTHORIZED", "Sign in required.", { status: 401 });
        }

        const [accounts, clientCounts, roleBasedCounts] = await Promise.all([
            prisma.gmailAccount.findMany({
                where: { userId: session.user.id },
                select: {
                    id: true,
                    accountName: true,
                    email: true,
                    updatedAt: true,
                    scopeGranted: true,
                    lastStatus: true,
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma.client.groupBy({
                by: ['gmailSourceAccount'],
                _count: { _all: true },
                where: { source: 'GMAIL', userId: session.user.id }
            }),
            prisma.client.groupBy({
                by: ['gmailSourceAccount', 'isRoleBased'],
                _count: { _all: true },
                where: { source: 'GMAIL', userId: session.user.id }
            }),
        ]);

        const accountList = accounts.map((acc: any) => {
            const emailLower = acc.email?.toLowerCase();
            const countObj = clientCounts.find(c =>
                (c.gmailSourceAccount as string)?.toLowerCase() === emailLower
            );
            const total = countObj ? countObj._count._all : 0;
            const roleRows = roleBasedCounts.filter(c =>
                (c.gmailSourceAccount as string)?.toLowerCase() === emailLower
            );
            const generic = roleRows.find(r => !r.isRoleBased)?._count._all ?? 0;
            const roleBased = roleRows.find(r => r.isRoleBased)?._count._all ?? 0;
            return { ...acc, count: total, generic, roleBased };
        });

        return ok({ accounts: accountList });
    } catch (err) {
        console.error("Failed to fetch Gmail accounts:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getBackendSession(request);
        if (!session?.user?.id) {
            return error("UNAUTHORIZED", "Sign in required.", { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return error("VALIDATION_ERROR", "ID required", { status: 400 });
        }

        const account = await prisma.gmailAccount.findUnique({ where: { id } });
        if (!account || account.userId !== session.user.id) {
            return error("FORBIDDEN", "Access denied for this account.", { status: 403 });
        }

        await prisma.gmailAccount.delete({ where: { id: account.id } });
        return ok({ deletedId: id });
    } catch (err) {
        console.error("Failed to delete Gmail account:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}

