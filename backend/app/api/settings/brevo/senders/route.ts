import { ok, error } from "@/backend/lib/api-response";
import { getGlobalSettings } from "@/backend/lib/settings";
import prisma from "@/backend/lib/prisma";

export async function GET() {
    try {
        const settings = await getGlobalSettings();
        const apiKey = settings.brevoApiKey;

        if (!apiKey) {
            return error("VALIDATION_ERROR", "Brevo API Key not configured in .env or Settings.");
        }

        const response = await fetch("https://api.brevo.com/v3/senders", {
            method: "GET",
            headers: {
                "accept": "application/json",
                "api-key": apiKey
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ message: "Unknown API Error" }));
            return error("API_ERROR", errData.message || "Failed to fetch senders from Brevo");
        }

        const data = await response.json();
        return ok(data.senders || []);
    } catch (err: any) {
        console.error("Brevo Senders Fetch Failure:", err);
        return error("INTERNAL_ERROR", "Failed to reach Brevo API. Ensure your network connection and BREVO_API_KEY are valid.");
    }
}
