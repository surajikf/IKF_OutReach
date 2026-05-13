import prisma from "@/lib/prisma";
import { normalizeEmailBodyHtml } from "@/lib/shared/email-format";
import { wrapInEmailTemplate } from "@/lib/shared/email-template";
import { sanitizeEmailHtml } from "@/lib/shared/email-sanitize";
import { createStrategicGmailDraft, sendStrategicEmail } from "@/services/mail";
import { parseCampaignGeneratedOutput } from "@/lib/shared/campaign-output";
import { replaceVariables } from "@/lib/shared/utils";

export async function runCampaignDispatchInline(payload: {
  campaignIds: string[];
  dispatchMode: "SEND" | "DRAFT";
  userId?: string | null;
  batchSize?: number;
  batchDelayMinutes?: number;
  scheduledAt?: string | null;
  jobId?: string;
}) {
  const {
    campaignIds,
    dispatchMode,
    userId = null,
    batchSize = 50,
    batchDelayMinutes = 5,
    scheduledAt = null,
    jobId,
  } = payload;

  const total = campaignIds.length;
  let successCount = 0;
  const failures: Array<{ campaignId: string; error: string }> = [];
  const sentEmails = new Set<string>();

  for (let i = 0; i < campaignIds.length; i++) {
    const campaignId = campaignIds[i];
    try {
      const campaign = await (prisma as any).campaignHistory.findUnique({
        where: { id: campaignId },
        include: { client: true },
      });

      if (!campaign?.client?.email) {
        throw new Error("Campaign client email missing.");
      }

      const recipientEmails = campaign.client.email
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);

      const isDuplicate = recipientEmails.some((e: string) => sentEmails.has(e));
      if (isDuplicate) {
        failures.push({ campaignId, error: "Duplicate email — already sent in this batch." });
        continue;
      }
      recipientEmails.forEach((e: string) => sentEmails.add(e));

      const { subject, body } = parseCampaignGeneratedOutput(campaign.generatedOutput);
      const normalizedBody = sanitizeEmailHtml(normalizeEmailBodyHtml(body));
      const synchronizedBody = replaceVariables(normalizedBody, campaign.client);
      const htmlBody = wrapInEmailTemplate("standard", synchronizedBody, campaign.client.clientName);
      const existingDraftId = campaign.gmailDraftId || undefined;

      const result = dispatchMode === "DRAFT"
        ? await createStrategicGmailDraft(
            { to: campaign.client.email, subject, html: htmlBody, text: body.replace(/<[^>]*>/g, "") },
            { userId: userId ?? undefined, existingDraftId }
          )
        : await sendStrategicEmail(
            { to: campaign.client.email, subject, html: htmlBody, text: body.replace(/<[^>]*>/g, "") },
            { userId: userId ?? undefined }
          );

      if (!result.success) throw new Error(result.error || "Email dispatch failed.");

      if (dispatchMode === "DRAFT" && (result as any).draftId) {
        await (prisma as any).campaignHistory.update({
          where: { id: campaignId },
          data: { gmailDraftId: (result as any).draftId },
        }).catch(() => {});
      }

      successCount++;
    } catch (e: any) {
      const message = e?.message ? String(e.message) : "Dispatch failed.";
      console.error(`[campaign-dispatch] Failed for ${campaignId}:`, message);
      failures.push({ campaignId, error: message });
    }

    // Update job progress if jobId provided
    if (jobId) {
      const progress = Math.round(((i + 1) / total) * 100);
      await (prisma as any).job.update({
        where: { id: jobId },
        data: { progress, result: { successCount, failureCount: failures.length } },
      }).catch(() => {});
    }

    // Small per-email delay to respect rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  return { mode: dispatchMode, total, successCount, failureCount: failures.length, failures };
}
