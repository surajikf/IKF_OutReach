import { ok, error } from "@/backend/lib/api-response";
import { listCampaignHistory } from "@/backend/domain/campaigns";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const search = searchParams.get("search") || "";
        const type = searchParams.get("type") || "";

        const history = await listCampaignHistory({ limit, search, type });

        return ok(history);
    } catch (err: any) {
        console.error("Failed to fetch history:", err);
        return error("INTERNAL_ERROR", "Failed to fetch history");
    }
}
