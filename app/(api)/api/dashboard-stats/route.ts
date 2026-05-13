import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBackendSession } from "@/services/auth";

export async function GET(request: Request) {
    try {
        const session = await getBackendSession(request);
        const userId = session?.user?.id;
        const isAdmin = session?.user?.role === "ADMIN";
        const scopedWhere = isAdmin ? {} : { userId: userId ?? "__none__" };

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

