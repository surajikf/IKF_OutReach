import { ok, error } from "@/backend/lib/api-response";
import { getGlobalSettings } from "@/backend/lib/settings";

export async function GET() {
    try {
        const settings = await getGlobalSettings();
        const apiKey = process.env.BREVO_API_KEY?.trim() || "";

        if (!apiKey) {
            return error("VALIDATION_ERROR", "Brevo API Key not configured.");
        }

        const response = await fetch("https://api.brevo.com/v3/account", {
            method: "GET",
            headers: {
                "accept": "application/json",
                "api-key": apiKey
            }
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ message: "Unknown error" }));
            return error("API_ERROR", errData.message || "Failed to fetch account info from Brevo");
        }

        const data = await response.json();
        
        // Defensive mapping for plan details
        const planInfo = Array.isArray(data.plan) ? data.plan : [];
        const primaryPlan = planInfo[0] || {};

        return ok({
            plan: planInfo.map((p: any) => ({
                type: p.type || "Free",
                credits: typeof p.credits === 'number' ? p.credits : 300,
                creditsUsed: typeof p.creditsUsed === 'number' ? p.creditsUsed : 0
            })),
            links: data.address || null,
            email: data.email || "",
            companyName: data.companyName || "",
            featureAccess: data.featureAccess || {}
        });
    } catch (err: any) {
        console.error("Brevo Account Fetch Failure:", err);
        return error("INTERNAL_ERROR", "Neural bridge to Brevo timed out.");
    }
}
