import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { decrypt } from "@/backend/lib/encryption";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const state = searchParams.get("state"); // Account label (Sales, Accounts, etc.)

        const settings = await prisma.globalSettings.findUnique({
            where: { id: "singleton" }
        });

        if (!settings?.googleClientIdEncrypted) {
            return NextResponse.json({ error: "Google Client ID not configured" }, { status: 400 });
        }

        const clientId = decrypt(settings.googleClientIdEncrypted);
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

        // Request scopes needed for both:
        // 1) Gmail import (read)
        // 2) Campaign/test dispatch via Gmail OAuth2 SMTP (send)
        const scopes = [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://mail.google.com/"
        ].join(" ");

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: scopes,
                access_type: "offline",
                prompt: "consent",
                state: state || "",
            }).toString();

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("Google Auth Redirect Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
