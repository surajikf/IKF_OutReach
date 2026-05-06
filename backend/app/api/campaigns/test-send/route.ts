import { NextRequest } from "next/server";
import { z } from "zod";
import { sendStrategicEmail } from "@/backend/lib/mail";
import { wrapInEmailTemplate } from "@/shared/lib/email-template";
import { ok, error } from "@/backend/lib/api-response";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { sanitizeEmailHtml } from "@/shared/lib/email-sanitize";
import { getBackendSession } from "@/backend/lib/auth";
import prisma from "@/backend/lib/prisma";

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
        const preferredGmailAccount = await prisma.gmailAccount.findUnique({
            where: { email: sessionEmail },
            select: { id: true, scopeGranted: true },
        });

        if (preferredGmailAccount && !preferredGmailAccount.scopeGranted) {
            return error(
                "BAD_REQUEST",
                "Connected Gmail account is missing SMTP OAuth scope. Reconnect Gmail and grant consent again.",
                { status: 400 }
            );
        }

        const result = await sendStrategicEmail({
            to: email,
            subject: `[TEST] ${subject}`,
            html: wrapInEmailTemplate("standard", safeHtml, "Valued Partner"),
            text: "This is a test email from IKF Outreach Campaign Builder. Please view it in an HTML-compatible client."
        }, {
            forceProvider: "GMAIL",
            disableFailover: true,
            overrideGmailAccountId: preferredGmailAccount?.id,
        });

        if (result.success) {
            return ok({ message: "Test email sent successfully." });
        } else {
            return error("BAD_REQUEST", result.error || "Failed to send test email.", {
                status: 400
            });
        }
    } catch (err) {
        console.error("Test send API error:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}
