import { syncZohoDeals } from "@/backend/domain/integrations";
import { ok, error } from "@/backend/lib/api-response";
import { createClient } from "@/backend/lib/supabase/server";

import { isAdmin } from "@/backend/lib/auth";

export async function POST(req: Request) {
    try {
        if (!await isAdmin(req)) {
            return error(
                "FORBIDDEN",
                "Unauthorized access. Level-5 Clearance Required.",
                { status: 403 },
            );
        }

        try {
            const result = await syncZohoDeals();

            return ok(result);
        } catch (err: any) {
            if (err.message?.includes("not connected") || err.message?.includes("decrypt")) {
                return error("BAD_REQUEST", err.message, { status: 400 });
            }
            console.error("Zoho Sync Error:", err);
            return error("INTEGRATION_ERROR", "Zoho sync failed", {
                status: 502,
                details: { message: err.message },
            });
        }
    } catch (err: any) {
        console.error("Zoho Sync Error:", err);
        return error("INTERNAL_ERROR", "Internal Server Error", {
            details: { message: err.message },
        });
    }
}
