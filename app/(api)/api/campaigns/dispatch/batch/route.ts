import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { getBackendSession, isApprovedUser } from "@/services/auth";
import { runCampaignDispatchInline } from "@/services/workers/campaign-dispatch";
import { z } from "zod";

const dispatchBatchSchema = z.object({
  campaignIds: z.array(z.string().min(1)).min(1),
  dispatchMode: z.enum(["SEND", "DRAFT"]).optional().default("SEND"),
  userId: z.string().optional(),
  batchSize: z.number().int().min(1).max(500).optional().default(50),
  batchDelayMinutes: z.number().min(0).max(60).optional().default(5),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    if (!await isApprovedUser(request)) {
      return error("FORBIDDEN", "Unauthorized.", { status: 403 });
    }

    const session = await getBackendSession(request);
    if (!session?.user?.id) {
      return error("UNAUTHORIZED", "Sign in required.", { status: 401 });
    }

    const json = await request.json();
    const parsed = dispatchBatchSchema.safeParse(json);

    if (!parsed.success) {
      return error("VALIDATION_ERROR", "Invalid dispatch payload.", {
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const isAdmin = (session.user as any)?.role === "ADMIN";
    const scopedUserId = isAdmin ? (parsed.data.userId || session.user.id) : session.user.id;

    // Non-admins can only dispatch their own campaigns
    if (!isAdmin) {
      const campaigns = await prisma.campaignHistory.findMany({
        where: { id: { in: parsed.data.campaignIds } },
        select: { id: true, userId: true },
      });
      const forbidden = campaigns.filter((c) => c.userId && c.userId !== session.user.id);
      if (forbidden.length > 0) {
        return error("FORBIDDEN", "One or more campaigns do not belong to you.", { status: 403 });
      }
    }

    const job = await (prisma as any).job.create({
      data: {
        type: "CAMPAIGN_DISPATCH_BATCH",
        status: "RUNNING",
        progress: 0,
        payload: { ...parsed.data, userId: scopedUserId },
      },
    });

    // Run synchronously so the job status is updated before we respond.
    // This avoids the serverless-termination problem where fire-and-forget
    // IIFEs are killed after the response is sent, leaving jobs stuck in RUNNING.
    try {
      const result = await runCampaignDispatchInline({
        campaignIds: parsed.data.campaignIds,
        dispatchMode: parsed.data.dispatchMode,
        userId: scopedUserId,
        batchSize: parsed.data.batchSize,
        batchDelayMinutes: parsed.data.batchDelayMinutes,
        scheduledAt: parsed.data.scheduledAt ?? null,
        jobId: job.id,
      });
      const succeeded = result.successCount > 0 || result.total === 0;
      await (prisma as any).job.update({
        where: { id: job.id },
        data: { status: succeeded ? "SUCCEEDED" : "FAILED", progress: 100, result },
      });
      return ok({ jobId: job.id, result }, { status: 200 });
    } catch (err: any) {
      console.error("[dispatch-batch] Inline execution error:", err);
      await (prisma as any).job.update({
        where: { id: job.id },
        data: { status: "FAILED", result: { error: err?.message || "Unknown error" } },
      }).catch(() => {});
      return error("INTERNAL_ERROR", err?.message || "Dispatch failed.", { status: 500 });
    }
  } catch (err: any) {
    console.error("Dispatch batch enqueue error:", err);
    return error("INTERNAL_ERROR", "Failed to enqueue dispatch batch.");
  }
}
