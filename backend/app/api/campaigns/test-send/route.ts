import { NextRequest } from "next/server";
import { z } from "zod";
import { sendStrategicEmail } from "@/backend/lib/mail";
import { wrapInEmailTemplate } from "@/shared/lib/email-template";
import { ok, error } from "@/backend/lib/api-response";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { sanitizeEmailHtml } from "@/shared/lib/email-sanitize";

const testSendSchema = z.object({
    email: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parser = testSendSchema.safeParse(body);

        if (!parser.success) {
            return error("BAD_REQUEST", "Invalid email data provided.");
        }

        const { email, subject, body: html } = parser.data;
        const safeHtml = sanitizeEmailHtml(normalizeEmailBodyHtml(html));

        const result = await sendStrategicEmail({
            to: email,
            subject: `[TEST] ${subject}`,
            html: wrapInEmailTemplate("standard", safeHtml, "Valued Partner"),
            text: "This is a test email from IKF Outreach Campaign Builder. Please view it in an HTML-compatible client."
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
