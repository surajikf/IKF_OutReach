import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBackendSession, hasInvoiceAccess } from "@/services/auth";

export async function GET(request: Request) {
    try {
        const session = await getBackendSession(request);
        const userId = session?.user?.id;
        const isAdmin = session?.user?.role === "ADMIN";
        const canUseInvoice = await hasInvoiceAccess(request);

        // Match the same scoping logic used in listClients:
        // - Admin: see everything
        // - User with invoice access: see their own records OR any invoice record
        // - Regular user: see only their own records
        const scopedWhere = isAdmin
            ? {}
            : canUseInvoice && userId
            ? { OR: [{ userId }, { source: "INVOICE_SYSTEM" as const }] }
            : { userId: userId ?? "__none__" };

        const [totalClients, integrationConfig] = await Promise.all([
            prisma.client.count({ where: scopedWhere }),
            prisma.globalSettings.findUnique({
                where: { id: "singleton" },
                select: {
                    googleRefreshTokenEncrypted: true
                }
            })
        ]);

        const [totalAccounts, zohoConnected] = await Promise.all([
            prisma.gmailAccount.count(userId ? { where: { userId } } : undefined),
            userId
                ? prisma.zohoConnection.count({ where: { userId } })
                : Promise.resolve(0),
        ]);
        const integrationReady = isAdmin
            ? !!(zohoConnected > 0 || integrationConfig?.googleRefreshTokenEncrypted || totalAccounts > 0)
            : !!(zohoConnected > 0 || totalAccounts > 0);

        return NextResponse.json({
            totalClients,
            integrationReady
        });
    } catch (error) {
        console.error("Failed to fetch sidebar stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

