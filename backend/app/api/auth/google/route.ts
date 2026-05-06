import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { decrypt } from "@/backend/lib/encryption";

type GmailConnectIntent = "send" | "sync" | "both";

function parseIntent(raw: string | null): GmailConnectIntent {
    if (raw === "send" || raw === "sync" || raw === "both") return raw;
    return "both";
}

async function resolveGoogleClientId() {
    const envClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (envClientId) return envClientId;

    const settings = await prisma.globalSettings.findUnique({
        where: { id: "singleton" }
    });
    if (!settings?.googleClientIdEncrypted) return "";
    return decrypt(settings.googleClientIdEncrypted).trim();
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const label = (searchParams.get("label") || searchParams.get("state") || "").trim(); // legacy compatibility
        const intent = parseIntent(searchParams.get("intent"));
        const returnTo = (searchParams.get("returnTo") || "/settings").trim();

        const clientId = await resolveGoogleClientId();
        if (!clientId) {
            return NextResponse.json({ error: "Google Client ID not configured" }, { status: 400 });
        }
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

        const scopes = new Set<string>([
            "https://www.googleapis.com/auth/userinfo.email",
        ]);

        if (intent === "sync" || intent === "both") {
            scopes.add("https://www.googleapis.com/auth/gmail.readonly");
        }
        if (intent === "send" || intent === "both") {
            scopes.add("https://www.googleapis.com/auth/gmail.send");
            scopes.add("https://mail.google.com/");
        }

        const statePayload = {
            label: label || "",
            intent,
            returnTo: returnTo.startsWith("/") ? returnTo : "/settings",
            version: 1,
        };

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: Array.from(scopes).join(" "),
                access_type: "offline",
                prompt: "consent",
                state: JSON.stringify(statePayload),
            }).toString();

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("Google Auth Redirect Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
