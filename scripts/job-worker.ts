import prisma from "../lib/prisma";
import { getGlobalSettings } from "../services/settings";
import { getTargetClients } from "../services/domain/campaigns";
import { getSmartGreeting, replaceVariables } from "../lib/shared/utils";
import { dedupeLeadingSalutation, normalizeEmailBodyHtml } from "../lib/shared/email-format";
import { wrapInEmailTemplate } from "../lib/shared/email-template";
import { sanitizeEmailHtml } from "../lib/shared/email-sanitize";
import { evaluateEmailQuality } from "../lib/shared/campaign-quality";
import { createStrategicGmailDraft, sendStrategicEmail } from "../services/mail";
import { parseCampaignGeneratedOutput } from "../lib/shared/campaign-output";

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
import { runGmailSync } from "../services/workers/gmail-sync";
import { runAiWithFallback } from "../services/ai-router";

type JobRow = {
  id: string;
  type: string;
  status: string;
  progress: number;
  payload: any;
};

const POLL_INTERVAL_MS = Number(process.env.JOB_POLL_INTERVAL_MS ?? 1500);
const MAX_CONCURRENT_JOBS = 1; // Only one batch job at a time to save DB pool
const MAX_GENERATE_CLIENT_CONCURRENCY = 2; // Low concurrency to avoid session pool exhaustion

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;

  return await new Promise<R[]>((resolve, reject) => {
    const runNext = () => {
      if (nextIndex >= items.length && active === 0) {
        resolve(results);
        return;
      }

      while (active < limit && nextIndex < items.length) {
        const i = nextIndex++;
        active++;
        fn(items[i], i)
          .then((r) => {
            results[i] = r;
            active--;
            runNext();
          })
          .catch((e) => reject(e));
      }
    };

    runNext();
  });
}

async function claimNextJob(): Promise<JobRow | null> {
  const job = await (prisma as any).job.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  if (!job) return null;

  const now = new Date();
  const claimed = await (prisma as any).job.updateMany({
    where: { id: job.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      lockedAt: now,
      startedAt: now,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count !== 1) return null;
  return job as JobRow;
}

async function setJobFailed(jobId: string, err: any) {
  const message = typeof err?.message === "string" ? err.message : String(err || "Unknown error");
  await (prisma as any).job.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      error: message,
    },
  });
}

async function setJobSucceeded(jobId: string, result: any, progress = 100) {
  await (prisma as any).job.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      progress,
      result,
      error: null,
    },
  });
}

async function runCampaignGenerate(job: JobRow) {
  const payload = job.payload;

  // Job payload is created from the route handler (already validated),
  // so we assume structure is correct here.
  const {
    audienceSource,
    audienceSources,
    type,
    topic,
    coreMessage,
    cta,
    clientId,
    styleGuide,
    styleMemory,
    excludedClientIds,
    serviceFilters = [],
    serviceLogic = "OR",
    sampleClientId,
    _userId,
  } = payload as any;

  const jobUserId: string | null = _userId ? String(_userId) : null;

  const resolvedSources: Array<"INVOICE_SYSTEM" | "ZOHO_BIGIN" | "GMAIL"> =
    Array.isArray(audienceSources) && audienceSources.length > 0
      ? audienceSources
      : audienceSource
        ? [audienceSource]
        : [];

  if (resolvedSources.length === 0) {
    throw new Error("Audience source is required for campaign generation jobs.");
  }

  const settings = await getGlobalSettings();

  const targetClients: any[] = [];
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, source: { in: resolvedSources as any } },
      select: {
        id: true,
        clientName: true,
        industry: true,
        contactPerson: true,
        relationshipLevel: true,
        clientAddedOn: true,
        lastInvoiceDate: true,
        invoiceServiceNames: true,
      },
    });
    if (client) targetClients.push(client);
  }

  let clients = targetClients;

  if (clients.length === 0) {
    if (clientId) {
      // If a specific client was requested but not found in the source, don't fallback to others
      console.warn(`[job-worker] Requested clientId ${clientId} not found in sources ${resolvedSources}`);
      return { count: 0 };
    }
    // Only fallback to batch if no specific clientId was requested
    clients = (await getTargetClients(resolvedSources as any, type, serviceFilters, serviceLogic, excludedClientIds || [], false)).slice(0, 50);
  }

  console.log(`[job-worker] Starting generation for ${clients.length} clients...`);

  if (clients.length === 0) {
    return { count: 0 };
  }

  const generatedCampaignIds: string[] = [];
  const generatedCampaigns = await mapLimit(clients, MAX_GENERATE_CLIENT_CONCURRENCY, async (client, idx) => {
    // Scrub hardcoded sample names from templates if sampleClientId is provided
    let localTopic = topic;
    let localCoreMessage = coreMessage;
    let localStyleGuide = styleGuide ? { ...styleGuide } : null;
    let nameToScrub = "";

    if (sampleClientId) {
      const sampleClient = await prisma.client.findUnique({ where: { id: sampleClientId } });
      if (sampleClient) {
        nameToScrub = sampleClient.contactPerson || sampleClient.clientName || "";

        const scrub = (text: string) => {
          if (!text || !nameToScrub) return text;
          return scrubLiteralName(text, nameToScrub);
        };

        localTopic = scrub(localTopic);
        localCoreMessage = scrub(localCoreMessage);
        if (localStyleGuide) {
          localStyleGuide.subject = scrub(localStyleGuide.subject);
          localStyleGuide.body = scrub(localStyleGuide.body);
        }
      }
    }

    const servicesList = client.invoiceServiceNames || "your business infrastructure";
    const greeting = getSmartGreeting(client.contactPerson || client.poc, {
      email: client.email,
      signature: client.emailSignature || client.signature || client.signatureName,
    });

    const now = new Date();
    const addedOn = client.clientAddedOn ? new Date(client.clientAddedOn) : null;
    const tenureYears = addedOn ? now.getFullYear() - addedOn.getFullYear() : 0;
    const relationshipDepth = tenureYears > 3 ? "Deep Legacy" : tenureYears > 1 ? "Established Partnership" : "New Engagement";

    const lastInvoice = client.lastInvoiceDate ? new Date(client.lastInvoiceDate) : null;
    const lastActivity = lastInvoice
      ? `Last significant engagement: ${lastInvoice.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
      : "Ongoing relationship";

    const firstName =
      (client.contactPerson || client.poc || "")
        .replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Prof\.?)\s+/i, "")
        .split(/\s+/)
        .filter(Boolean)[0] || "";
    const companyName = client.clientName || "your company";
    const industry = client.industry || "your industry";

    let subject = replaceVariables(localTopic || `Strategic Perspective for {{companyName}}`, client);
    let emailBodyHtml = "";

    let resSubject = subject;
    let resEmailBody = "";

    const relationshipContext = `
                        INSTITUTIONAL INTELLIGENCE:
                        - RELATIONSHIP DEPTH: ${relationshipDepth} (${tenureYears} years of collaboration).
                        - LAST ACTIVITY: ${lastActivity}.
                        - STATUS: ${client.relationshipLevel}.
                        
                        ADAPT YOUR HOOK: If they are a ${relationshipDepth} client, acknowledge the legacy and shared history. If they are ${client.relationshipLevel} "Past Client", position this as a "New Chapter" bridge.
                    `;

    const objectiveContexts: Record<string, string> = {
      Broadcast:
        "GOAL: Strategic wide-angle synchronization. Focus on high-level corporate shifts, new infrastructure, or vision pivots. The tone should be institutional yet authoritative.",
      Targeted:
        "GOAL: High-precision value sharing. Focus on a specific milestone or exclusive resource that directly aligns with the recipient's industry position. The tone should be highly personalized and exclusive.",
      "Cross-Sell":
        "GOAL: Capacity expansion. Identify a likely 'friction point' in their current setup that our other services (${servicesList}) could solve. Position this as an integrated evolution, not a pitch.",
      Reactivation:
        "GOAL: Re-igniting a dormant partnership. Reference previous successes and acknowledge the 'new chapter' or capability shift that makes a dialogue relevant now. The tone should be nostalgic yet forward-looking.",
    };

    if (localStyleGuide) {
      // STRICT LOGIC: If user provided a style guide (edited sample), 
      // we MUST NOT use AI for generation to ensure 100% structural matching.
      resSubject = replaceVariables(localStyleGuide.subject, client);
      resEmailBody = replaceVariables(localStyleGuide.body, client);
    } else {
      // AI Logic: ONLY if no styleGuide is provided
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
                          
                          MASTER SUBJECT: "${localTopic}"
                          MASTER BODY: "${localCoreMessage}"
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
                             - Do NOT use meta/instructional phrasing like "Your task is", "We have been provided", "In summary".
                             - Write like a human advisor: avoid repeating the same sentence starters and avoid overly structured checklists.
                          7. HTML FORMAT: Return a valid HTML segment for the body. Preserve any formatting from the draft.
                          
                          OUTPUT: Return a PURE JSON object with "subject" and "body" fields.
      `;
      // ... (AI call continues)
      
      try {
        const aiPromise = runAiWithFallback({
          messages: [
            { role: "system", content: "You are a strategic marketing AI that outputs ONLY pure JSON. For metrics like leadStrength and spamRisk, ALWAYS use integers between 0 and 100." },
            { role: "user", content: prompt },
          ],
          modelOverride: settings.aiModel,
          responseFormat: "json_object",
          temperature: 0.7,
        });

        // Add 25s timeout to AI call
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("AI generation timed out")), 25000)
        );

        const aiResult = (await Promise.race([aiPromise, timeoutPromise])) as any;

        const rawContent = aiResult.content || "{}";
        const content = JSON.parse(rawContent);
        
        resSubject = content.subject || subject;
        resEmailBody = content.body || "";

        // SECONDARY SCRUB: If AI leaked the sample name despite instructions
        if (nameToScrub) {
          resSubject = scrubLiteralName(resSubject, nameToScrub);
          resEmailBody = scrubLiteralName(resEmailBody, nameToScrub);
          // Run replaceVariables again just in case scrub added new {{vars}}
          resSubject = replaceVariables(resSubject, client);
          resEmailBody = replaceVariables(resEmailBody, client);
        }

        // If AI returned empty body, trigger fallback
        if (!resEmailBody || resEmailBody.length < 10) {
            throw new Error("AI returned empty or insufficient content");
        }
      } catch (err: any) {
        if (String(err?.message || "").includes("No AI provider keys configured")) {
          console.warn(`[job-worker] No Groq/OpenRouter key found. Using deterministic fallback for client ${client.id}.`);
        } else {
          console.error(`[job-worker] AI generation failed for client ${client.id}:`, err);
        }
        // DETERMINISTIC FALLBACK: Use the master draft but still personalize variables
        resSubject = replaceVariables(localTopic, client);
        resEmailBody = replaceVariables(localCoreMessage, client);
        
        // Ensure greeting is at start even in fallback
        if (!resEmailBody.toLowerCase().trim().startsWith(greeting.toLowerCase().split(" ")[0])) {
            resEmailBody = `<p>${greeting},</p>${resEmailBody}`;
        }
      }
    }

    // Smart Sanitization: Strip markdown code fences if the AI (or user edit) ignored instructions
    if (resEmailBody.includes("```")) {
      resEmailBody = resEmailBody.replace(/```html\n?|```\n?/g, "").trim();
    }

    // Final variable resolution pass to catch any missed placeholders (Final Safety Net)
    resSubject = replaceVariables(resSubject, client);
    resEmailBody = replaceVariables(resEmailBody, client);

    // Enforce greeting at start for personalization quality (if missing).
    const lowerBody = resEmailBody.toLowerCase().trim();
    if (!lowerBody.startsWith(greeting.toLowerCase().split(" ")[0]) && !lowerBody.startsWith("<p>" + greeting.toLowerCase().split(" ")[0])) {
      resEmailBody = `<p>${greeting},</p>${resEmailBody}`;
    }
    resEmailBody = dedupeLeadingSalutation(resEmailBody);

    // Global-standard formatting normalization (paragraphs, spacing, lists)
    resEmailBody = normalizeEmailBodyHtml(resEmailBody);

    // Subject fallback hardening: keep it specific and personalized.
    if (!resSubject || resSubject.trim().length < 6) {
      resSubject = firstName ? `${firstName}, quick idea for ${companyName}` : `Quick idea for ${companyName}`;
    }
    if (!/{{|}}/.test(resSubject) && !resSubject.toLowerCase().includes(companyName.toLowerCase())) {
      resSubject = `${resSubject} | ${companyName}`;
    }

    // Quality guardrail + metrics logic
    const quality = evaluateEmailQuality({
      subject: resSubject,
      bodyHtml: resEmailBody,
      greeting,
      cta,
      companyName,
      industry,
      services: servicesList,
    });

    const normalizeMetric = (val: any, fallback: number) => {
      if (typeof val === "number") return Math.min(100, Math.max(0, Math.floor(val)));
      if (typeof val === "string") {
        const low = ["low", "minimal", "safe"];
        const high = ["high", "critical", "significant"];
        const med = ["medium", "moderate", "average"];

        const clean = val.toLowerCase();
        if (high.some((k) => clean.includes(k))) return 85;
        if (med.some((k) => clean.includes(k))) return 50;
        if (low.some((k) => clean.includes(k))) return 15;

        const parsed = parseInt(clean);
        if (!isNaN(parsed)) return Math.min(100, Math.max(0, parsed));
      }
      return fallback;
    };

    let leadStrength = normalizeMetric(60, Math.max(60, quality.score));
    if (tenureYears > 2) leadStrength = Math.min(100, leadStrength + 10);
    if (client.relationshipLevel === "Active") leadStrength = Math.min(100, leadStrength + 5);

    const campaignData = {
      clientId: client.id,
      clientName: client.clientName,
      contactPerson: client.contactPerson,
      campaignType: type,
      campaignTopic: topic,
      generatedOutput: JSON.stringify({
        subject: resSubject,
        body: resEmailBody,
        leadStrength,
        spamRisk: quality.spamRisk,
        personalizationQuality: quality.score,
        qualityBreakdown: {
          personalization: quality.personalization,
          clarity: quality.clarity,
          tone: quality.tone,
          ctaStrength: quality.ctaStrength,
        },
        qualityFixes: quality.fixes,
        personalizationMarker: companyName,
      }),
    };

    // ONE-BY-ONE PERSISTENCE: Save immediately so frontend can stream results
    try {
      const savedCampaign = await (prisma as any).campaignHistory.create({
        data: {
          clientId: campaignData.clientId,
          campaignType: campaignData.campaignType,
          campaignTopic: campaignData.campaignTopic,
          generatedOutput: campaignData.generatedOutput,
          ...(jobUserId && { userId: jobUserId }),
        },
      });

      if (savedCampaign?.id) {
        generatedCampaignIds.push(String(savedCampaign.id));
      }

      // Update client lastContacted
      await (prisma as any).client.update({
        where: { id: client.id },
        data: { lastContacted: new Date() },
      });

      // Update job progress
      const currentProgress = Math.round(((idx + 1) / clients.length) * 100);
      await (prisma as any).job.update({
        where: { id: job.id },
        data: {
          progress: currentProgress,
          result: {
            count: generatedCampaignIds.length,
            generatedCampaignIds,
          },
        },
      });
    } catch (dbErr) {
      console.error(`[job-worker] Failed to save campaign for client ${client.id}:`, dbErr);
    }

    return campaignData;
  });

  const jobResult = {
    count: generatedCampaigns.length,
    generatedCampaignIds,
  };

  return jobResult;
}

async function runDispatchBatch(job: JobRow) {
  const payload = job.payload as any;
  const campaignIds: string[] = Array.isArray(payload?.campaignIds) ? payload.campaignIds : [];
  const dispatchMode: "SEND" | "DRAFT" = payload?.dispatchMode === "DRAFT" ? "DRAFT" : "SEND";
  const userId = payload?.userId ? String(payload.userId) : null;

  if (!userId) {
    console.warn("[job-worker] Dispatch batch started without explicit userId. Falling back to default identity.");
  }

  const total = campaignIds.length;
  let successCount = 0;
  const failures: Array<{ campaignId: string; error: string }> = [];

  for (let i = 0; i < campaignIds.length; i++) {
    const campaignId = campaignIds[i];
    try {
      const campaign = await prisma.campaignHistory.findUnique({
        where: { id: campaignId },
        include: { client: true },
      });

      if (!campaign || !campaign.client || !campaign.client.email) {
        throw new Error("Campaign client email missing.");
      }

      const parsedOutput = parseCampaignGeneratedOutput(campaign.generatedOutput);
      const { subject, body } = parsedOutput;

      const normalizedBody = sanitizeEmailHtml(normalizeEmailBodyHtml(body));
      const synchronizedBody = replaceVariables(normalizedBody, campaign.client);

      const htmlBody = wrapInEmailTemplate("standard", synchronizedBody, campaign.client.clientName);

      console.log(`[job-worker] Dispatching campaign ${campaignId} to ${campaign.client.email} (Mode: ${dispatchMode})`);

      const existingDraftId = (campaign as any).gmailDraftId || undefined;

      const result = dispatchMode === "DRAFT"
        ? await createStrategicGmailDraft({
            to: campaign.client.email,
            subject,
            html: htmlBody,
            text: body.replace(/<[^>]*>/g, ""),
          }, { userId: payload?.userId, existingDraftId })
        : await sendStrategicEmail({
            to: campaign.client.email,
            subject,
            html: htmlBody,
            text: body.replace(/<[^>]*>/g, ""),
          }, { userId: payload?.userId });

      if (!result.success) {
        console.error(`[job-worker] Dispatch failed for campaign ${campaignId}:`, result.error);
        throw new Error(result.error || "Email dispatch failed.");
      }

      console.log(`[job-worker] Dispatch successful for campaign ${campaignId}. MessageId: ${result.messageId}`);

      // Store Gmail draft ID so "Update Draft" can reuse the same draft instead of creating a new one
      if (dispatchMode === "DRAFT" && (result as any).draftId) {
        await (prisma as any).campaignHistory.update({
          where: { id: campaignId },
          data: { gmailDraftId: (result as any).draftId },
        }).catch((err: any) => console.warn(`[job-worker] Failed to store draftId for ${campaignId}:`, err));
      }

      // Smart Rate Limiting: 150ms delay to prevent burst issues
      await sleep(150);

      successCount++;
    } catch (e: any) {
      const message = e?.message ? String(e.message) : "Dispatch failed.";
      failures.push({ campaignId, error: message });
    }

    const progress = Math.round(((i + 1) / total) * 100);
    await (prisma as any).job.update({
      where: { id: job.id },
      data: { progress },
    });
  }

  return {
    mode: dispatchMode,
    total,
    successCount,
    failureCount: failures.length,
    failedCampaignIds: failures.map((f) => f.campaignId),
    failures,
  };
}

async function runGmailImport(job: JobRow) {
  const payload = job.payload as any;
  const accountId: string = String(payload?.accountId || "");
  const options = payload?.options || undefined;
  const cleanupMode = payload?.cleanupMode || "none";
  return await runGmailSync(accountId, options, cleanupMode);
}

async function main() {
  console.log(`[job-worker] starting with MAX_CONCURRENT_JOBS=${MAX_CONCURRENT_JOBS}`);

  const active = new Set<string>();

  while (true) {
    try {
      while (active.size < MAX_CONCURRENT_JOBS) {
        const job = await claimNextJob();
        if (!job) break;
        active.add(job.id);

        // Fire and forget with tracking
        (async () => {
          try {
            if (job.type === "CAMPAIGN_GENERATE") {
              console.log(`[job-worker] Executing CAMPAIGN_GENERATE for job ${job.id}`);
              const result = await runCampaignGenerate(job);
              await setJobSucceeded(job.id, result);
              console.log(`[job-worker] CAMPAIGN_GENERATE finished for job ${job.id}`);
            } else if (job.type === "CAMPAIGN_DISPATCH_BATCH") {
              const result = await runDispatchBatch(job);
              if (result && result.successCount === 0 && result.total > 0) {
                await setJobFailed(job.id, new Error(result.failures?.[0]?.error || "No emails were successfully sent. Check your SMTP/Gmail configuration."));
              } else {
                await setJobSucceeded(job.id, result);
              }
            } else if (job.type === "GMAIL_IMPORT") {
              const result = await runGmailImport(job);
              await setJobSucceeded(job.id, result);
            } else {
              throw new Error(`Unknown job type: ${job.type}`);
            }
          } catch (err: any) {
            await setJobFailed(job.id, err);
          } finally {
            active.delete(job.id);
          }
        })();
      }

      await sleep(POLL_INTERVAL_MS);
    } catch (err: any) {
      console.error("[job-worker] loop error:", err);
      await sleep(5000);
    }
  }
}

main().catch((e) => {
  console.error("[job-worker] fatal error:", e);
  process.exit(1);
});
