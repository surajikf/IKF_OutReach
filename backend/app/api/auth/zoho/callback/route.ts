import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import crypto from "crypto";

const RAW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default_insecure_key_123456789012";
const ENCRYPTION_KEY = RAW_ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);

const RAW_ENCRYPTION_IV = process.env.ENCRYPTION_IV || "default_iv_12345";
const ENCRYPTION_IV = RAW_ENCRYPTION_IV.padEnd(16, '0').substring(0, 16);

function decrypt(encryptedText: string): string | null {
    if (!encryptedText) return null;
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(ENCRYPTION_IV));
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error);
        return null;
    }
}

function encrypt(text: string): string {
    if (!text) return text;
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), Buffer.from(ENCRYPTION_IV));
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex');
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");

        if (errorParam) {
            return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/import?error=zoho_auth_failed`);
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
        const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/zoho/callback`;

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
            return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/import?error=zoho_invalid_code&details=${tokenData.error}`);
        }

        console.log("[ZOHO_CALLBACK] Granted Scopes:", tokenData.scope);

        // We specifically care about the refresh_token so we can keep the session alive indefinitely
        if (tokenData.refresh_token) {
            await prisma.$executeRawUnsafe(
                `UPDATE "GlobalSettings" SET "zohoRefreshTokenEncrypted" = $1, "zohoGrantedScopes" = $2 WHERE id = $3`,
                encrypt(tokenData.refresh_token),
                tokenData.scope || null,
                settings.id
            );
        }

        // Redirect back to the import page on success
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/import?success=zoho_connected`);

    } catch (error) {
        console.error("Zoho Auth Callback Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
