import prisma from "@/lib/prisma";
import { encrypt } from "@/services/encryption";
import { ok, error } from "@/services/api-response";
import { getBackendSession } from "@/services/auth";

/**
 * CORS PREFLIGHT HANDLER
 */
export async function OPTIONS(request: Request) {
    const origin = request.headers.get("origin") || "http://localhost:3000";
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
    const origin = request.headers.get("origin") || "http://localhost:3000";
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
        // Accept either gmail.send or mail.google.com — both grant send permission.
        // This matches the check used in the Google OAuth callback.
        const hasSendPermission = scopeStr.includes("gmail.send") || scopeStr.includes("mail.google.com");
        const hasReadPermission = scopeStr.includes("gmail.readonly");

        console.log(`[IDENTITY_SYNC] Syncing identity: ${email} | Send: ${hasSendPermission} | Read: ${hasReadPermission}`);

        const existingAccount = await prisma.gmailAccount.findFirst({
            where: {
                userId: session.user.id as string,
                email,
            },
            select: { id: true, refreshTokenEncrypted: true, isDefault: true, scopeGranted: true },
        });

        // Update or Create the Identity Node.
        // Never downgrade scopeGranted from true → false: the OAuth callback is the
        // authoritative source for what scopes were actually granted. IdentitySync
        // only sees the NextAuth session token which may carry a subset of scopes.
        const resolvedScopeGranted = existingAccount?.scopeGranted ? true : hasSendPermission;

        const upsertData: any = {
            accountName: safeName || email.split("@")[0].replace(/[._]/g, " "),
            userId: session.user.id as string,
            email: email,
            scopeGranted: resolvedScopeGranted,
            updatedAt: new Date(),
        };

        // Only update tokens when the incoming token actually has Gmail send permission.
        // NextAuth session tokens only carry openid/profile scopes and must NOT overwrite
        // a Gmail-specific refresh token that was obtained via the Gmail connect flow.
        if (safeRefreshToken && hasSendPermission) {
            upsertData.refreshTokenEncrypted = encrypt(safeRefreshToken);
            console.log(`[IDENTITY_SYNC] Saving send-capable refresh token for ${email}`);
        } else if (safeRefreshToken && !hasSendPermission) {
            console.log(`[IDENTITY_SYNC] Skipping token update for ${email} — incoming token lacks send scope (NextAuth-only token)`);
        }

        // For new accounts a refresh token is mandatory — guard before hitting the DB.
        if (!existingAccount && !safeRefreshToken) {
            const res = ok({ synced: false, actionRequired: "RE_LOGIN_GMAIL_SEND", reason: "MISSING_REFRESH_TOKEN" });
            Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
            return res;
        }

        const account = await prisma.gmailAccount.upsert({
            where: { userId_email: { userId: session.user.id as string, email } },
            update: upsertData,
            create: {
                ...upsertData,
                refreshTokenEncrypted: encrypt(safeRefreshToken!),
                isDefault: !existingAccount?.isDefault,
            },
        });

        // Use custom Response to include CORS headers if needed or just use NextResponse with them
        const res = ok({
            synced: true,
            accountId: account.id,
            email: account.email,
            scopeGranted: account.scopeGranted,
            actionRequired: !hasSendPermission ? "RE_LOGIN_GMAIL_SMTP" : null
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

