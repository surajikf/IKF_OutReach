import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const { serviceName, category, description } = body;

        if (!serviceName) {
            return NextResponse.json({ error: "Service name is required." }, { status: 400 });
        }

        const updatedService = await prisma.service.update({
            where: { id },
            data: {
                serviceName,
                category,
                description,
            },
        });

        return NextResponse.json(updatedService);
    } catch (error: any) {
        console.error(`[ERROR] Failed to update service ${id}:`, error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "A service with this name already exists." }, { status: 400 });
        }
        return NextResponse.json({
            error: "Internal Server Error",
            message: error.message
        }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        await prisma.service.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`[ERROR] Failed to delete service ${id}:`, error);
        return NextResponse.json({
            error: "Internal Server Error",
            message: error.message
        }, { status: 500 });
    }
}
