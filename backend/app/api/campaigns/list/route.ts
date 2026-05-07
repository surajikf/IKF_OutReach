import prisma from "@/backend/lib/prisma";
import { getBackendSession } from "@/backend/lib/auth";
import { ok, error } from "@/backend/lib/api-response";
import { listCampaignHistory } from "@/backend/domain/campaigns";

type DispatchStatus = "GENERATED" | "DRAFT_SAVED" | "SENT" | "FAILED" | "PROCESSING";

export async function GET(request: Request) {
  try {
    const session = await getBackendSession(request);
    const user = session?.user;
    if (!user?.id) {
      return error("UNAUTHORIZED", "Authentication required.", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const search = searchParams.get("search") || "";

    const campaigns = await listCampaignHistory({ limit, search });
    const campaignIds = campaigns.map((c: any) => c.id).filter(Boolean);

    const draftRows = campaignIds.length
      ? await prisma.emailDraft.findMany({
          where: {
            userId: user.id,
            context: { in: campaignIds.map((id: string) => `campaigns__results__${id}`) },
          },
          select: { context: true, updatedAt: true },
        })
      : [];

    const draftMap = new Map<string, Date>();
    for (const d of draftRows) {
      const id = String(d.context || "").replace("campaigns__results__", "");
      if (id) draftMap.set(id, d.updatedAt);
    }

    const jobs = await (prisma as any).job.findMany({
      where: { type: "CAMPAIGN_DISPATCH_BATCH" },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: {
        status: true,
        payload: true,
        result: true,
        updatedAt: true,
      },
    });

    const statusMap = new Map<string, { status: DispatchStatus; updatedAt: Date; mode?: "SEND" | "DRAFT" }>();

    for (const job of jobs) {
      const payload = (job.payload || {}) as any;
      const ids: string[] = Array.isArray(payload?.campaignIds) ? payload.campaignIds : [];
      const mode: "SEND" | "DRAFT" = payload?.dispatchMode === "DRAFT" ? "DRAFT" : "SEND";
      const result = (job.result || {}) as any;
      const failedIds = new Set<string>(Array.isArray(result?.failedCampaignIds) ? result.failedCampaignIds : []);

      for (const id of ids) {
        if (!campaignIds.includes(id)) continue;
        if (statusMap.has(id)) continue; // latest wins due to desc ordering

        let status: DispatchStatus = "GENERATED";
        if (job.status === "QUEUED" || job.status === "RUNNING") status = "PROCESSING";
        else if (job.status === "FAILED") status = "FAILED";
        else if (job.status === "SUCCEEDED") {
          if (failedIds.has(id)) status = "FAILED";
          else status = mode === "DRAFT" ? "DRAFT_SAVED" : "SENT";
        }

        statusMap.set(id, { status, updatedAt: job.updatedAt, mode });
      }
    }

    const data = campaigns.map((c: any) => {
      const dispatch = statusMap.get(c.id);
      const draftAt = draftMap.get(c.id);
      const fallbackStatus: DispatchStatus = draftAt ? "DRAFT_SAVED" : "GENERATED";
      return {
        ...c,
        dispatchStatus: dispatch?.status || fallbackStatus,
        dispatchMode: dispatch?.mode || (draftAt ? "DRAFT" : null),
        dispatchUpdatedAt: dispatch?.updatedAt || draftAt || null,
      };
    });

    return ok(data);
  } catch (err: any) {
    console.error("Campaign list error:", err);
    return error("INTERNAL_ERROR", "Failed to load campaign list.");
  }
}

