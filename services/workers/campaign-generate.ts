import prisma from "@/lib/prisma";
import { getGlobalSettings } from "@/services/settings";
import { getTargetClients } from "@/domain/campaigns";
import { getSmartGreeting, replaceVariables } from "@/lib/shared/utils";
import { dedupeLeadingSalutation, normalizeEmailBodyHtml } from "@/lib/shared/email-format";
import { evaluateEmailQuality } from "@/lib/shared/campaign-quality";
import { runAiWithFallback } from "@/services/ai-router";

function scrubLiteralName(content: string, nameToScrub: string, replacementVariable = "{{fullName}}") {
  if (!content || !nameToScrub || nameToScrub.length < 3) return content;
  const fullRegex = new RegExp(nameToScrub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let processed = content.replace(fullRegex, replacementVariable);
  const firstName = nameToScrub.split(" ")[0];
  if (firstName && firstName.length > 2 && firstName !== nameToScrub) {
    const firstRegex = new RegExp(`\\b${firstName}\\b`, "gi");
    processed = processed.replace(firstRegex, "{{firstName}}");
  }
  return processed;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;
  return new Promise<R[]>((resolve, reject) => {
    const runNext = () => {
      if (nextIndex >= items.length && active === 0) { resolve(results); return; }
      while (active < limit && nextIndex < items.length) {
        const i = nextIndex++;
        active++;
        fn(items[i], i).then((r) => { results[i] = r; active--; runNext(); }).catch(reject);
      }
    };
    runNext();
  });
}

export async function runCampaignGenerateInline(jobId: string, payload: any) {
  const {
    audienceSource, audienceSources, type, topic, coreMessage, cta,
    clientId, styleGuide, styleMemory, excludedClientIds,
    serviceFilters = [], serviceLogic = "OR", sampleClientId, _userId,
  } = payload;

  const jobUserId: string | null = _userId ? String(_userId) : null;
  const resolvedSources: string[] =
    Array.isArray(audienceSources) && audienceSources.length > 0
      ? audienceSources
      : audienceSource ? [audienceSource] : [];

  if (resolvedSources.length === 0) throw new Error("Audience source is required.");

  const settings = await getGlobalSettings();

  let clients: any[] = [];
  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, source: { in: resolvedSources as any } },
      select: { id: true, clientName: true, industry: true, contactPerson: true, relationshipLevel: true, clientAddedOn: true, lastInvoiceDate: true, invoiceServiceNames: true },
    });
    if (client) clients = [client];
  }
  if (clients.length === 0 && !clientId) {
    clients = (await getTargetClients(resolvedSources as any, type, serviceFilters, serviceLogic, excludedClientIds || [], false, jobUserId ?? undefined)).slice(0, 50);
  }
  if (clients.length === 0) return { count: 0, generatedCampaignIds: [] };

  const generatedCampaignIds: string[] = [];

  await mapLimit(clients, 2, async (client: any, idx: number) => {
    let localTopic = topic;
    let localCoreMessage = coreMessage;
    let localStyleGuide = styleGuide ? { ...styleGuide } : null;
    let nameToScrub = "";

    if (sampleClientId) {
      const sampleClient = await prisma.client.findUnique({ where: { id: sampleClientId } });
      if (sampleClient) {
        nameToScrub = sampleClient.contactPerson || sampleClient.clientName || "";
        const scrub = (t: string) => (t && nameToScrub ? scrubLiteralName(t, nameToScrub) : t);
        localTopic = scrub(localTopic);
        localCoreMessage = scrub(localCoreMessage);
        if (localStyleGuide) { localStyleGuide.subject = scrub(localStyleGuide.subject); localStyleGuide.body = scrub(localStyleGuide.body); }
      }
    }

    const greeting = getSmartGreeting(client.contactPerson, { email: client.email });
    const now = new Date();
    const addedOn = client.clientAddedOn ? new Date(client.clientAddedOn) : null;
    const tenureYears = addedOn ? now.getFullYear() - addedOn.getFullYear() : 0;
    const relationshipDepth = tenureYears > 3 ? "Deep Legacy" : tenureYears > 1 ? "Established Partnership" : "New Engagement";
    const lastInvoice = client.lastInvoiceDate ? new Date(client.lastInvoiceDate) : null;
    const lastActivity = lastInvoice ? `Last engagement: ${lastInvoice.toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "Ongoing relationship";
    const firstName = (client.contactPerson || "").replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+/i, "").split(/\s+/).filter(Boolean)[0] || "";
    const companyName = client.clientName || "your company";
    const servicesList = client.invoiceServiceNames || "your business infrastructure";

    let resSubject = "";
    let resEmailBody = "";

    if (localStyleGuide) {
      resSubject = replaceVariables(localStyleGuide.subject, client);
      resEmailBody = replaceVariables(localStyleGuide.body, client);
    } else {
      const objectiveContexts: Record<string, string> = {
        Broadcast: "GOAL: Strategic wide-angle synchronization. Focus on high-level corporate shifts, new infrastructure, or vision pivots.",
        Targeted: "GOAL: High-precision value sharing. Focus on a specific milestone or exclusive resource.",
        "Cross-Sell": `GOAL: Capacity expansion. Identify a friction point in their setup that our other services (${servicesList}) could solve.`,
        Reactivation: "GOAL: Re-igniting a dormant partnership. Reference previous successes and acknowledge the new chapter.",
      };
      const prompt = `
RELATIONSHIP DEPTH: ${relationshipDepth} (${tenureYears} years). LAST ACTIVITY: ${lastActivity}. STATUS: ${client.relationshipLevel}.
${objectiveContexts[type] || ""}
RECIPIENT: ${companyName} (${client.industry || "unknown sector"}).
MASTER SUBJECT: "${localTopic}"
MASTER BODY: "${localCoreMessage}"
REQUIRED CTA: "${cta}"
LEARNED STYLE: ${styleMemory ? JSON.stringify(styleMemory) : "None"}
START WITH: "${greeting}"
Personalize for this specific client. Keep it concise, professional, human. No brand sign-offs.
OUTPUT: Pure JSON with "subject" and "body" (HTML) fields only.`;

      try {
        const aiResult = await Promise.race([
          runAiWithFallback({
            messages: [
              { role: "system", content: "You are a strategic marketing AI. Output ONLY pure JSON." },
              { role: "user", content: prompt },
            ],
            modelOverride: settings.aiModel,
            responseFormat: "json_object",
            temperature: 0.7,
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("AI timeout")), 30000)),
        ]) as any;

        const content = JSON.parse(aiResult.content || "{}");
        resSubject = content.subject || localTopic;
        resEmailBody = content.body || "";
        if (nameToScrub) {
          resSubject = scrubLiteralName(resSubject, nameToScrub);
          resEmailBody = scrubLiteralName(resEmailBody, nameToScrub);
        }
        resSubject = replaceVariables(resSubject, client);
        resEmailBody = replaceVariables(resEmailBody, client);
        if (!resEmailBody || resEmailBody.length < 10) throw new Error("AI returned empty content");
      } catch {
        resSubject = replaceVariables(localTopic, client);
        resEmailBody = replaceVariables(localCoreMessage, client);
        if (!resEmailBody.toLowerCase().startsWith(greeting.toLowerCase().split(" ")[0])) {
          resEmailBody = `<p>${greeting},</p>${resEmailBody}`;
        }
      }
    }

    if (resEmailBody.includes("```")) resEmailBody = resEmailBody.replace(/```html\n?|```\n?/g, "").trim();
    resSubject = replaceVariables(resSubject, client);
    resEmailBody = dedupeLeadingSalutation(normalizeEmailBodyHtml(replaceVariables(resEmailBody, client)));
    if (!resSubject || resSubject.trim().length < 6) resSubject = `Quick update for ${companyName}`;

    const quality = evaluateEmailQuality({ subject: resSubject, bodyHtml: resEmailBody, greeting, cta, companyName, industry: client.industry || "", services: servicesList });
    let leadStrength = Math.max(60, quality.score);
    if (tenureYears > 2) leadStrength = Math.min(100, leadStrength + 10);
    if (client.relationshipLevel === "Active") leadStrength = Math.min(100, leadStrength + 5);

    try {
      const saved = await (prisma as any).campaignHistory.create({
        data: {
          clientId: client.id,
          campaignType: type,
          campaignTopic: topic,
          generatedOutput: JSON.stringify({ subject: resSubject, body: resEmailBody, leadStrength, spamRisk: quality.spamRisk }),
          jobId,
          ...(jobUserId && { userId: jobUserId }),
        },
      });
      if (saved?.id) {
        generatedCampaignIds.push(String(saved.id));
        if (jobId) {
          // Use direct literal to bypass pooler's prepared statement limitation
          await (prisma as any).$executeRawUnsafe(`UPDATE "CampaignHistory" SET "jobId" = '${jobId}' WHERE id = '${saved.id}'`).catch(() => {});
        }
      }

      await (prisma as any).client.update({ where: { id: client.id }, data: { lastContacted: new Date() } }).catch(() => {});

      const progress = Math.round(((idx + 1) / clients.length) * 100);
      await (prisma as any).job.update({
        where: { id: jobId },
        data: { progress, result: { count: generatedCampaignIds.length, generatedCampaignIds } },
      }).catch(() => {});
    } catch (err) {
      console.error(`[campaign-generate] Failed to save for client ${client.id}:`, err);
    }
  });

  return { count: generatedCampaignIds.length, generatedCampaignIds };
}
