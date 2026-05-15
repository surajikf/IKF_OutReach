import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/services/encryption";

async function resolveGoogleClientId() {
  const envClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (envClientId) return envClientId;
  const settings = await prisma.globalSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.googleClientIdEncrypted) return "";
  return decrypt(settings.googleClientIdEncrypted).trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const label = (searchParams.get("label") || "Google Contacts").trim();
    const returnTo = (searchParams.get("returnTo") || "/import").trim();

    const clientId = await resolveGoogleClientId();
    if (!clientId) return NextResponse.json({ error: "Google Client ID not configured" }, { status: 400 });

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google-contacts/callback`;
    const statePayload = {
      label,
      intent: "contacts_only",
      returnTo: returnTo.startsWith("/") ? returnTo : "/import",
      version: 1,
    };

    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: [
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/contacts.readonly",
          "https://www.googleapis.com/auth/contacts.other.readonly",
        ].join(" "),
        access_type: "offline",
        prompt: "select_account consent",
        state: JSON.stringify(statePayload),
      }).toString();

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Google Contacts Auth Redirect Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

