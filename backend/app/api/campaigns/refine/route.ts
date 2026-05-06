import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getGlobalSettings } from "@/backend/lib/settings";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";
import { normalizeEmailBodyHtml } from "@/shared/lib/email-format";

const refineSchema = z.object({
    text: z.string().min(1, "Text to refine is required"),
    command: z.string().min(1, "Instruction is required"),
});

export async function POST(request: Request) {
    try {
        const json = await request.json();
        const parsed = refineSchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Invalid refinement payload", {
                status: 400,
                details: parsed.error.flatten(),
            });
        }

        const { text, command } = parsed.data;
        const settings = await getGlobalSettings();

        let aiProvider = settings.aiProvider || "Groq";
        let apiKey = aiProvider === "Groq" ? settings.groqApiKey : settings.openaiApiKey;

        if (!apiKey || apiKey.includes("your_")) {
            // Mock response if no API key
            return ok({ 
                refinedText: `[AI REFINE MOCK]: ${text} (Applied: ${command})`,
                originalText: text 
            });
        }

        const prompt = `
            TASK: Refine the following email segment based on the user instruction.
            SEGMENT: "${text}"
            INSTRUCTION: "${command}"

            RULES:
            1. Response must be PURE text or valid HTML segment (if the input was HTML).
            2. NO introductory text like "Sure, here is your refined text:".
            3. Maintain the core meaning but adapt the tone/length as requested.
            4. If the input contains HTML tags, preserve the necessary structure.
            5. Return ONLY the refined content.
        `;

        let refinedText = "";

        if (aiProvider === "Groq") {
            const groq = new Groq({ apiKey });
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a professional business communication editor. Return ONLY the refined text without any conversational filler." },
                    { role: "user", content: prompt }
                ],
                model: settings.aiModel,
                temperature: 0.5,
            });
            refinedText = chatCompletion.choices[0].message.content || text;
        } else if (aiProvider === "OpenAI") {
            const OpenAI = (await import("openai")).default;
            const openai = new OpenAI({ apiKey });
            const chatCompletion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a professional business communication editor. Return ONLY the refined text without any conversational filler." },
                    { role: "user", content: prompt }
                ],
                model: settings.aiModel,
                temperature: 0.5,
            });
            refinedText = chatCompletion.choices[0].message.content || text;
        }

        const inputWasHtml = /<\s*\/?\s*[a-zA-Z][^>]*>/.test(text);
        const normalized = inputWasHtml ? normalizeEmailBodyHtml(refinedText.trim()) : refinedText.trim();

        return ok({ 
            refinedText: normalized,
            originalText: text 
        });

    } catch (err) {
        console.error("AI Refinement failed:", err);
        return error("INTERNAL_ERROR", "Internal Server Error");
    }
}
