import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt, encrypt } from "@/services/encryption";
import { getBackendSession } from "@/services/auth";

async function resolveGoogleClientConfig() {
  const envClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (envClientId && envClientSecret) return { clientId: envClientId, clientSecret: envClientSecret };
  const settings = await prisma.globalSettings.findUnique({ where: { id: "singleton" } }) as any;
  const dbClientId = settings?.googleClientIdEncrypted ? decrypt(settings.googleClientIdEncrypted).trim() : "";
  const dbClientSecret = settings?.googleClientSecretEncrypted ? decrypt(settings.googleClientSecretEncrypted).trim() : "";
  return { clientId: dbClientId, clientSecret: dbClientSecret };
}

export async function GET(request: Request) {
  try {
    const session = await getBackendSession(request);
    if (!session?.user?.id) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?auth=expired`);

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const rawState = url.searchParams.get("state");
    const parsed = rawState ? JSON.parse(rawState) : {};
    const returnTo = typeof parsed?.returnTo === "string" && parsed.returnTo.startsWith("/") ? parsed.returnTo : "/import";
    if (!code) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${returnTo}?auth=error&reason=no_code`);

    const { clientId, clientSecret } = await resolveGoogleClientConfig();
    if (!clientId || !clientSecret) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${returnTo}?auth=error&reason=google_config_missing`);

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google-contacts/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${returnTo}?auth=error&reason=token_exchange`);

    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null;

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    const userData = await userResponse.json();
    const email = String(userData?.email || "").toLowerCase();
    if (!email) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${returnTo}?auth=error&reason=no_email`);

    const existing = await prisma.gmailAccount.findFirst({ where: { userId: session.user.id, email } });
    const refreshTokenEncrypted = refreshToken ? encrypt(refreshToken) : existing?.refreshTokenEncrypted || null;
    if (!refreshTokenEncrypted) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${returnTo}?auth=error&reason=no_refresh_token`);

    await prisma.gmailAccount.upsert({
      where: { userId_email: { userId: session.user.id, email } },
      update: {
        refreshTokenEncrypted,
        accessTokenEncrypted: encrypt(accessToken),
        expiresAt,
        scopeGranted: true,
        lastStatus: "CONTACTS_HEALTHY",
        lastUsed: new Date(),
      },
      create: {
        userId: session.user.id,
        accountName: parsed?.label || email.split("@")[0],
        email,
        refreshTokenEncrypted,
        accessTokenEncrypted: encrypt(accessToken),
        expiresAt,
        scopeGranted: true,
        lastStatus: "CONTACTS_HEALTHY",
        lastUsed: new Date(),
      },
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${returnTo}?contacts_auth=success`);
  } catch (error) {
    console.error("Google Contacts Callback Error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/import?contacts_auth=error`);
  }
}

