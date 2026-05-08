import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";

const clientUpdateSchema = z.object({
    clientName: z.string().min(1, "Client name is required"),
    contactPerson: z.string().optional(),
    email: z.string()
        .min(1, "Valid email is required")
        .refine(
            (val) => val.split(',').every(e => z.string().email().safeParse(e.trim()).success),
            { message: "One or more email addresses are invalid" }
        ),
    industry: z.string().optional(),
    relationshipLevel: z.string().optional(),
    serviceIds: z.array(z.string()).default([]),
});

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    try {
        const json = await request.json();
        const parsed = clientUpdateSchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Invalid client payload", {
                status: 400,
                details: parsed.error.flatten(),
            });
        }

        const body = parsed.data;

        const updatedClient = await prisma.client.update({
            where: { id },
            data: {
                clientName: body.clientName,
                contactPerson: body.contactPerson,
                email: body.email,
                industry: body.industry,
                relationshipLevel: body.relationshipLevel,
                services: {
                    set: body.serviceIds?.map((sid: string) => ({ id: sid })) || [],
                },
            },
        });

        return ok(updatedClient);
    } catch (err: any) {
        console.error(`[ERROR] Failed to update client ${id}:`, err);

        if (err.code === "P2002") {
            return error("CONFLICT", "Another company is already using this email ID.", {
                status: 400,
            });
        }

        return error("INTERNAL_ERROR", "Internal Server Error", {
            details: { message: err.message, code: err.code },
        });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    try {
        await prisma.client.delete({
            where: { id },
        });
        return ok({ deletedId: id });
    } catch (err: any) {
        console.error(`[ERROR] Failed to delete client ${id}:`, err);
        return error("INTERNAL_ERROR", "Internal Server Error", {
            details: { message: err.message },
        });
    }
}
