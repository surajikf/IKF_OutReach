import { estimateCampaignAudience } from "@/backend/domain/campaigns";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";

const estimateQuerySchema = z.object({
    type: z.string().min(1, "Campaign type is required"),
    serviceFilters: z.array(z.string()).optional().default([]),
    serviceLogic: z.enum(["AND", "OR"]).optional().default("OR"),
    excludedClientIds: z.array(z.string()).optional().default([]),
});

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const parsed = estimateQuerySchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Invalid estimation parameters", {
                status: 400,
                details: parsed.error.flatten(),
            });
        }

        const { type, serviceFilters, serviceLogic, excludedClientIds } = parsed.data;
        const { count, industries } = await estimateCampaignAudience(type, serviceFilters, serviceLogic, excludedClientIds);

        return ok({ count, industries });
    } catch (err) {
        console.error("[Estimate API] Internal Failure:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}
