import prisma from "@/backend/lib/prisma";
import { encrypt } from "@/backend/lib/encryption";
import { ok, error } from "@/backend/lib/api-response";
import { getBackendSession } from "@/backend/lib/auth";

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
        const { email, refreshToken, accessToken, scope, name } = body;

        // session.user.email is the correct path (not session.email)
        const sessionEmail = session.user?.email;
        if (!email || email !== sessionEmail) {
            console.warn(`[IDENTITY_SYNC] Mismatch: got "${email}", session has "${sessionEmail}"`);
            return error("VALIDATION_ERROR", "Identity mismatch. Sync rejected.", { status: 400 });
        }

        // Check if sending scope was granted: https://www.googleapis.com/auth/gmail.send
        const scopeStr = scope || "";
        const hasSendPermission = scopeStr.includes("gmail.send");
        const hasReadPermission = scopeStr.includes("gmail.readonly");

        console.log(`[IDENTITY_SYNC] Syncing identity: ${email} | Send: ${hasSendPermission} | Read: ${hasReadPermission}`);

        // Update or Create the Identity Node
        const upsertData: any = {
            accountName: session.name || email.split("@")[0].replace(/[._]/g, " "),
            email: email,
            scopeGranted: hasSendPermission,
            updatedAt: new Date(),
        };

        // Only update tokens if provided (NextAuth only provides refreshToken on first login or prompt:consent)
        if (refreshToken) {
            upsertData.refreshTokenEncrypted = encrypt(refreshToken);
        }
        if (accessToken) {
            upsertData.accessTokenEncrypted = encrypt(accessToken);
        }

        const account = await prisma.gmailAccount.upsert({
            where: { email: email },
            update: upsertData,
            create: {
                ...upsertData,
                refreshTokenEncrypted: encrypt(refreshToken || ""), 
                isDefault: true, 
            },
        });

        // Use custom Response to include CORS headers if needed or just use NextResponse with them
        const res = ok({
            synced: true,
            accountId: account.id,
            email: account.email,
            scopeGranted: account.scopeGranted,
            actionRequired: !hasSendPermission ? "RE_LOGIN_GMAIL_SEND" : null
        });
        
        // Add CORS headers to the response
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.headers.set(key, value);
        });
        
        return res;

    } catch (err: any) {
        console.error("Identity Sync Failure:", err);
        const res = error("INTERNAL_ERROR", "Identity sync failed.", { details: err.message });
        Object.entries(corsHeaders).forEach(([key, value]) => {
            res.headers.set(key, value);
        });
        return res;
    }
}
