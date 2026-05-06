import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { decrypt, encrypt } from "@/backend/lib/encryption";

type GmailConnectIntent = "send" | "sync" | "both";

function parseState(rawState: string | null): { label: string; intent: GmailConnectIntent; returnTo: string } {
    if (!rawState) return { label: "", intent: "both", returnTo: "/settings" };
    try {
        const parsed = JSON.parse(rawState);
        const label = typeof parsed?.label === "string" ? parsed.label.trim() : "";
        const intent: GmailConnectIntent =
            parsed?.intent === "send" || parsed?.intent === "sync" || parsed?.intent === "both"
                ? parsed.intent
                : "both";
        const returnTo = typeof parsed?.returnTo === "string" && parsed.returnTo.startsWith("/")
            ? parsed.returnTo
            : "/settings";
        return { label, intent, returnTo };
    } catch {
        // Legacy support: old flow sent plain label in `state`.
        return { label: rawState.trim(), intent: "both", returnTo: "/settings" };
    }
}

async function resolveGoogleClientConfig() {
    const envClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const envClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (envClientId && envClientSecret) {
        return { clientId: envClientId, clientSecret: envClientSecret };
    }

    const settings = (await prisma.globalSettings.findUnique({
        where: { id: "singleton" }
    })) as any;
    const dbClientId = settings?.googleClientIdEncrypted ? decrypt(settings.googleClientIdEncrypted).trim() : "";
    const dbClientSecret = settings?.googleClientSecretEncrypted ? decrypt(settings.googleClientSecretEncrypted).trim() : "";
    return { clientId: dbClientId, clientSecret: dbClientSecret };
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const { label, intent, returnTo } = parseState(state);

        if (!code) {
            return NextResponse.json({ error: "No authorization code received from the matrix." }, { status: 400 });
        }

        const { clientId, clientSecret } = await resolveGoogleClientConfig();
        if (!clientId || !clientSecret) {
            return NextResponse.json({ error: "Google OAuth client configuration missing." }, { status: 400 });
        }
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

        // 1. Exchange Code for Tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("Token Exchange Failure:", tokens);
            return NextResponse.json({ error: tokens.error_description || "Neural Handshake Failed." }, { status: 500 });
        }

        const { refresh_token, access_token, expires_in, scope } = tokens;

        // 2. Fetch User Email for Identification
        const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        const userData = await userResponse.json();
        const email = userData.email;

        // 3. Persist to GmailAccount model (Always)
        console.log(`[AUTH] Successfully retrieved tokens for ${email}.`);

        const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;
        
        // Check if any default account exists
        const defaultAccount = await prisma.gmailAccount.findFirst({
            where: { isDefault: true }
        });

        const existingAccount = await (prisma.gmailAccount as any).findUnique({
            where: { email },
        });

        const refreshTokenEncrypted =
            refresh_token
                ? encrypt(refresh_token)
                : existingAccount?.refreshTokenEncrypted || null;

        // If Google did not return refresh_token and we don't already have one,
        // this account cannot send mail with OAuth2.
        if (!refreshTokenEncrypted) {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${returnTo}?auth=error&reason=no_refresh_token`
            );
        }

        const hasSendScope = typeof scope === "string"
            ? (scope.includes("gmail.send") || scope.includes("mail.google.com"))
            : true;
        const hasReadScope = typeof scope === "string"
            ? scope.includes("gmail.readonly")
            : true;

        const accountData: any = {
            email,
            accountName: label || email.split("@")[0],
            refreshTokenEncrypted,
            accessTokenEncrypted: encrypt(access_token),
            expiresAt,
            isDefault: !defaultAccount, // Make default if none exist
            scopeGranted: hasSendScope,
            lastStatus:
                intent === "send" && !hasSendScope
                    ? "SEND_SCOPE_MISSING"
                    : intent === "sync" && !hasReadScope
                        ? "SYNC_SCOPE_MISSING"
                        : intent === "both" && (!hasSendScope || !hasReadScope)
                            ? "PARTIAL_SCOPE"
                            : "HEALTHY",
            lastUsed: new Date(),
        };

        await (prisma.gmailAccount as any).upsert({
            where: { email },
            update: {
                accountName: accountData.accountName,
                refreshTokenEncrypted: accountData.refreshTokenEncrypted,
                accessTokenEncrypted: accountData.accessTokenEncrypted,
                expiresAt: accountData.expiresAt,
                scopeGranted: accountData.scopeGranted,
                lastStatus: accountData.lastStatus,
                lastUsed: accountData.lastUsed,
            },
            create: accountData,
        });

        // Redirect back to Settings with success
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${returnTo}?auth=success`);

    } catch (error: any) {
        console.error("Neural Link Callback Error:", error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?auth=error`);
    }
}
