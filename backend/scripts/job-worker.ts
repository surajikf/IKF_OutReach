import prisma from "../lib/prisma.ts";
import { getGlobalSettings } from "../lib/settings.ts";
import { getTargetClients } from "../domain/campaigns.ts";
import { getSmartGreeting, replaceVariables } from "../shared/lib/utils.ts";
import { dedupeLeadingSalutation, normalizeEmailBodyHtml } from "../shared/lib/email-format.ts";
import { wrapInEmailTemplate } from "../shared/lib/email-template.ts";
import { sanitizeEmailHtml } from "../shared/lib/email-sanitize.ts";
import { evaluateEmailQuality } from "../shared/lib/campaign-quality.ts";
import { sendStrategicEmail } from "../lib/mail.ts";
import { parseCampaignGeneratedOutput } from "../shared/lib/campaign-output.ts";

import Groq from "groq-sdk";

type JobRow = {
  id: string;
  type: string;
  status: string;
  progress: number;
  payload: any;
};

const POLL_INTERVAL_MS = Number(process.env.JOB_POLL_INTERVAL_MS ?? 1500);
const MAX_CONCURRENT_JOBS = Number(process.env.JOB_MAX_CONCURRENT_JOBS ?? 2);
const MAX_GENERATE_CLIENT_CONCURRENCY = Number(process.env.JOB_MAX_GENERATE_CLIENT_CONCURRENCY ?? 3);

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
  } = payload as any;

  const settings = await getGlobalSettings();
  const aiProvider = settings.aiProvider || "Groq";
  const apiKey = aiProvider === "Groq" ? settings.groqApiKey : settings.openaiApiKey;

  const isApiKeyConfigured =
    apiKey && apiKey !== "your_groq_api_key_here" && apiKey !== "your_openai_api_key_here";
  const useMock = !isApiKeyConfigured;

  const targetClients: any[] = [];
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
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

  const clients =
    targetClients.length > 0
      ? targetClients
      : (await getTargetClients(type, serviceFilters, serviceLogic, excludedClientIds || [], false)).slice(0, 50);

  if (clients.length === 0) {
    return { count: 0 };
  }

  // Create AI client once per job (faster than per-client instantiation).
  let groq: any = null;
  let openai: any = null;
  if (!useMock) {
    if (aiProvider === "Groq") {
      groq = new Groq({ apiKey });
    } else {
      const OpenAI = (await import("openai")).default;
      openai = new OpenAI({ apiKey });
    }
  }

  const generatedCampaigns = await mapLimit(clients, MAX_GENERATE_CLIENT_CONCURRENCY, async (client, idx) => {
    const servicesList = client.invoiceServiceNames || "your business infrastructure";
    const greeting = getSmartGreeting(client.contactPerson || client.poc);

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

    let subject = replaceVariables(topic || `Strategic Perspective for {{companyName}}`, client);
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

    if (styleGuide) {
      // STRICT LOGIC: If user provided a style guide (edited sample), 
      // we MUST NOT use AI for generation to ensure 100% structural matching.
      resSubject = replaceVariables(styleGuide.subject, client);
      resEmailBody = replaceVariables(styleGuide.body, client);
    } else if (useMock) {
      resEmailBody = replaceVariables(coreMessage, client);
      if (!resEmailBody.toLowerCase().startsWith(greeting.toLowerCase().split(" ")[0])) {
        resEmailBody = `<p>${greeting},</p>${resEmailBody}`;
      }
      resEmailBody = dedupeLeadingSalutation(resEmailBody);

      // Lightweight metrics for mock generation.
      return {
        clientId: client.id,
        clientName: client.clientName,
        contactPerson: client.contactPerson,
        campaignType: type,
        campaignTopic: topic,
        generatedOutput: JSON.stringify({
          subject: replaceVariables(resSubject, client),
          body: resEmailBody,
          leadStrength: 70,
          spamRisk: 5,
        }),
      };
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
                             - If contact name is unavailable, use "Dear Sir/Ma'am".
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
        const chatCompletion = await (aiProvider === "Groq" ? groq : openai).chat.completions.create({
          messages: [
            { role: "system", content: "You are a strategic marketing AI that outputs ONLY pure JSON. For metrics like leadStrength and spamRisk, ALWAYS use integers between 0 and 100." },
            { role: "user", content: prompt },
          ],
          model: settings.aiModel,
          response_format: { type: "json_object" },
          temperature: 0.7,
        });
        
        const rawContent = chatCompletion.choices[0].message.content || "{}";
        const content = JSON.parse(rawContent);
        
        resSubject = content.subject || subject;
        resEmailBody = content.body || "";

        // If AI returned empty body, trigger fallback
        if (!resEmailBody || resEmailBody.length < 10) {
            throw new Error("AI returned empty or insufficient content");
        }
      } catch (err) {
        console.error(`[job-worker] AI generation failed for client ${client.id}:`, err);
        // DETERMINISTIC FALLBACK: Use the master draft but still personalize variables
        resSubject = replaceVariables(subject, client);
        resEmailBody = replaceVariables(coreMessage, client);
        
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

    return {
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
  });

  const jobResult = {
    count: generatedCampaigns.length,
  };

  // Persist only for batch jobs (the queued ones always represent batch generation).
  const clientIds = clients.map((c) => c.id).filter(Boolean);

  if (generatedCampaigns.length > 0) {
    await (prisma as any).campaignHistory.createMany({
      data: generatedCampaigns.map((c: any) => ({
        clientId: c.clientId,
        campaignType: c.campaignType,
        campaignTopic: c.campaignTopic,
        generatedOutput: c.generatedOutput,
      })),
    });

    if (clientIds.length > 0) {
      await (prisma as any).client.updateMany({
        where: { id: { in: clientIds } },
        data: { lastContacted: new Date() },
      });
    }
  }

  return jobResult;
}

async function runDispatchBatch(job: JobRow) {
  const payload = job.payload as any;
  const campaignIds: string[] = Array.isArray(payload?.campaignIds) ? payload.campaignIds : [];

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

      const result = await sendStrategicEmail({
        to: campaign.client.email,
        subject,
        html: htmlBody,
        text: body.replace(/<[^>]*>/g, ""),
      });

      if (!result.success) {
        throw new Error(result.error || "Email dispatch failed.");
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

  // 1) Fetch Gmail account and ensure access token.
  const account = await prisma.gmailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error("Gmail account not found.");
  }

  // Use the same logic as the route handler: refresh if needed.
  // Note: we keep this worker logic self-contained (no auth).
  const { decrypt, encrypt } = await import("../lib/encryption.ts");
  const accessTokenDecrypted = decrypt(account.accessTokenEncrypted || "");

  let accessToken = accessTokenDecrypted;

  if (!accessToken || !account.expiresAt || account.expiresAt < new Date()) {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings?.googleClientIdEncrypted || !settings?.googleClientSecretEncrypted) {
      throw new Error("Google OAuth credentials missing in Global Settings.");
    }

    const clientId = decrypt(settings.googleClientIdEncrypted);
    const clientSecret = decrypt(settings.googleClientSecretEncrypted);
    const refreshToken = decrypt(account.refreshTokenEncrypted);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(`Gmail token refresh failed: ${tokens?.error_description || tokens?.error || "Unknown error"}`);
    }

    accessToken = tokens.access_token;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: {
        accessTokenEncrypted: encrypt(accessToken),
        expiresAt,
      },
    });
  }

  // 2) Fetch recent messages
  const messagesRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40&q=after:2024/01/01`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!messagesRes.ok) {
    throw new Error("Failed to read Gmail messages.");
  }

  const { messages = [] } = await messagesRes.json();

  // 3) Extract headers (From/To) with concurrency limit for speed.
  const contacts = new Map<string, { email: string; name: string }>();

  const parseEmailHeader = (headerValue: string): { email: string; name: string }[] => {
    const parts = headerValue.split(",");
    const out: { email: string; name: string }[] = [];
    parts.forEach((part) => {
      const emailMatch = part.match(/<(.+@.+)>/);
      const email = emailMatch ? emailMatch[1].trim() : part.trim();

      if (email.includes("@")) {
        let name = "";
        if (emailMatch) {
          name = part.replace(emailMatch[0], "").replace(/["']/g, "").trim();
        }
        out.push({ email, name });
      }
    });
    return out;
  };

  const detailItems = await mapLimit(messages, 5, async (msg: any) => {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!detailRes.ok) return null;
    return await detailRes.json();
  });

  for (const detail of detailItems) {
    const headers = detail?.payload?.headers || [];
    headers.forEach((h: any) => {
      const results = parseEmailHeader(h.value);
      results.forEach((res: any) => {
        const emailLower = String(res.email || "").toLowerCase();
        if (
          emailLower &&
          emailLower !== String(account.email || "").toLowerCase() &&
          !emailLower.includes("@noreply") &&
          !emailLower.includes("google.com")
        ) {
          contacts.set(emailLower, { email: emailLower, name: res.name });
        }
      });
    });
  }

  // 4) Upsert Clients (bulk conflict detection to reduce DB roundtrips)
  const emailList = Array.from(contacts.keys());
  const existing = await prisma.client.findMany({
    where: { email: { in: emailList } },
    select: { email: true, source: true },
  });
  const existingMap = new Map(existing.map((c) => [String(c.email).toLowerCase(), c.source]));

  // isRoleBased helper
  const { isRoleBasedEmail } = await import("../lib/email-utils.ts");

  const contactEntries = Array.from(contacts.entries());
  const upsertResults = await mapLimit(contactEntries, 5, async ([email, info]: any) => {
    const existingSource = existingMap.get(String(email).toLowerCase());
    const isConflict = !!(existingSource && existingSource !== "GMAIL");

    await prisma.client.upsert({
      where: {
        source_externalId: {
          source: "GMAIL",
          externalId: `${account.id}:${email}`,
        },
      },
      update: {
        clientName: info.name || String(email).split("@")[0].replace(/[._]/g, " "),
        contactPerson: info.name || null,
        gmailSourceAccount: account.email,
        isRoleBased: isRoleBasedEmail(email),
      },
      create: {
        clientName: info.name || String(email).split("@")[0].replace(/[._]/g, " "),
        contactPerson: info.name || null,
        email: email,
        industry: "Corporate",
        relationshipLevel: "Warm Lead",
        source: "GMAIL",
        externalId: `${account.id}:${email}`,
        gmailSourceAccount: account.email,
        isRoleBased: isRoleBasedEmail(email),
      },
    });

    return { isConflict };
  });

  const importedCount = upsertResults.length;
  const conflictCount = upsertResults.filter((r) => r.isConflict).length;

  return { count: importedCount, conflicts: conflictCount };
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
              const result = await runCampaignGenerate(job);
              await setJobSucceeded(job.id, result);
            } else if (job.type === "CAMPAIGN_DISPATCH_BATCH") {
              const result = await runDispatchBatch(job);
              await setJobSucceeded(job.id, result);
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

