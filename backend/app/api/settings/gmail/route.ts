import prisma from "@/backend/lib/prisma";
import { encrypt } from "@/backend/lib/encryption";
import { ok, error } from "@/backend/lib/api-response";

export async function GET() {
    try {
        const [accounts, clientCounts] = await Promise.all([
            prisma.gmailAccount.findMany({
                select: {
                    id: true,
                    accountName: true,
                    email: true,
                    updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
            }),
            prisma.client.groupBy({
                by: ['gmailSourceAccount'],
                _count: { _all: true },
                where: { source: 'GMAIL' }
            })
        ]);

        const accountList = accounts.map((acc: any) => {
            const countObj = clientCounts.find(c => 
                (c.gmailSourceAccount as string)?.toLowerCase() === acc.email?.toLowerCase()
            );
            return {
                ...acc,
                count: countObj ? countObj._count._all : 0
            };
        });

        return ok({ accounts: accountList });
    } catch (err) {
        console.error("Failed to fetch Gmail accounts:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return error("VALIDATION_ERROR", "ID required", { status: 400 });
        }

        await prisma.gmailAccount.delete({ where: { id } });
        return ok({ deletedId: id });
    } catch (err) {
        console.error("Failed to delete Gmail account:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}
