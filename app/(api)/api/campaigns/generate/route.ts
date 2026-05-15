import prisma from "@/lib/prisma";
import { getGlobalSettings } from "@/services/settings";
import { ok, error } from "@/services/api-response";
import { getSmartGreeting, replaceVariables } from "@/lib/shared/utils";
import { z } from "zod";
import { getTargetClients } from "@/domain/campaigns";
import { dedupeLeadingSalutation, normalizeEmailBodyHtml } from "@/lib/shared/email-format";
import { evaluateEmailQuality } from "@/lib/shared/campaign-quality";
import { hasInvoiceAccess, getBackendSession } from "@/services/auth";
import { runAiWithFallback } from "@/services/ai-router";
import { runCampaignGenerateInline } from "@/services/workers/campaign-generate";

/**
 * Aggressively replaces a literal name with a variable placeholder.
 * Used to scrub hardcoded names from sample drafts.
 */
function scrubLiteralName(content: string, nameToScrub: string, replacementVariable: string = "{{fullName}}") {
    if (!content || !nameToScrub || nameToScrub.length < 3) return content;
    
    // Create a regex for the full name
    const fullRegex = new RegExp(nameToScrub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let processed = content.replace(fullRegex, replacementVariable);

    // Also try scrubbing the first name part if it's long enough
    const firstName = nameToScrub.split(' ')[0];
    if (firstName && firstName.length > 2 && firstName !== nameToScrub) {
        const firstRegex = new RegExp(`\\b${firstName}\\b`, 'gi');
        processed = processed.replace(firstRegex, "{{firstName}}");
    }

    return processed;
}

const generateCampaignSchema = z.object({
    audienceSource: z.enum(["INVOICE_SYSTEM", "ZOHO_BIGIN", "GMAIL", "GOOGLE_CONTACTS"]).optional(),
    audienceSources: z.array(z.enum(["INVOICE_SYSTEM", "ZOHO_BIGIN", "GMAIL", "GOOGLE_CONTACTS"])).optional(),
    type: z.string().min(1, "Campaign type is required"),
    topic: z.string().min(1, "Topic is required"),
    coreMessage: z.string().min(1, "Core message is required"),
    cta: z.string().min(1, "Call to action is required"),
    sampleOnly: z.boolean().optional().default(false),
    clientId: z.string().optional(),
    styleGuide: z.object({
        subject: z.string(),
        body: z.string()
    }).optional(),
    styleMemory: z.object({
        preferredCtaStyle: z.string().optional(),
        avgSentenceLength: z.number().optional(),
        prefersConcise: z.boolean().optional(),
        learnedPatterns: z.array(z.string()).optional(),
    }).optional(),
    serviceFilters: z.array(z.string()).optional().default([]),
    serviceLogic: z.enum(["AND", "OR"]).optional().default("OR"),
    excludedClientIds: z.array(z.string()).optional().default([]),
    sampleClientId: z.string().optional(),
    singleClientId: z.string().optional(),
    batchSize: z.number().int().min(1).max(500).optional().default(50),
    batchDelayMinutes: z.number().min(0).max(60).optional().default(5),
    scheduledAt: z.string().nullable().optional(),
});

export async function POST(request: Request) {
    try {
        const session = await getBackendSession(request);
        const sessionUser = session?.user;
        const isAdmin = sessionUser?.role === "ADMIN";
        const scopedUserId = isAdmin ? undefined : sessionUser?.id;
        const json = await request.json();
        const parsed = generateCampaignSchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Invalid campaign generation payload", {
                status: 400,
                details: parsed.error.flatten(),
            });
        }

        // Fast UX: batch generation runs in background as a job.
        // Keep `sampleOnly` synchronous so the UI can open the refinement screen immediately.
        const payload = parsed.data;

        // Single-client fast path: save already-edited content directly, no AI, no job queue.
        if (payload.singleClientId && payload.styleGuide) {
            const client = await prisma.client.findFirst({
                where: { id: payload.singleClientId, ...(scopedUserId && { userId: scopedUserId }) },
                select: { id: true, clientName: true, email: true, contactPerson: true, industry: true, clientAddedOn: true, invoiceServiceNames: true, relationshipLevel: true, lastInvoiceDate: true },
            });
            if (!client) return error("NOT_FOUND", "Client not found", { status: 404 });

            const body = normalizeEmailBodyHtml(replaceVariables(payload.styleGuide.body, client));
            const subject = replaceVariables(payload.styleGuide.subject, client);
            const generatedOutput = JSON.stringify({ subject, body, leadStrength: 75, spamRisk: 5 });

            // Create a pre-SUCCEEDED job shell so the results page polling works
            const job = await (prisma as any).job.create({
                data: {
                    type: "CAMPAIGN_GENERATE",
                    status: "SUCCEEDED",
                    progress: 100,
                    payload: { singleClientId: payload.singleClientId, _userId: sessionUser?.id ?? null },
                    result: { count: 1 }, // Placeholder
                },
            });

            const campaign = await (prisma as any).campaignHistory.create({
                data: {
                    clientId: client.id,
                    campaignType: payload.type,
                    campaignTopic: payload.topic,
                    generatedOutput,
                    jobId: job.id,
                    userId: sessionUser?.id ?? null,
                },
            });
            // Use direct literal to bypass pooler's prepared statement limitation
            await (prisma as any).$executeRawUnsafe(`UPDATE "CampaignHistory" SET "jobId" = '${job.id}' WHERE id = '${campaign.id}'`).catch(() => {});

            // Update job result with the real campaign ID
            await (prisma as any).job.update({
                where: { id: job.id },
                data: { result: { count: 1, singleCampaignId: campaign.id } }
            });

            return ok({ jobId: job.id }, { status: 202 });
        }

        if (!payload.sampleOnly) {
            // Create a job record immediately so the results page can poll it.
            // Then run generation inline (no separate worker process needed).
            const job = await (prisma as any).job.create({
                data: {
                    type: "CAMPAIGN_GENERATE",
                    status: "RUNNING",
                    progress: 0,
                    payload: { ...payload, _userId: sessionUser?.id ?? null },
                    startedAt: new Date(),
                    attempts: 1,
                },
            });

            // Run generation inline — fire and forget so HTTP response returns immediately.
            // Client polls /jobs/:id for SUCCEEDED/FAILED status.
            (async () => {
                try {
                    const result = await runCampaignGenerateInline(job.id, { ...payload, _userId: sessionUser?.id ?? null });
                    await (prisma as any).job.update({
                        where: { id: job.id },
                        data: { status: "SUCCEEDED", progress: 100, finishedAt: new Date(), result, error: null },
                    });
                } catch (err: any) {
                    const message = typeof err?.message === "string" ? err.message : String(err || "Unknown error");
                    await (prisma as any).job.update({
                        where: { id: job.id },
                        data: { status: "FAILED", finishedAt: new Date(), error: message },
                    }).catch(() => {});
                }
            })();

            return ok({ jobId: job.id }, { status: 202 });
        }

        const { audienceSource, audienceSources, type, topic: rawTopic, coreMessage: rawCoreMessage, cta, sampleOnly, clientId, styleGuide: rawStyleGuide, styleMemory, excludedClientIds, serviceFilters, serviceLogic, sampleClientId } = payload;
        const resolvedSources = (audienceSources && audienceSources.length > 0)
            ? audienceSources
            : (audienceSource ? [audienceSource] : []);
        if (resolvedSources.length === 0) {
            return error("VALIDATION_ERROR", "Audience source is required", { status: 400 });
        }
        if (resolvedSources.includes("INVOICE_SYSTEM") && !await hasInvoiceAccess(request)) {
            return error("FORBIDDEN", "Invoice data access is not enabled for this user.", { status: 403 });
        }

        // 1. Initial Matrix Calibration (Dynamic Settings)
        const settings = await getGlobalSettings();

        // 2. Fetch Target Clients
        let targetClients: any[] = [];
        
        if (sampleOnly && clientId) {
            // Specific client requested for sample
            // Map GOOGLE_CONTACTS to GMAIL for database query
            const prismaSources = (resolvedSources || []).map(s => s === "GOOGLE_CONTACTS" ? "GMAIL" : s);
            const client = await prisma.client.findFirst({
                where: { 
                    id: clientId, 
                    source: { in: prismaSources as any }, 
                    ...(scopedUserId && { userId: scopedUserId }) 
                },
                select: {
                    id: true,
                    clientName: true,
                    email: true,
                    industry: true,
                    contactPerson: true,
                    relationshipLevel: true,
                    clientAddedOn: true,
                    lastInvoiceDate: true,
                    invoiceServiceNames: true,
                }
            });
            if (client) targetClients = [client];
        } else {
            // Fetch potential targets respecting segmentation and exclusions
            const allTargets = await getTargetClients(resolvedSources as any, type, serviceFilters, serviceLogic, excludedClientIds, false, scopedUserId);
            
            if (sampleOnly) {
                // Pick one "random" (first) client for the sample
                targetClients = allTargets.length > 0 ? [allTargets[0]] : [];
            } else {
                // Batch processing (Safety limit 50)
                targetClients = allTargets.slice(0, 50);
            }
        }

        // 3. Scrub hardcoded sample names from templates if sampleClientId is provided
        let topic = rawTopic;
        let coreMessage = rawCoreMessage;
        let styleGuide = rawStyleGuide;
        let nameToScrub = "";

        if (sampleClientId) {
            const sampleClient = await prisma.client.findUnique({ where: { id: sampleClientId } });
            if (sampleClient) {
                nameToScrub = sampleClient.contactPerson || sampleClient.clientName || "";
                
                const scrub = (text: string) => {
                    if (!text || !nameToScrub) return text;
                    return scrubLiteralName(text, nameToScrub);
                };

                topic = scrub(topic);
                coreMessage = scrub(coreMessage);
                if (styleGuide) {
                    styleGuide = {
                        subject: scrub(styleGuide.subject),
                        body: scrub(styleGuide.body)
                    };
                }
            }
        }

        // 4. AI Generation Logic (Groq primary, OpenRouter fallback)
        let lastAiRouting: { providerUsed: string; fallbackActive: boolean; groqRetryAt: string | null } | null = null;

        const generatedCampaigns = await Promise.all((targetClients || []).map(async (client: any) => {
            const servicesList = client.invoiceServiceNames || "your business infrastructure";
            const greeting = getSmartGreeting(client.contactPerson || client.poc, {
                email: client.email,
                signature: client.emailSignature || client.signature || client.signatureName,
            });
            
            // --- Institutional Intelligence Context ---
            const now = new Date();
            const addedOn = client.clientAddedOn ? new Date(client.clientAddedOn) : null;
            const tenureYears = addedOn ? now.getFullYear() - addedOn.getFullYear() : 0;
            const relationshipDepth = tenureYears > 3 ? "Deep Legacy" : tenureYears > 1 ? "Established Partnership" : "New Engagement";
            
            const lastInvoice = client.lastInvoiceDate ? new Date(client.lastInvoiceDate) : null;
            const lastActivity = lastInvoice ? `Last significant engagement: ${lastInvoice.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : "Ongoing relationship";

            const firstName =
                (client.contactPerson || client.poc || "")
                    .replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Prof\.?)\s+/i, "")
                    .split(/\s+/)
                    .filter(Boolean)[0] || "";
            const companyName = client.clientName || "your company";
            const industry = client.industry || "your industry";

            // Enhanced default subject with personalization
            let subject = replaceVariables(topic || `Strategic Perspective for {{companyName}}`, client);
            let emailBody = "";

            try {
                const stylePrompt = styleGuide
                    ? `
                        STYLE BLUEPRINT (HIGHEST PRIORITY):
                        - Use this edited sample ONLY for voice, sentence rhythm, and section flow.
                        - IMPORTANT: The sample might contain a specific name (e.g., "Aditya"). DO NOT USE THIS NAME. 
                        - Replace ALL person-specific references in the sample with the correct data for the current RECIPIENT (${client.clientName}).
                        - Preserve structure and formatting pattern from the sample while personalizing details.
                        - Keep output concise and human-written (no AI-like phrasing).
                        SAMPLE SUBJECT: ${styleGuide.subject}
                        SAMPLE BODY: ${styleGuide.body}
                    `
                    : "";

                const relationshipContext = `
                        INSTITUTIONAL INTELLIGENCE:
                        - RELATIONSHIP DEPTH: ${relationshipDepth} (${tenureYears} years of collaboration).
                        - LAST ACTIVITY: ${lastActivity}.
                        - STATUS: ${client.relationshipLevel}.
                        
                        ADAPT YOUR HOOK: If they are a ${relationshipDepth} client, acknowledge the legacy and shared history. If they are ${client.relationshipLevel} "Past Client", position this as a "New Chapter" bridge.
                    `;

                const objectiveContexts: Record<string, string> = {
                    "Broadcast": "GOAL: Strategic wide-angle synchronization. Focus on high-level corporate shifts, new infrastructure, or vision pivots. The tone should be institutional yet authoritative.",
                    "Targeted": "GOAL: High-precision value sharing. Focus on a specific milestone or exclusive resource that directly aligns with the recipient's industry position. The tone should be highly personalized and exclusive.",
                    "Cross-Sell": "GOAL: Capacity expansion. Identify a likely 'friction point' in their current setup that our other services (${servicesList}) could solve. Position this as an integrated evolution, not a pitch.",
                    "Reactivation": "GOAL: Re-igniting a dormant partnership. Reference previous successes and acknowledge the 'new chapter' or capability shift that makes a dialogue relevant now. The tone should be nostalgic yet forward-looking.",
                };

                const prompt = `
                        ${relationshipContext}

                        CORE LOGIC:
                        - SENDER: Senior Advisor.
                        - RECIPIENT: ${client.clientName}.
                        - SECTOR: ${client.industry}.
                        - OBJECTIVE: ${type}.
                        ${objectiveContexts[type] || ""}

                        GOAL: 
                        You have been provided with a MASTER DRAFT (Subject and Body). Your task is to perform a HIGH-FIDELITY PERSONALIZATION of this draft for ${client.clientName}.
                        
                        MASTER SUBJECT: "${topic}"
                        MASTER BODY: "${coreMessage}"
                        REQUIRED CTA: "${cta}"
                        LEARNED STYLE MEMORY: ${styleMemory ? JSON.stringify(styleMemory) : "None"}
                        
                        CRITICAL SMART LOGIC:
                        1. START WITH GREETING: The email MUST start with exactly this: "${greeting}"
                        2. HIGH-FIDELITY SYNC: Mirror the unique wording, specialized tone, and specific value proposition of the MASTER BODY draft provided above.
                        3. NO LEAKED NAMES: If the MASTER DRAFT or STYLE BLUEPRINT contains a name (like "Aditya"), you MUST remove it and use the correct name for ${client.clientName}.
                        4. SMART VARIABLE INJECTION: Replace placeholders like {{firstName}}, {{lastName}}, {{fullName}}, {{companyName}}, {{industry}}, {{services}}, {{location}}, {{relationship}}, {{tenureYears}} with corresponding client data.
                        5. SEAMLESS FLOW: Weave in the client's sector (${client.industry}) context where it feels natural based on the draft's logic.
                        6. CTA ENFORCEMENT: Include a clear closing action aligned with REQUIRED CTA.
                        7. GLOBAL EMAIL STANDARDS:
                           - Use short paragraphs (2-4 lines max), clean spacing, and professional business tone.
                           - Keep message concise, value-first, and avoid hype/salesy language.
                           - Include one clear CTA and polite professional close.
                           - Greeting fallback order: contact name -> email local-part -> signature name -> "Dear Sir/Ma'am".
                           - Respect style memory hints when available (directness, concise wording, CTA style).
                           - NEVER mention or sign off with any specific company/brand name; use a generic sign-off (e.g., "Best regards,") only.
                           - If client details are missing (name, industry, services, relationship history), do NOT reference them. Write a complete email using only the topic/coreMessage/CTA.
                           - Do NOT write meta/instructional phrasing like "Your task is", "We have been provided", or "In summary".
                           - Write like a human advisor: avoid repeating the same sentence starters; avoid overly structured checklists.
                        8. HTML FORMAT: Return a valid HTML segment for the body. Preserve any formatting from the draft.
                        ${stylePrompt}
                        
                        OUTPUT: Return a PURE JSON object with "subject" and "body" fields.
                    `;

                const aiResult = await runAiWithFallback({
                    messages: [
                        { role: "system", content: "You are a strategic marketing AI that outputs ONLY pure JSON. For metrics like leadStrength and spamRisk, ALWAYS use integers between 0 and 100." },
                        { role: "user", content: prompt }
                    ],
                    responseFormat: "json_object",
                    temperature: 0.7,
                    modelOverride: settings.aiModel,
                });

                lastAiRouting = {
                    providerUsed: aiResult.providerUsed,
                    fallbackActive: aiResult.fallbackActive,
                    groqRetryAt: aiResult.groqRetryAt,
                };
                const content = JSON.parse(aiResult.content || "{}");
                let resSubject = content.subject || subject;
                let resEmailBody = content.body || "";

                // Ensure variable placeholders from sample are resolved for this client.
                resSubject = replaceVariables(resSubject, client);
                resEmailBody = replaceVariables(resEmailBody, client);

                // SECONDARY SCRUB: If AI leaked the sample name despite instructions
                if (nameToScrub) {
                    resSubject = scrubLiteralName(resSubject, nameToScrub);
                    resEmailBody = scrubLiteralName(resEmailBody, nameToScrub);
                    // Run replaceVariables again just in case scrub added new {{vars}}
                    resSubject = replaceVariables(resSubject, client);
                    resEmailBody = replaceVariables(resEmailBody, client);
                }
                // Never leak unresolved template variables in final output.
                resSubject = resSubject.replace(/\{\{[^}]+\}\}/g, companyName);
                resEmailBody = resEmailBody.replace(/\{\{[^}]+\}\}/g, "your team");

                // Enforce greeting at start for personalization quality.
                const lowerPersonal = resEmailBody.toLowerCase().trim();
                if (!lowerPersonal.startsWith(greeting.toLowerCase().split(" ")[0])) {
                    resEmailBody = `<p>${greeting},</p>${resEmailBody}`;
                }
                resEmailBody = dedupeLeadingSalutation(resEmailBody);

                // Enforce CTA presence if missing from body.
                const ctaNeedle = cta.toLowerCase().trim();
                if (ctaNeedle && !resEmailBody.toLowerCase().includes(ctaNeedle)) {
                    resEmailBody = `${resEmailBody}<p>${cta}</p>`;
                }

                // Ensure at least one unique personalization marker exists.
                const markerBody = resEmailBody.toLowerCase();
                const hasMarker =
                    markerBody.includes(companyName.toLowerCase()) ||
                    markerBody.includes(industry.toLowerCase()) ||
                    (servicesList && markerBody.includes(String(servicesList).split(",")[0].trim().toLowerCase()));
                if (!hasMarker) {
                    resEmailBody = `${resEmailBody}<p>Given ${companyName}'s ${industry} context, this can create immediate practical value.</p>`;
                }

                // Global-standard formatting normalization (paragraphs, spacing, lists)
                resEmailBody = normalizeEmailBodyHtml(resEmailBody);

                // Subject fallback hardening: keep it specific and personalized.
                if (!resSubject || resSubject.trim().length < 6) {
                    resSubject = firstName
                        ? `${firstName}, quick idea for ${companyName}`
                        : `Quick idea for ${companyName}`;
                }
                if (!/{{|}}/.test(resSubject) && !resSubject.toLowerCase().includes(companyName.toLowerCase())) {
                    resSubject = `${resSubject} | ${companyName}`;
                }

                // Quality guardrail + correction pass
                let quality = evaluateEmailQuality({
                    subject: resSubject,
                    bodyHtml: resEmailBody,
                    greeting,
                    cta,
                    companyName,
                    industry,
                    services: servicesList,
                });

                if (quality.score < 70) {
                    if (!resEmailBody.toLowerCase().startsWith(greeting.toLowerCase().split(" ")[0])) {
                        resEmailBody = `<p>${greeting},</p>${resEmailBody}`;
                    }
                    if (!resEmailBody.toLowerCase().includes(cta.toLowerCase())) {
                        resEmailBody = `${resEmailBody}<p>${cta}</p>`;
                    }
                    resEmailBody = dedupeLeadingSalutation(resEmailBody);
                    resEmailBody = normalizeEmailBodyHtml(resEmailBody);
                    quality = evaluateEmailQuality({
                        subject: resSubject,
                        bodyHtml: resEmailBody,
                        greeting,
                        cta,
                        companyName,
                        industry,
                        services: servicesList,
                    });
                }

                // Strategic Metric Normalization
                const normalizeMetric = (val: any, fallback: number) => {
                    if (typeof val === 'number') return Math.min(100, Math.max(0, Math.floor(val)));
                    if (typeof val === 'string') {
                        const low = ["low", "minimal", "safe"];
                        const high = ["high", "critical", "significant"];
                        const med = ["medium", "moderate", "average"];
                        const clean = val.toLowerCase();
                        if (high.some(k => clean.includes(k))) return 85;
                        if (med.some(k => clean.includes(k))) return 50;
                        if (low.some(k => clean.includes(k))) return 15;
                        const parsed = parseInt(clean);
                        if (!isNaN(parsed)) return Math.min(100, Math.max(0, parsed));
                    }
                    return fallback;
                };

                let leadStrength = normalizeMetric(content.leadStrength, Math.max(60, quality.score));
                if (tenureYears > 2) leadStrength = Math.min(100, leadStrength + 10);
                if (client.relationshipLevel === "Active") leadStrength = Math.min(100, leadStrength + 5);
                const spamRisk = normalizeMetric(content.spamRisk, quality.spamRisk);

                return {
                    clientId: client.id,
                    clientName: client.clientName,
                    email: client.email || null,
                    contactPerson: client.contactPerson,
                    campaignType: type,
                    campaignTopic: topic,
                    generatedOutput: JSON.stringify({
                        subject: resSubject,
                        body: resEmailBody,
                        leadStrength,
                        spamRisk,
                        personalizationQuality: quality.score,
                        qualityBreakdown: {
                            personalization: quality.personalization,
                            clarity: quality.clarity,
                            tone: quality.tone,
                            ctaStrength: quality.ctaStrength,
                        },
                        qualityFixes: quality.fixes,
                        personalizationMarker: companyName
                    }),
                };
            } catch (aiError: any) {
                if (String(aiError?.message || "").includes("No AI provider keys configured")) {
                    console.warn("No Groq/OpenRouter key configured. Using template-based generation.");
                } else {
                    console.error(`AI Generation failed for client ${client.id}, falling back to template:`, aiError);
                }
                // High-fidelity personalization based on the MASTER DRAFT (topic and coreMessage)
                emailBody = replaceVariables(coreMessage, client);
                
                // If the body doesn't start with the greeting, prepend it
                if (!emailBody.toLowerCase().startsWith(greeting.toLowerCase().split(' ')[0])) {
                    emailBody = `<p>${greeting},</p>${emailBody}`;
                }
                emailBody = dedupeLeadingSalutation(emailBody);

                if (styleGuide) {
                    emailBody = replaceVariables(styleGuide.body, client);
                    subject = replaceVariables(styleGuide.subject, client);
                }

                return {
                    clientId: client.id,
                    clientName: client.clientName,
                    email: client.email || null,
                    contactPerson: client.contactPerson,
                    campaignType: type,
                    campaignTopic: topic,
                    generatedOutput: JSON.stringify({ subject, body: emailBody, leadStrength: 70, spamRisk: 5 }),
                };
            }
        }));

        // 4. Save to History and Update Last Contacted
        if (!sampleOnly && generatedCampaigns.length > 0) {
            await prisma.campaignHistory.createMany({
                data: generatedCampaigns.map(c => ({
                    clientId: c.clientId,
                    campaignType: c.campaignType,
                    campaignTopic: c.campaignTopic,
                    generatedOutput: c.generatedOutput,
                    userId: sessionUser?.id ?? null,
                })) as any
            });

            // Update lastContacted for all targeted clients
            const clientIds = targetClients.map(c => c.id).filter(Boolean);
            if (clientIds.length > 0) {
                await prisma.client.updateMany({
                    where: { id: { in: clientIds } },
                    data: { lastContacted: new Date() }
                });
            }
        }

        return ok({
            count: generatedCampaigns.length,
            sample: sampleOnly ? generatedCampaigns[0] : null,
            aiRouting: lastAiRouting
        });
    } catch (err) {
        console.error("AI Generation failed:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}

