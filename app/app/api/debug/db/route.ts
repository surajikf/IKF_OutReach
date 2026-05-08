import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { PRIMARY_ADMIN_EMAIL } from "@/backend/lib/auth-primary";

export async function GET() {
    try {
        // 1. Test basic connection
        const userCount = await prisma.user.count();

        // 2. Check for the primary admin user specifically
        const adminUser = await prisma.user.findUnique({
            where: { email: PRIMARY_ADMIN_EMAIL },
        });

        return NextResponse.json({
            status: "connected",
            database: "reachable",
            userCount,
            adminFound: !!adminUser,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("[DEBUG-DB] Connection failed:", error);
        return NextResponse.json({
            status: "error",
            message: error.message,
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
