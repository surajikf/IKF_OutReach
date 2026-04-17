import { NextResponse } from "next/server";
import prisma from "@/backend/lib/prisma";
import { decrypt, encrypt } from "@/backend/lib/encryption";

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // Contains the account label (e.g., "Sales Team", "Accounts", "Boss")

        if (!code) {
            return NextResponse.json({ error: "No authorization code received from the matrix." }, { status: 400 });
        }

        const settings = (await prisma.globalSettings.findUnique({
            where: { id: "singleton" }
        })) as any;

        if (!settings) {
            return NextResponse.json({ error: "Global Configuration not found." }, { status: 404 });
        }

        const clientId = decrypt(settings.googleClientIdEncrypted!);
        const clientSecret = decrypt(settings.googleClientSecretEncrypted!);
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

        const { refresh_token, access_token, expires_in } = tokens;

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
                `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?auth=error&reason=no_refresh_token`
            );
        }

        const accountData: any = {
            email,
            accountName: state || email.split('@')[0], // Use state (label) OR email prefix
            refreshTokenEncrypted,
            accessTokenEncrypted: encrypt(access_token),
            expiresAt,
            isDefault: !defaultAccount, // Make default if none exist
        };

        await (prisma.gmailAccount as any).upsert({
            where: { email },
            update: {
                accountName: accountData.accountName,
                refreshTokenEncrypted: accountData.refreshTokenEncrypted,
                accessTokenEncrypted: accountData.accessTokenEncrypted,
                expiresAt: accountData.expiresAt,
            },
            create: accountData,
        });

        // Redirect back to Settings with success
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?auth=success`);

    } catch (error: any) {
        console.error("Neural Link Callback Error:", error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?auth=error`);
    }
}
