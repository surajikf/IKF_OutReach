import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import crypto from "crypto";
import { getBackendSession, isApprovedUser } from "@/backend/lib/auth";

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

export async function GET(req: Request) {
    try {
        if (!await isApprovedUser(req)) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
        }
        const session = await getBackendSession(req);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Sign in required." }, { status: 401 });
        }

        const settings = await prisma.globalSettings.findFirst();

        if (!settings || !settings.zohoClientIdEncrypted) {
            return NextResponse.json({ error: "Zoho Client ID not configured. Please configure in the UI first." }, { status: 400 });
        }

        const clientId = decrypt(settings.zohoClientIdEncrypted);

        if (!clientId) {
            return NextResponse.json({ error: "Failed to decrypt Client ID." }, { status: 500 });
        }

        // The URL where Zoho will send the user back after approval
        const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/zoho/callback`;

        // The exact scopes required to read Bigin Deals (Pipelines) and Contacts
        const scopes = "ZohoBigin.modules.ALL,ZohoBigin.settings.ALL,ZohoBigin.settings.pipelines.ALL,ZohoBigin.settings.fields.ALL,ZohoBigin.users.ALL";

        // Construct Zoho OAuth URL (access_type=offline guarantees we get a refresh token)
        const zohoAuthUrl = `https://accounts.zoho.in/oauth/v2/auth?client_id=${clientId}&response_type=code&scope=${scopes}&redirect_uri=${redirectUri}&access_type=offline&prompt=consent`;

        return NextResponse.redirect(zohoAuthUrl);

    } catch (error) {
        console.error("Zoho Auth Init Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
