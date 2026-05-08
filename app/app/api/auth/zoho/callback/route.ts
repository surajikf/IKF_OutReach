import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { getBackendSession } from "@/backend/lib/auth";
import { decrypt, encrypt } from "@/backend/lib/encryption";

export async function GET(req: Request) {
    try {
        const appUrl = process.env.NEXTAUTH_URL?.trim();
        if (!appUrl) {
            return NextResponse.json({ error: "Missing NEXTAUTH_URL." }, { status: 500 });
        }
        const session = await getBackendSession(req);
        if (!session?.user?.id) {
            return NextResponse.redirect(`${appUrl.replace(/\/+$/, "")}/login?auth=expired`);
        }

        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");

        if (errorParam) {
            return NextResponse.redirect(`${appUrl.replace(/\/+$/, "")}/import?error=zoho_auth_failed`);
        }

        if (!code) {
            return NextResponse.json({ error: "Authorization code missing." }, { status: 400 });
        }

        const settings = await prisma.globalSettings.findFirst();

        if (!settings || !settings.zohoClientIdEncrypted || !settings.zohoClientSecretEncrypted) {
            return NextResponse.json({ error: "Zoho credentials not configured." }, { status: 400 });
        }

        const clientId = decrypt(settings.zohoClientIdEncrypted);
        const clientSecret = decrypt(settings.zohoClientSecretEncrypted);
        const redirectUri = `${appUrl.replace(/\/+$/, "")}/api/auth/zoho/callback`;

        // Exchange code for tokens
        const tokenRes = await fetch(`https://accounts.zoho.in/oauth/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri,
                code: code
            })
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error("Zoho Token Error:", tokenData);
            return NextResponse.redirect(`${appUrl.replace(/\/+$/, "")}/import?error=zoho_invalid_code&details=${tokenData.error}`);
        }

        console.log("[ZOHO_CALLBACK] Granted Scopes:", tokenData.scope);

        // Store refresh token scoped to the current user
        if (tokenData.refresh_token) {
            await prisma.zohoConnection.upsert({
                where: { userId: session.user.id },
                update: {
                    refreshTokenEncrypted: encrypt(tokenData.refresh_token),
                    grantedScopes: tokenData.scope || null,
                },
                create: {
                    userId: session.user.id,
                    refreshTokenEncrypted: encrypt(tokenData.refresh_token),
                    grantedScopes: tokenData.scope || null,
                },
            });
        }

        // Redirect back to the import page on success
        return NextResponse.redirect(`${appUrl.replace(/\/+$/, "")}/import?success=zoho_connected`);

    } catch (error) {
        console.error("Zoho Auth Callback Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
