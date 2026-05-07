import { getTargetClients } from "@/backend/domain/campaigns";
import { ok, error } from "@/backend/lib/api-response";
import { hasInvoiceAccess } from "@/backend/lib/auth";
import { z } from "zod";

const targetClientsQuerySchema = z.object({
  audienceSource: z.enum(["INVOICE_SYSTEM", "ZOHO_BIGIN", "GMAIL"]).optional(),
  audienceSources: z.array(z.enum(["INVOICE_SYSTEM", "ZOHO_BIGIN", "GMAIL"])).optional(),
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

    const { audienceSource, audienceSources, type, serviceFilters, serviceLogic, excludedClientIds, includeExclusions } = parsed.data;
    const resolvedSources = (audienceSources && audienceSources.length > 0)
      ? audienceSources
      : (audienceSource ? [audienceSource] : []);
    if (resolvedSources.length === 0) {
      return error("VALIDATION_ERROR", "Audience source is required", { status: 400 });
    }
    if (resolvedSources.includes("INVOICE_SYSTEM") && !await hasInvoiceAccess(request)) {
      return error("FORBIDDEN", "Invoice data access is not enabled for this user.", { status: 403 });
    }
    const clients = await getTargetClients(resolvedSources as any, type, serviceFilters, serviceLogic as any, excludedClientIds, includeExclusions);

    return ok(clients);
  } catch (err) {
    console.error("[Target Clients API] Internal Failure:", err);
    return error("INTERNAL_ERROR", "Internal Server Error");
  }
}
