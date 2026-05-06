import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";

export async function GET() {
    try {
        const [totalClients, integrationConfig] = await Promise.all([
            prisma.client.count(),
            prisma.globalSettings.findUnique({
                where: { id: "singleton" },
                select: {
                    zohoRefreshTokenEncrypted: true,
                    googleRefreshTokenEncrypted: true
                }
            })
        ]);

        const totalAccounts = await prisma.gmailAccount.count();
        const integrationReady = !!(integrationConfig?.zohoRefreshTokenEncrypted || integrationConfig?.googleRefreshTokenEncrypted || totalAccounts > 0);

        return NextResponse.json({
            totalClients,
            integrationReady
        });
    } catch (error) {
        console.error("Failed to fetch sidebar stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
