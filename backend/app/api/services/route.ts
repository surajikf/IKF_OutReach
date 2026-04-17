import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";

export async function GET() {
    try {
        console.time("fetchServicesAPI");
        const services = await prisma.service.findMany({
            orderBy: {
                serviceName: "asc",
            },
        });
        console.timeEnd("fetchServicesAPI");
        return ok(services);
    } catch (err) {
        console.error("Failed to fetch services:", err);
        return error("INTERNAL_ERROR", "Failed to fetch services");
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { serviceName, category, description } = body;

        if (!serviceName) {
            return error("BAD_REQUEST", "Service name is required.");
        }

        const newService = await prisma.service.create({
            data: {
                serviceName,
                category,
                description,
            },
        });

        return ok(newService);
    } catch (err: any) {
        if (err.code === 'P2002') {
            return error("CONFLICT", "A service with this name already exists in the matrix.");
        }
        console.error("Failed to create service:", err);
        return error("INTERNAL_ERROR", "Failed to create service");
    }
}
