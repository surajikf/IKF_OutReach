import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeEmailBodyHtml } from "@/lib/shared/email-format";
import { sanitizeEmailHtml } from "@/lib/shared/email-sanitize";
import { getBackendSession } from "@/services/auth";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getBackendSession(request);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = session.user.id;
        const isAdmin = (session.user as any)?.role === "ADMIN";

        const body = await request.json();
        const { subject, body: emailBody } = body;

        const original = await prisma.campaignHistory.findUnique({ where: { id } });

        if (!original) {
            return NextResponse.json({ error: "Campaign record not found." }, { status: 404 });
        }

        // Enforce ownership — non-admins can only edit their own campaigns
        if (!isAdmin && original.userId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const currentOutput = JSON.parse(original.generatedOutput);
        const nextBody = emailBody ? sanitizeEmailHtml(normalizeEmailBodyHtml(emailBody)) : undefined;
        const updatedOutput = JSON.stringify({
            ...currentOutput,
            subject: subject || currentOutput.subject,
            body: nextBody || currentOutput.body,
        });

        const updated = await prisma.campaignHistory.update({
            where: { id },
            data: { generatedOutput: updatedOutput },
            include: { client: true },
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Failed to update campaign:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
