import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getBackendSession } from "@/services/auth";

const RAW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default_insecure_key_123456789012";
const ENCRYPTION_KEY = RAW_ENCRYPTION_KEY.padEnd(32, "0").substring(0, 32);
const RAW_ENCRYPTION_IV = process.env.ENCRYPTION_IV || "default_iv_12345";
const ENCRYPTION_IV = RAW_ENCRYPTION_IV.padEnd(16, "0").substring(0, 16);

function encrypt(text: string): string {
    if (!text) return text;
    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(ENCRYPTION_KEY),
        Buffer.from(ENCRYPTION_IV),
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("hex");
}

export async function GET(req: NextRequest) {
    const session = await getBackendSession(req);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (error) {
        return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(error)}`, appUrl));
    }

    if (!code) {
        return NextResponse.redirect(new URL("/import?error=missing_code", appUrl));
    }

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/zoho/callback`;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(new URL("/import?error=env_not_configured", appUrl));
    }

    try {
        const tokenRes = await fetch("https://accounts.zoho.in/oauth/v2/token", {
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

        const tokenData = await tokenRes.json();

        if (tokenData.error || !tokenData.refresh_token) {
            console.error("[ZOHO_CALLBACK] Token Error:", tokenData);
            return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(tokenData.error || "failed_to_get_refresh_token")}`, appUrl));
        }

        const refreshTokenEncrypted = encrypt(tokenData.refresh_token);
        const grantedScopes = tokenData.scope;

        await prisma.zohoConnection.upsert({
            where: { userId: session.user.id },
            update: {
                refreshTokenEncrypted,
                grantedScopes,
                updatedAt: new Date(),
            },
            create: {
                userId: session.user.id,
                refreshTokenEncrypted,
                grantedScopes,
            },
        });

        return NextResponse.redirect(new URL("/import?zoho=success", appUrl));
    } catch (err: any) {
        console.error("[ZOHO_CALLBACK] Catch Error:", err);
        return NextResponse.redirect(new URL(`/import?error=${encodeURIComponent(err.message || "internal_server_error")}`, appUrl));
    }
}
