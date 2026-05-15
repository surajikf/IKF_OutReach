import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt, encrypt } from "@/services/encryption";
import { getBackendSession } from "@/services/auth";
import { randomUUID } from "crypto";

async function resolveGoogleClientConfig() {
  const envClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (envClientId && envClientSecret) return { clientId: envClientId, clientSecret: envClientSecret };
  const settings = await prisma.globalSettings.findUnique({ where: { id: "singleton" } }) as any;
  const dbClientId = settings?.googleClientIdEncrypted ? decrypt(settings.googleClientIdEncrypted).trim() : "";
  const dbClientSecret = settings?.googleClientSecretEncrypted ? decrypt(settings.googleClientSecretEncrypted).trim() : "";
  return { clientId: dbClientId, clientSecret: dbClientSecret };
}

function buildReturnUrl(returnTo: string, params: Record<string, string>) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUrl = new URL(returnTo, appUrl);
  Object.entries(params).forEach(([key, value]) => redirectUrl.searchParams.set(key, value));
  return redirectUrl.toString();
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
    if (!code) return NextResponse.redirect(buildReturnUrl(returnTo, { auth: "error", reason: "no_code" }));

    const { clientId, clientSecret } = await resolveGoogleClientConfig();
    if (!clientId || !clientSecret) return NextResponse.redirect(buildReturnUrl(returnTo, { auth: "error", reason: "google_config_missing" }));

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google-contacts/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) return NextResponse.redirect(buildReturnUrl(returnTo, { auth: "error", reason: "token_exchange" }));

    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string | undefined;
    const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : null;

    const grantedScope = String(tokens.scope || "");
    const hasContactsScope = grantedScope.includes("contacts");
    if (!hasContactsScope) {
      return NextResponse.redirect(buildReturnUrl(returnTo, { auth: "error", reason: "scope_denied", scope: "contacts" }));
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    const userData = await userResponse.json();
    const email = String(userData?.email || "").toLowerCase();
    if (!email) return NextResponse.redirect(buildReturnUrl(returnTo, { auth: "error", reason: "no_email" }));

    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string; refreshTokenEncrypted: string }>>(
      `SELECT "id", "refreshTokenEncrypted"
       FROM "GoogleContactsAccount"
       WHERE "userId" = $1 AND "email" = $2
       LIMIT 1`,
      session.user.id,
      email
    );
    const existing = existingRows[0] || null;

    // Contacts tokens live in GoogleContactsAccount only, never in GmailAccount.
    // Google only returns refresh_token on consent; reuse the previous contacts token on re-auth.
    const refreshTokenEncrypted = refreshToken
      ? encrypt(refreshToken)
      : existing?.refreshTokenEncrypted || null;

    if (!refreshTokenEncrypted) {
      return NextResponse.redirect(buildReturnUrl(returnTo, { auth: "error", reason: "no_refresh_token" }));
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "GoogleContactsAccount" (
         "id", "userId", "accountName", "email", "refreshTokenEncrypted",
         "accessTokenEncrypted", "expiresAt", "lastStatus", "lastUsed", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'HEALTHY', NOW(), NOW(), NOW())
       ON CONFLICT ("userId", "email")
       DO UPDATE SET
         "accountName" = EXCLUDED."accountName",
         "refreshTokenEncrypted" = EXCLUDED."refreshTokenEncrypted",
         "accessTokenEncrypted" = EXCLUDED."accessTokenEncrypted",
         "expiresAt" = EXCLUDED."expiresAt",
         "lastStatus" = 'HEALTHY',
         "lastUsed" = NOW(),
         "updatedAt" = NOW()`,
      existing?.id || randomUUID(),
      session.user.id,
      parsed?.label || email.split("@")[0],
      email,
      refreshTokenEncrypted,
      encrypt(accessToken),
      expiresAt
    );

    return NextResponse.redirect(buildReturnUrl(returnTo, { contacts_auth: "success" }));
  } catch (error) {
    console.error("Google Contacts Callback Error:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/import?contacts_auth=error&reason=callback_exception`);
  }
}
