import { NextRequest } from "next/server";
import { z } from "zod";
import { sendStrategicEmail } from "@/services/mail";
import { wrapInEmailTemplate } from "@/lib/shared/email-template";
import { ok, error } from "@/services/api-response";
import { normalizeEmailBodyHtml } from "@/lib/shared/email-format";
import { sanitizeEmailHtml } from "@/lib/shared/email-sanitize";
import { getBackendSession } from "@/services/auth";
import prisma from "@/lib/prisma";

const testSendSchema = z.object({
    email: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getBackendSession(request);
        if (!session?.user?.email) {
            return error("UNAUTHORIZED", "Active session required.", { status: 401 });
        }

        const body = await request.json();
        const parser = testSendSchema.safeParse(body);

        if (!parser.success) {
            return error("BAD_REQUEST", "Invalid email data provided.");
        }

        const { email, subject, body: html } = parser.data;
        const safeHtml = sanitizeEmailHtml(normalizeEmailBodyHtml(html));

        // Prefer dispatching from the currently signed-in Gmail identity to avoid stale default-account tokens.
        const sessionEmail = session.user.email;
        const preferredGmailAccount = await prisma.gmailAccount.findFirst({
            where: { email: sessionEmail, userId: session.user.id as string },
            select: { id: true, scopeGranted: true },
        });

        const result = await sendStrategicEmail({
            to: email,
            subject: `[TEST] ${subject}`,
            html: wrapInEmailTemplate("standard", safeHtml, "Valued Partner"),
            text: "This is a test email from IKF Outreach Campaign Builder. Please view it in an HTML-compatible client."
        }, {
            forceProvider: "GMAIL",
            disableFailover: true,
            overrideGmailAccountId: preferredGmailAccount?.id,
            userId: session.user.id as string,
        });

        if (result.success) {
            // Auto-repair scopeGranted if it was previously incorrect
            if (preferredGmailAccount && !preferredGmailAccount.scopeGranted) {
                await prisma.gmailAccount.update({
                    where: { id: preferredGmailAccount.id },
                    data: { scopeGranted: true, lastStatus: "HEALTHY" },
                }).catch(() => {});
            }
            return ok({ message: "Test email sent successfully." });
        } else {
            console.error("[TEST-SEND] Failed:", {
                sessionEmail,
                preferredAccountId: preferredGmailAccount?.id,
                error: result.error
            });
            return error("BAD_REQUEST", result.error || "Failed to send test email.", {
                status: 400,
                details: result.error,
            });
        }
    } catch (err) {
        console.error("Test send API error:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}

