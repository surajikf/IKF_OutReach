import prisma from "@/backend/lib/prisma";
import { ok, error } from "@/backend/lib/api-response";
import { getBackendSession, isApprovedUser } from "@/backend/lib/auth";
import { decrypt } from "@/backend/lib/encryption";

export async function GET(req: Request) {
    try {
        if (!await isApprovedUser(req)) {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }
        const session = await getBackendSession(req);
        if (!session?.user?.id) return error("UNAUTHORIZED", "Sign in required.", { status: 401 });

        const settingsList = await prisma.$queryRawUnsafe(`SELECT * FROM "GlobalSettings" LIMIT 1`) as any[];
        const settings = settingsList?.[0];
        const zohoConnection = await prisma.zohoConnection.findUnique({
            where: { userId: session.user.id },
            select: { refreshTokenEncrypted: true, grantedScopes: true },
        });
        
        if (!settings || !settings.zohoClientIdEncrypted || !settings.zohoClientSecretEncrypted || !zohoConnection?.refreshTokenEncrypted) {
            return error("NOT_CONFIGURED", "Zoho settings not fully configured.");
        }

        console.log("[ZOHO_STAGES] Decrypting credentials...");
        const clientId = decrypt(settings.zohoClientIdEncrypted);
        const clientSecret = decrypt(settings.zohoClientSecretEncrypted);
        const refreshToken = decrypt(zohoConnection.refreshTokenEncrypted);

        if (!clientId || !clientSecret || !refreshToken) {
            console.error("[ZOHO_STAGES] Decryption failed or empty credentials.");
            return error("ZOHO_CONFIG_ERROR", "Failed to decrypt Zoho credentials.");
        }

        console.log("[ZOHO_STAGES] Refreshing access token...");
        const tokenRes = await fetch("https://accounts.zoho.in/oauth/v2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "refresh_token"
            })
        });

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            console.error("[ZOHO_STAGES] Token refresh failed:", tokenData);
            return error("ZOHO_AUTH_FAILED", `Failed to refresh Zoho token: ${tokenData.error || 'Unknown error'}`);
        }
        
        const targetPipelineName = settings.zohoPipelineName || "Sales Pipeline";

        console.log("[ZOHO_STAGES] Fetching pipelines from Zoho...");
        let pipelineRes = await fetch("https://www.zohoapis.in/bigin/v2/settings/pipelines", {
            headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
        });

        // Fallback to v1 if v2 fails with scope error
        let fallbackUsed = false;
        if (pipelineRes.status === 401 || pipelineRes.status === 403) {
            fallbackUsed = true;
            console.warn("[ZOHO_STAGES] v2 failed, trying v1 fallback...");
            pipelineRes = await fetch("https://www.zohoapis.in/bigin/v1/settings/pipelines", {
                headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
            });
        }

        // Final Fail-Proof Fallback: Fetch Deals to extract stages
        if (!pipelineRes.ok && (pipelineRes.status === 401 || pipelineRes.status === 403)) {
            console.warn("[ZOHO_STAGES] Metadata failed. Attempting Deal-Sampling Discovery...");
            const dealsRes = await fetch("https://www.zohoapis.in/bigin/v1/Deals?per_page=20", {
                headers: { "Authorization": `Zoho-oauthtoken ${accessToken}` }
            });
            
            if (dealsRes.ok) {
                const dealsData = await dealsRes.json();
                const deals = dealsData.data || [];
                const sampledStages = deals.map((d: any) => d.Stage).filter(Boolean);
                
                // Merge with defaults
                const finalStages = Array.from(new Set([
                    ...sampledStages,
                    "Qualification", "Needs Analysis", "Value Proposition", "Identify Decision Makers", "Proposal/Price Quote", "Negotiation/Review", "Closed Won", "Closed Lost"
                ]));
                
                console.log(`[ZOHO_STAGES] Deal-Sampling found ${sampledStages.length} stages. Total with defaults: ${finalStages.length}`);

                return ok({
                    stages: finalStages,
                    discoveryMethod: "sampling",
                    pipelineName: targetPipelineName
                });
            }
        }

        if (!pipelineRes.ok) {
            const errText = await pipelineRes.text();
            console.error(`[ZOHO_STAGES] ${fallbackUsed ? 'v1' : 'v2'} fetch failed:`, pipelineRes.status, errText);
            return error("ZOHO_API_ERROR", `${fallbackUsed ? 'V1 Fallback' : 'V2 API'} Error: ${pipelineRes.status} ${errText}`, {
                details: { grantedScopes: zohoConnection.grantedScopes }
            });
        }

        const data = await pipelineRes.json();
        const pipelines = data.pipelines || [];

        const selectedPipeline = pipelines.find((p: any) => p.display_name === targetPipelineName) || pipelines[0];

        if (!selectedPipeline) {
            console.warn("[ZOHO_STAGES_V2] No pipelines found.");
            return ok({ stages: [] });
        }

        // In V2, stages are under sub_pipelines
        const stages: string[] = [];
        if (selectedPipeline.sub_pipelines && selectedPipeline.sub_pipelines.length > 0) {
            selectedPipeline.sub_pipelines.forEach((sub: any) => {
                if (sub.stages) {
                    sub.stages.forEach((s: any) => {
                        if (s.display_name && !stages.includes(s.display_name)) {
                            stages.push(s.display_name);
                        }
                    });
                }
            });
        }

        console.log(`[ZOHO_STAGES_V2] Found ${stages.length} stages for pipeline: ${selectedPipeline.display_name}`);

        return ok({ 
            stages,
            pipelineName: selectedPipeline.display_name
        });
    } catch (err) {
        console.error("Zoho Stages GET Error:", err);
        return error("INTERNAL_ERROR", "Failed to fetch Zoho stages.");
    }
}
