import prisma from "@/backend/lib/prisma";
import { encrypt } from "@/backend/lib/encryption";
import { ok, error } from "@/backend/lib/api-response";
import { getBackendSession } from "@/backend/lib/auth";

/**
 * CORS PREFLIGHT HANDLER
 */
export async function OPTIONS(request: Request) {
    const origin = request.headers.get("origin");
    if (!origin) {
        return new Response("Missing origin header.", { status: 400 });
    }
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
        },
    });
}

/**
 * IDENTITY SYNC PROTOCOL
 * Automatically links a NextAuth Google session to the internal GmailAccount dispatcher.
 */
export async function POST(request: Request) {
    const origin = request.headers.get("origin");
    if (!origin) {
        return error("VALIDATION_ERROR", "Missing origin header.", { status: 400 });
    }
    const corsHeaders = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
    };

    try {
        const session = await getBackendSession(request);
        if (!session) {
            return error("UNAUTHORIZED", "Active session required for identity sync.", { status: 401 });
        }

        const body = await request.json();
        const { email, refreshToken, accessToken, scope, name } = body ?? {};

        const asNonEmptyString = (value: unknown) =>
            typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

        // session.user.email is the correct path (not session.email)
        const sessionEmail = session.user?.email;
        if (!email || email !== sessionEmail) {
            console.warn(`[IDENTITY_SYNC] Mismatch: got "${email}", session has "${sessionEmail}"`);
            return error("VALIDATION_ERROR", "Identity mismatch. Sync rejected.", { status: 400 });
        }

        const safeRefreshToken = asNonEmptyString(refreshToken);
        const safeAccessToken = asNonEmptyString(accessToken);
        const safeScope = typeof scope === "string" ? scope : "";
        const safeName = asNonEmptyString(name);

        // SMTP with Gmail XOAUTH2 requires the full mail scope.
        // `gmail.send` alone is insufficient for SMTP auth.
        const scopeStr = safeScope;
        const hasSendPermission = scopeStr.includes("gmail.send");
        const hasSmtpPermission = scopeStr.includes("mail.google.com");
        const hasReadPermission = scopeStr.includes("gmail.readonly");

        console.log(`[IDENTITY_SYNC] Syncing identity: ${email} | Send: ${hasSendPermission} | SMTP: ${hasSmtpPermission} | Read: ${hasReadPermission}`);

        const existingAccount = await prisma.gmailAccount.findFirst({
            where: {
                userId: session.user.id as string,
                email,
            },
            select: { id: true, refreshTokenEncrypted: true, isDefault: true },
        });

        // Update or Create the Identity Node
        const upsertData: any = {
            accountName: safeName || email.split("@")[0].replace(/[._]/g, " "),
            userId: session.user.id as string,
            email: email,
            scopeGranted: hasSmtpPermission,
            updatedAt: new Date(),
        };

        // Only update tokens if provided (NextAuth only provides refreshToken on first login or prompt:consent)
        if (safeRefreshToken) {
            upsertData.refreshTokenEncrypted = encrypt(safeRefreshToken);
        }
        if (safeAccessToken) {
            upsertData.accessTokenEncrypted = encrypt(safeAccessToken);
        }

        // For first-time account creation, refresh token is mandatory.
        // If user logged in without consent or already granted access previously, NextAuth may not have it.
        if (!existingAccount && !safeRefreshToken) {
            const res = ok({
                synced: false,
                actionRequired: "RE_LOGIN_GMAIL_SEND",
                reason: "MISSING_REFRESH_TOKEN",
            });
            Object.entries(corsHeaders).forEach(([key, value]) => {
                res.headers.set(key, value);
            });
            return res;
        }

        const account = await prisma.gmailAccount.upsert({
            where: {
                userId_email: {
                    userId: session.user.id as string,
                    email,
                },
            },
            update: upsertData,
            create: {
                ...upsertData,
                refreshTokenEncrypted: encrypt(safeRefreshToken as string),
                isDefault: !existingAccount?.isDefault,
            },
        });

        // Use custom Response to include CORS headers if needed or just use NextResponse with them
        const res = ok({
            synced: true,
            accountId: account.id,
            email: account.email,
            scopeGranted: account.scopeGranted,
            actionRequired: !hasSmtpPermission ? "RE_LOGIN_GMAIL_SMTP" : null
        });
        
        // Add CORS headers to the response
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.headers.set(key, value);
        });
        
        return res;

    } catch (err: any) {
        console.error("Identity Sync Failure:", err);
        const code = err?.code as string | undefined;
        if (code === "P2021") {
            const res = error("DB_SCHEMA_MISSING", "Identity tables are missing in the connected runtime database.", {
                status: 500,
                details: err?.meta ?? "Prisma error P2021",
            });
            Object.entries(corsHeaders).forEach(([key, value]) => {
                res.headers.set(key, value);
            });
            return res;
        }

        const details = err?.message || String(err);
        const res = error("INTERNAL_ERROR", "Identity sync failed.", { details });
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.headers.set(key, value);
        });
        return res;
    }
}
