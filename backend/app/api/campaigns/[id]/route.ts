import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { sanitizeEmailHtml } from "@/shared/lib/email-sanitize";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const body = await request.json();
        const { subject, body: emailBody } = body;

        // Fetch original record to merge output
        const original = await prisma.campaignHistory.findUnique({
            where: { id }
        });

        if (!original) {
            return NextResponse.json({ error: "Campaign record not found." }, { status: 404 });
        }

        const currentOutput = JSON.parse(original.generatedOutput);
        const nextBody = emailBody ? sanitizeEmailHtml(normalizeEmailBodyHtml(emailBody)) : undefined;
        const updatedOutput = JSON.stringify({
            ...currentOutput,
            subject: subject || currentOutput.subject,
            body: nextBody || currentOutput.body
        });

        const updated = await prisma.campaignHistory.update({
            where: { id },
            data: { generatedOutput: updatedOutput },
            include: { client: true }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Failed to update campaign:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
