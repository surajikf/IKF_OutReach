import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";

const dispatchBatchSchema = z.object({
  campaignIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = dispatchBatchSchema.safeParse(json);

    if (!parsed.success) {
      return error("VALIDATION_ERROR", "Invalid dispatch payload.", {
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const job = await (prisma as any).job.create({
      data: {
        type: "CAMPAIGN_DISPATCH_BATCH",
        status: "QUEUED",
        progress: 0,
        payload: parsed.data,
      },
    });

    return ok({ jobId: job.id }, { status: 202 });
  } catch (err: any) {
    console.error("Dispatch batch enqueue error:", err);
    return error("INTERNAL_ERROR", "Failed to enqueue dispatch batch.");
  }
}

