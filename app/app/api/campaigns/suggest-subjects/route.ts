import Groq from "groq-sdk";
import { getGlobalSettings } from "@/backend/lib/settings";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";

const suggestSchema = z.object({
    topic: z.string().min(1),
    coreMessage: z.string().min(1),
    clientName: z.string().optional(),
    industry: z.string().optional(),
});

const spamTokens = ["free", "buy now", "urgent", "guaranteed", "winner", "!!!"];

function scoreSubjectLine(subject: string) {
    const s = (subject || "").trim();
    const lower = s.toLowerCase();
    let score = 70;
    if (s.length >= 28 && s.length <= 62) score += 15;
    if (s.length < 18) score -= 15;
    if (s.length > 75) score -= 20;
    if (/\b(re:|for|regarding|idea|perspective|strategy)\b/i.test(s)) score += 8;
    if (/[!?]{2,}/.test(s)) score -= 12;
    for (const token of spamTokens) {
        if (lower.includes(token)) score -= 10;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
}

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const parsed = suggestSchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Invalid suggestion payload");
        }

        const { topic, coreMessage, clientName, industry } = parsed.data;
        const settings = await getGlobalSettings();

        const aiProvider = settings.aiProvider || "Groq";
        const apiKey = aiProvider === "Groq" ? settings.groqApiKey : settings.openaiApiKey;

        if (!apiKey || apiKey.includes("your_")) {
            return ok({ 
                suggestions: [
                    `Strategic Perspective on ${topic} for ${clientName || "Your Team"}`,
                    `${industry || "Business"} Intelligence: The ${topic} Shift`,
                    `Re: Selective Advisory on ${topic}`
                ]
            });
        }

        const prompt = `
            TASK: Generate 3 high-impact, professional, and "Executive Advisory" style subject lines for an email campaign.
            TOPIC: "${topic}"
            CORE MESSAGE: "${coreMessage}"
            CLIENT: "${clientName || "Valued Partner"}"
            INDUSTRY: "${industry || "Strategic Enterprise"}"

            RULES:
            1. No exclamation marks.
            2. Intellectual, observant, and peer-to-peer tone.
            3. Maximum 60 characters each.
            4. Focus on the strategic value of ${topic}.
            5. Return ONLY a JSON array of 3 strings.
        `;

        let suggestions: string[] = [];

        if (aiProvider === "Groq") {
            const groq = new Groq({ apiKey });
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a strategic marketing AI. Return ONLY a JSON array of strings." },
                    { role: "user", content: prompt }
                ],
                model: settings.aiModel,
                response_format: { type: "json_object" },
            });
            const content = JSON.parse(chatCompletion.choices[0].message.content || '{"suggestions": []}');
            suggestions = Array.isArray(content) ? content : (content.suggestions || []);
        } else if (aiProvider === "OpenAI") {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey });
            const chatCompletion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a strategic marketing AI. Return ONLY a JSON array of strings." },
                    { role: "user", content: prompt }
                ],
                model: settings.aiModel,
                response_format: { type: "json_object" },
            });
            const content = JSON.parse(chatCompletion.choices[0].message.content || '{"suggestions": []}');
            suggestions = Array.isArray(content) ? content : (content.suggestions || []);
        }

        const unique = Array.from(new Set(suggestions.map(s => (s || "").trim()).filter(Boolean)));
        const ranked = unique
            .map((s) => ({ subject: s, score: scoreSubjectLine(s) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        const warnings: string[] = [];
        if (ranked.some((r) => r.score < 60)) {
            warnings.push("Some suggested subjects may underperform due to length or deliverability signals.");
        }
        if (ranked.length > 1 && ranked[0].subject.toLowerCase() === ranked[1].subject.toLowerCase()) {
            warnings.push("Top subject variants are too similar. Consider stronger variation.");
        }

        return ok({
            suggestions: ranked.map((r) => r.subject).slice(0, 3),
            ranked,
            warnings,
        });

    } catch (err) {
        console.error("Subject Suggestion failed:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}
