import { NextResponse } from "next/server";
import { getGlobalSettings } from "@/backend/lib/settings";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const provider = searchParams.get("provider") || "Groq";
        const settings = await getGlobalSettings();

        if (provider === "Groq") {
            const apiKey = settings.groqApiKey;
            if (!apiKey || apiKey === "your_groq_api_key_here") {
                return NextResponse.json({ success: false, error: "Groq API Key is not configured in settings." }, { status: 401 });
            }

            const response = await fetch("https://api.groq.com/openai/v1/models", {
                headers: { "Authorization": `Bearer ${apiKey}` },
            });

            if (!response.ok) {
                const error = await response.json();
                return NextResponse.json({ success: false, error: error.error?.message || "Failed to connect to Groq API" }, { status: response.status });
            }

            const data = await response.json();
            return NextResponse.json({ success: true, message: "Successfully connected to Groq API", models: data.data.length });
        }

        if (provider === "OpenAI") {
            const apiKey = settings.openaiApiKey;
            if (!apiKey) {
                return NextResponse.json({ success: false, error: "OpenAI API Key is not configured in settings." }, { status: 401 });
            }

            const response = await fetch("https://api.openai.com/v1/models", {
                headers: { "Authorization": `Bearer ${apiKey}` },
            });

            if (!response.ok) {
                const error = await response.json();
                return NextResponse.json({ success: false, error: error.error?.message || "Failed to connect to OpenAI API" }, { status: response.status });
            }

            const data = await response.json();
            return NextResponse.json({ success: true, message: "Successfully connected to OpenAI API", models: data.data.length });
        }

        if (provider === "Anthropic") {
            // Anthropic is not yet in settings schema explicitly, using env as fallback
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
                return NextResponse.json({ success: false, error: "ANTHROPIC_API_KEY is not configured in .env" }, { status: 401 });
            }

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 1,
                    messages: [{ role: "user", content: "ping" }]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                return NextResponse.json({ success: false, error: error.error?.message || "Failed to connect to Anthropic API" }, { status: response.status });
            }

            return NextResponse.json({ success: true, message: "Successfully connected to Anthropic API", models: "Claude" });
        }

        return NextResponse.json({ success: false, error: "Unknown AI Provider" }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
