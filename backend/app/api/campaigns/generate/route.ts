import prisma from "@/backend/lib/prisma";
import Groq from "groq-sdk";
import { getGlobalSettings } from "@/backend/lib/settings";
import { ok, error } from "@/backend/lib/api-response";
import { getSmartGreeting, replaceVariables } from "@/shared/lib/utils";
import { z } from "zod";
import { getTargetClients } from "@/backend/domain/campaigns";
import { dedupeLeadingSalutation, normalizeEmailBodyHtml } from "@/shared/lib/email-format";
import { evaluateEmailQuality } from "@/shared/lib/campaign-quality";
import { hasInvoiceAccess } from "@/backend/lib/auth";

const generateCampaignSchema = z.object({
    audienceSource: z.enum(["INVOICE_SYSTEM", "ZOHO_BIGIN", "GMAIL"]).optional(),
    audienceSources: z.array(z.enum(["INVOICE_SYSTEM", "ZOHO_BIGIN", "GMAIL"])).optional(),
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
});

export async function POST(request: Request) {
    try {
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
        if (!payload.sampleOnly) {
            const job = await (prisma as any).job.create({
                data: {
                    type: "CAMPAIGN_GENERATE",
                    status: "QUEUED",
                    progress: 0,
                    payload,
                },
            });

            return ok({ jobId: job.id }, { status: 202 });
        }

        const { audienceSource, audienceSources, type, topic, coreMessage, cta, sampleOnly, clientId, styleGuide, styleMemory, excludedClientIds, serviceFilters, serviceLogic } = payload;
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

        // --- Strategic Credential Retrieval ---
        const aiProvider = settings.aiProvider || "Groq";
        const apiKey = aiProvider === "Groq" ? settings.groqApiKey : settings.openaiApiKey;

        // 2. Fetch Target Clients
        let targetClients: any[] = [];
        
        if (sampleOnly && clientId) {
            // Specific client requested for sample
            const client = await prisma.client.findFirst({
                where: { id: clientId, source: { in: resolvedSources as any } },
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
            const allTargets = await getTargetClients(resolvedSources as any, type, serviceFilters, serviceLogic, excludedClientIds);
            
            if (sampleOnly) {
                // Pick one "random" (first) client for the sample
                targetClients = allTargets.length > 0 ? [allTargets[0]] : [];
            } else {
                // Batch processing (Safety limit 50)
                targetClients = allTargets.slice(0, 50);
            }
        }

        // 3. AI Generation Logic (Multi-Provider Integration)
        const isApiKeyConfigured = apiKey && apiKey !== "your_groq_api_key_here" && apiKey !== "your_openai_api_key_here";
        const useMock = !isApiKeyConfigured;

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

            if (useMock) {
                console.warn(`${aiProvider} API key not configured. Falling back to mock generation.`);
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
            } else {
                try {
                    const stylePrompt = styleGuide
                        ? `
                        STYLE BLUEPRINT (HIGHEST PRIORITY):
                        - Use this edited sample as the reference style for voice, sentence rhythm, and section flow.
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
                        3. SMART VARIABLE INJECTION: Replace placeholders like {{firstName}}, {{lastName}}, {{fullName}}, {{companyName}}, {{industry}}, {{services}}, {{location}}, {{relationship}}, {{tenureYears}} with corresponding client data.
                        4. SEAMLESS FLOW: Weave in the client's sector (${client.industry}) context where it feels natural based on the draft's logic.
                        5. CTA ENFORCEMENT: Include a clear closing action aligned with REQUIRED CTA.
                        6. GLOBAL EMAIL STANDARDS:
                           - Use short paragraphs (2-4 lines max), clean spacing, and professional business tone.
                           - Keep message concise, value-first, and avoid hype/salesy language.
                           - Include one clear CTA and polite professional close.
                           - Greeting fallback order: contact name -> email local-part -> signature name -> "Dear Sir/Ma'am".
                           - Respect style memory hints when available (directness, concise wording, CTA style).
                           - NEVER mention or sign off with any specific company/brand name; use a generic sign-off (e.g., "Best regards,") only.
                           - If client details are missing (name, industry, services, relationship history), do NOT reference them. Write a complete email using only the topic/coreMessage/CTA.
                           - Do NOT write meta/instructional phrasing like "Your task is", "We have been provided", or "In summary".
                           - Write like a human advisor: avoid repeating the same sentence starters; avoid overly structured checklists.
                        7. HTML FORMAT: Return a valid HTML segment for the body. Preserve any formatting from the draft.
                        ${stylePrompt}
                        
                        OUTPUT: Return a PURE JSON object with "subject" and "body" fields.
                    `;

                    let content: any = {};

                    if (aiProvider === "Groq") {
                        const groq = new Groq({ apiKey });
                        const chatCompletion = await groq.chat.completions.create({
                            messages: [
                                { role: "system", content: "You are a strategic marketing AI that outputs ONLY pure JSON. For metrics like leadStrength and spamRisk, ALWAYS use integers between 0 and 100." },
                                { role: "user", content: prompt }
                            ],
                            model: settings.aiModel,
                            response_format: { type: "json_object" },
                            temperature: 0.7,
                        });
                        content = JSON.parse(chatCompletion.choices[0].message.content || "{}");
                    } else if (aiProvider === "OpenAI") {
                        const OpenAI = (await import("openai")).default;
                        const openai = new OpenAI({ apiKey });
                        const chatCompletion = await openai.chat.completions.create({
                            messages: [
                                { role: "system", content: "You are a strategic marketing AI that outputs ONLY pure JSON. For metrics like leadStrength and spamRisk, ALWAYS use integers between 0 and 100." },
                                { role: "user", content: prompt }
                            ],
                            model: settings.aiModel,
                            response_format: { type: "json_object" },
                        });
                        content = JSON.parse(chatCompletion.choices[0].message.content || "{}");
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

                    let resSubject = content.subject || subject;
                    let resEmailBody = content.body || "";
                    
                    // Smart Sanitization: Strip markdown code blocks if the AI ignored instructions
                    if (resEmailBody.includes("```")) {
                        resEmailBody = resEmailBody.replace(/```html\n?|```\n?/g, "").trim();
                    }

                    // Ensure variable placeholders from sample are resolved for this client.
                    resSubject = replaceVariables(resSubject, client);
                    resEmailBody = replaceVariables(resEmailBody, client);
                    // Never leak unresolved template variables in final output.
                    resSubject = resSubject.replace(/\{\{[^}]+\}\}/g, companyName);
                    resEmailBody = resEmailBody.replace(/\{\{[^}]+\}\}/g, "your team");

                    // Enforce greeting at start for personalization quality.
                    const lowerBody = resEmailBody.toLowerCase().trim();
                    if (!lowerBody.startsWith(greeting.toLowerCase().split(" ")[0])) {
                        resEmailBody = `<p>${greeting},</p>${resEmailBody}`;
                    }
                    resEmailBody = dedupeLeadingSalutation(resEmailBody);

                    // Enforce CTA presence if missing from body.
                    const ctaNeedle = cta.toLowerCase().trim();
                    if (ctaNeedle && !resEmailBody.toLowerCase().includes(ctaNeedle)) {
                        resEmailBody = `${resEmailBody}<p>${cta}</p>`;
                    }

                    // Ensure at least one unique personalization marker exists.
                    const lowerPersonal = resEmailBody.toLowerCase();
                    const hasMarker =
                        lowerPersonal.includes(companyName.toLowerCase()) ||
                        lowerPersonal.includes(industry.toLowerCase()) ||
                        (servicesList && lowerPersonal.includes(String(servicesList).split(",")[0].trim().toLowerCase()));
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
                        // Lightweight deterministic correction pass for weak drafts
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

                    // Logic Boost: Relationship-weighted lead strength
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
                } catch (err) {
                    console.error(`AI Generation failed for client ${client.id}, falling back to template:`, err);
                    const fallbackBody = normalizeEmailBodyHtml(
                        dedupeLeadingSalutation(
                            `<p>${greeting},</p><p>Regarding <strong>${topic}</strong> for ${companyName} (${industry}):</p><p>${replaceVariables(coreMessage, client)}</p><p>${cta}</p>`
                        )
                    );
                    const fallbackQuality = evaluateEmailQuality({
                        subject,
                        bodyHtml: fallbackBody,
                        greeting,
                        cta,
                        companyName,
                        industry,
                        services: servicesList,
                    });

                    return {
                        clientId: client.id,
                        clientName: client.clientName,
                        email: client.email || null,
                        contactPerson: client.contactPerson,
                        campaignType: type,
                        campaignTopic: topic,
                        generatedOutput: JSON.stringify({
                            subject,
                            body: fallbackBody,
                            leadStrength: Math.max(50, fallbackQuality.score),
                            spamRisk: fallbackQuality.spamRisk,
                            personalizationQuality: fallbackQuality.score,
                            qualityBreakdown: {
                                personalization: fallbackQuality.personalization,
                                clarity: fallbackQuality.clarity,
                                tone: fallbackQuality.tone,
                                ctaStrength: fallbackQuality.ctaStrength,
                            },
                            qualityFixes: fallbackQuality.fixes,
                            personalizationMarker: companyName
                        }),
                    };
                }
            }
        }));

        // 4. Save to History and Update Last Contacted
        if (!sampleOnly && generatedCampaigns.length > 0) {
            await prisma.campaignHistory.createMany({
                data: generatedCampaigns.map(c => ({
                    clientId: c.clientId,
                    campaignType: c.campaignType,
                    campaignTopic: c.campaignTopic,
                    generatedOutput: c.generatedOutput
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
            sample: sampleOnly ? generatedCampaigns[0] : null
        });
    } catch (err) {
        console.error("AI Generation failed:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}
