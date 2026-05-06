import prisma from "@/backend/lib/prisma";
import { sendStrategicEmail } from "@/backend/lib/mail";
import { wrapInEmailTemplate } from "@/shared/lib/email-template";
import { ok, error } from "@/backend/lib/api-response";
import { replaceVariables } from "@/shared/lib/utils";
import { z } from "zod";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { sanitizeEmailHtml } from "@/shared/lib/email-sanitize";
import { parseCampaignGeneratedOutput } from "@/shared/lib/campaign-output";

const dispatchSchema = z.object({
    campaignId: z.string().min(1, "Campaign ID is required"),
});

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const parsed = dispatchSchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Campaign ID vector required.", {
                status: 400,
                details: parsed.error.flatten(),
            });
        }

        const { campaignId } = parsed.data;

        // 1. Fetch Campaign Details
        const campaign = await prisma.campaignHistory.findUnique({
            where: { id: campaignId },
            include: { client: true }
        });

        if (!campaign || !campaign.client) {
            return error("NOT_FOUND", "No campaign company found in the matrix.", {
                status: 404,
            });
        }

        let parsedOutput;
        try {
            parsedOutput = parseCampaignGeneratedOutput(campaign.generatedOutput);
        } catch (parseErr: any) {
            return error("BAD_REQUEST", parseErr?.message || "Campaign payload is invalid.", {
                status: 400,
            });
        }
        const { subject, body } = parsedOutput;

        if (!campaign.client.email) {
            return error("BAD_REQUEST", "Target company lacks a valid email ID.", {
                status: 400,
            });
        }

        // 2. Dispatch Strategic Communication: Final Variable Synchronization
        const normalizedBody = sanitizeEmailHtml(normalizeEmailBodyHtml(body));
        const synchronizedBody = replaceVariables(normalizedBody, campaign.client);
        const htmlBody = wrapInEmailTemplate("standard", synchronizedBody, campaign.client.clientName);

        const result = await sendStrategicEmail({
            to: campaign.client.email,
            subject: subject,
            html: htmlBody,
            text: body.replace(/<[^>]*>/g, ""),
        });

        if (!result.success) {
            return error("INTEGRATION_ERROR", result.error || "Neural Link Failure.", {
                status: 400,
            });
        }

        return ok({
            messageId: result.messageId,
            recipient: campaign.client.clientName,
        });
    } catch (err: any) {
        console.error("Neural Dispatch Error:", err);
        return error(
            "INTERNAL_ERROR",
            err.message || "Major system failure during dispatch.",
        );
    }
}
