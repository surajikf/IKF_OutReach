import { getTargetClients } from "@/backend/domain/campaigns";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";

const targetClientsQuerySchema = z.object({
  type: z.string().min(1, "Campaign type is required"),
  serviceFilters: z.array(z.string()).optional().default([]),
  serviceLogic: z.enum(["AND", "OR"]).optional().default("OR"),
  excludedClientIds: z.array(z.string()).optional().default([]),
  includeExclusions: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = targetClientsQuerySchema.safeParse(json);

    if (!parsed.success) {
      return error("VALIDATION_ERROR", "Invalid target client parameters", {
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const { type, serviceFilters, serviceLogic, excludedClientIds, includeExclusions } = parsed.data;
    const clients = await getTargetClients(type, serviceFilters, serviceLogic as any, excludedClientIds, includeExclusions);

    return ok(clients);
  } catch (err) {
    console.error("[Target Clients API] Internal Failure:", err);
    return error("INTERNAL_ERROR", "Internal Server Error");
  }
}
