import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { getBackendSession, isApprovedUser } from "@/backend/lib/auth";
import { decrypt } from "@/backend/lib/encryption";

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
        const appUrl = process.env.NEXTAUTH_URL?.trim();
        if (!appUrl) {
            return NextResponse.json({ error: "Missing NEXTAUTH_URL." }, { status: 500 });
        }

        // The URL where Zoho will send the user back after approval
        const redirectUri = `${appUrl.replace(/\/+$/, "")}/api/auth/zoho/callback`;

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
