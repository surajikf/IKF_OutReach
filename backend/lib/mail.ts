import nodemailer from "nodemailer";
import { getGlobalSettings, GlobalSettings } from "./settings";
import prisma from "./prisma";
import { decrypt } from "./encryption";

interface MailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

interface DispatchOptions {
    forceProvider?: "GMAIL" | "SMTP";
    disableFailover?: boolean;
    overrideGmailAccountId?: string;
    userId?: string;
}

type GmailAuthBundle = {
    success: true;
    gmailUser: string;
    refreshToken: string;
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    updateStatus: (status: string) => Promise<void>;
} | {
    success: false;
    error: string;
};

async function resolveGmailAuth(
    settings: GlobalSettings,
    dispatchOptions?: DispatchOptions
): Promise<GmailAuthBundle> {
    const configuredClientId = settings.googleClientId;
    const configuredClientSecret = settings.googleClientSecret;
    const envClientId = process.env.GOOGLE_CLIENT_ID || "";
    const envClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    let user = settings.googleEmail;
    let refreshToken = settings.googleRefreshToken;
    let identityId: string | null = null;
    let selectedIdentity: any = null;
    const ownerWhere = dispatchOptions?.userId ? { userId: dispatchOptions.userId } : {};

    try {
        if (dispatchOptions?.overrideGmailAccountId) {
            selectedIdentity = await prisma.gmailAccount.findFirst({
                where: {
                    ...ownerWhere,
                    id: dispatchOptions.overrideGmailAccountId,
                },
            });
        }

        if (!selectedIdentity) {
            selectedIdentity = await prisma.gmailAccount.findFirst({
                where: { ...ownerWhere, isDefault: true, scopeGranted: true },
                orderBy: { updatedAt: "desc" },
            });
        }

        if (!selectedIdentity) {
            selectedIdentity = await prisma.gmailAccount.findFirst({
                where: { ...ownerWhere, isDefault: true },
                orderBy: { updatedAt: "desc" },
            });
        }

        if (!selectedIdentity) {
            selectedIdentity = await prisma.gmailAccount.findFirst({
                where: ownerWhere,
                orderBy: { updatedAt: "desc" },
            });
        }

        if (selectedIdentity) {
            identityId = selectedIdentity.id;
            user = selectedIdentity.email;
            refreshToken = selectedIdentity.refreshTokenEncrypted ? decrypt(selectedIdentity.refreshTokenEncrypted) : refreshToken;
        }
    } catch (err) {
        console.warn("[MAIL] Identity lookup error:", err);
    }

    const credentialCandidates = [
        { source: "settings", clientId: configuredClientId, clientSecret: configuredClientSecret },
        { source: "env", clientId: envClientId, clientSecret: envClientSecret },
    ].filter(
        (c, i, arr) =>
            c.clientId &&
            c.clientSecret &&
            arr.findIndex((x) => x.clientId === c.clientId && x.clientSecret === c.clientSecret) === i
    );

    const isConfigurationValid = user && refreshToken && credentialCandidates.length > 0;
    if (!isConfigurationValid) {
        return { success: false, error: "Gmail configuration incomplete. No Primary Dispatcher linked." };
    }

    const updateStatus = async (status: string) => {
        if (identityId) {
            await prisma.gmailAccount.update({
                where: { id: identityId },
                data: { lastStatus: status, lastUsed: new Date() }
            }).catch(() => {});
        }
    };

    let activeCreds: { source: string; clientId: string; clientSecret: string } | null = null;
    let oauthAccessToken: string | null = null;
    let lastOAuthError = "Unauthorized";

    for (const creds of credentialCandidates) {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: creds.clientId,
                client_secret: creds.clientSecret,
                refresh_token: refreshToken as string,
                grant_type: "refresh_token",
            }),
        });

        if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json().catch(() => ({}));
            oauthAccessToken = typeof tokenData?.access_token === "string" ? tokenData.access_token : null;
            activeCreds = creds;
            break;
        }

        const errData = await tokenResponse.json().catch(() => ({}));
        const errMsg = errData.error_description || errData.error || "Unauthorized";
        lastOAuthError = String(errMsg);
        console.warn(`[MAIL] Gmail token refresh failed using ${creds.source} credentials: ${lastOAuthError}`);
    }

    if (!activeCreds) {
        await updateStatus(`ERROR: ${lastOAuthError}`);
        return {
            success: false,
            error: `Gmail OAuth failed: ${lastOAuthError}. Reconnect Gmail with the same OAuth client used for this app.`,
        };
    }

    let gmailUser = user as string;
    if (oauthAccessToken) {
        try {
            const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${oauthAccessToken}` },
            });
            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json().catch(() => ({}));
                const tokenEmail = typeof userInfo?.email === "string" ? userInfo.email : "";
                if (tokenEmail && tokenEmail !== gmailUser) {
                    console.warn(`[MAIL] Gmail identity mismatch detected. Using token identity ${tokenEmail} instead of ${gmailUser}.`);
                    gmailUser = tokenEmail;
                }
            }
        } catch {
            // non-blocking
        }
    }

    return {
        success: true,
        gmailUser,
        refreshToken: refreshToken as string,
        clientId: activeCreds.clientId,
        clientSecret: activeCreds.clientSecret,
        accessToken: oauthAccessToken || undefined,
        updateStatus,
    };
}

/**
 * STRATEGIC DISPATCH ENGINE
 * Implements high-availability failover logic.
 */
export async function sendStrategicEmail(options: MailOptions, dispatchOptions?: DispatchOptions) {
    const settings = await getGlobalSettings();
    const primaryProvider = dispatchOptions?.forceProvider || settings.emailProvider || "GMAIL";
    const autoFailover =
        dispatchOptions?.disableFailover === true
            ? false
            : (settings as any).autoFailover !== false; // Default true

    console.log(`[MAIL] Dispatch Protocol Engaged: ${primaryProvider} (Failover: ${autoFailover ? 'ON' : 'OFF'})`);

    let result: any;

    if (primaryProvider === "GMAIL") {
        result = await sendViaGmail(options, settings, dispatchOptions);
        
        // Automatic Pivot: If Gmail fails and failover is enabled, try SMTP fallback
        if (!result.success && autoFailover) {
            console.warn(`[MAIL] Primary Gmail Node Failed: ${result.error}. Engaging SMTP Fallback...`);
            result = await sendViaSMTP(options, settings);
            if (result.success) {
                result.failoverOccurred = true;
                result.messageId += " (via SMTP Fallback)";
            }
        }
    } else {
        // SMTP is primary
        result = await sendViaSMTP(options, settings);
    }

    return result;
}

/**
 * GENERIC SMTP DISPATCH
 */
async function sendViaSMTP({ to, subject, text, html }: MailOptions, settings: any) {
    try {
        const { smtpHost, smtpPort, smtpUser, smtpPassEncrypted, smtpSecure, smtpSenderEmail, smtpSenderName } = settings;

        if (!smtpHost || !smtpUser || !smtpPassEncrypted) {
            return { success: false, error: "SMTP configuration incomplete. (Host, User or Password missing)" };
        }

        const password = decrypt(smtpPassEncrypted);
        const senderEmail = smtpSenderEmail || smtpUser;
        const senderName = smtpSenderName || "IKF Outreach";

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort || 587,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: password,
            },
        });

        const diagnosticHtml = (html || "") + `<!-- Provider: SMTP | Dispatch Node: ${smtpHost} -->`;

        const sanitizedTo = (to || "").split(',')
            .map(e => e.trim())
            .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
            .join(', ');

        const info = await transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to: sanitizedTo,
            subject,
            text,
            html: diagnosticHtml,
        });

        console.log("[MAIL] SMTP communication dispatched:", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error("[MAIL] SMTP dispatch failed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * GMAIL OAUTH DISPATCH
 */
async function sendViaGmail(
    { to, subject, text, html }: MailOptions,
    settings: GlobalSettings,
    dispatchOptions?: DispatchOptions
) {
    const auth = await resolveGmailAuth(settings, dispatchOptions);
    if (!auth.success) {
        return { success: false, error: auth.error };
    }

    try {
        const diagnosticHtml = (html || "") + `<!-- Provider: GMAIL | Dispatch Node: ${auth.gmailUser} -->`;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: auth.gmailUser,
                clientId: auth.clientId,
                clientSecret: auth.clientSecret,
                refreshToken: auth.refreshToken,
                accessToken: auth.accessToken || undefined,
            } as any,
        });

        const sanitizedTo = (to || "").split(',')
            .map(email => email.trim())
            .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            .join(', ');

        const info = await transporter.sendMail({
            from: `"IKF Outreach" <${auth.gmailUser}>`,
            to: sanitizedTo,
            subject,
            text,
            html: diagnosticHtml,
        });

        await auth.updateStatus("HEALTHY");
        console.log("[MAIL] Gmail communication dispatched:", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        await auth.updateStatus(`ERROR: ${error.message}`);
        console.error("[MAIL] Gmail dispatch failed:", error);
        const message = String(error?.message || "");
        if (message.includes("535-5.7.8") || message.toLowerCase().includes("badcredentials")) {
            return {
                success: false,
                error: "Gmail SMTP auth rejected (535 BadCredentials). Reconnect Gmail for this signed-in account and grant consent again.",
            };
        }
        return { success: false, error: error.message };
    }
}

export async function createStrategicGmailDraft(options: MailOptions, dispatchOptions?: DispatchOptions) {
    const settings = await getGlobalSettings();
    const auth = await resolveGmailAuth(settings, dispatchOptions);
    if (!auth.success) {
        return { success: false, error: auth.error };
    }

    try {
        const sanitizedTo = (options.to || "").split(",")
            .map((email) => email.trim())
            .filter((email) => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            .join(", ");

        if (!sanitizedTo) {
            return { success: false, error: "No valid recipient email found." };
        }

        const lines = [
            `From: IKF Outreach <${auth.gmailUser}>`,
            `To: ${sanitizedTo}`,
            `Subject: ${options.subject || ""}`,
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "",
            options.html || (options.text || "").replace(/\n/g, "<br/>"),
        ];
        const mimeMessage = lines.join("\r\n");
        const raw = Buffer.from(mimeMessage)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");

        const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${auth.accessToken || ""}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: { raw } }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = data?.error?.message || `Gmail draft API failed (${response.status})`;
            await auth.updateStatus(`ERROR: ${detail}`);
            return { success: false, error: detail };
        }

        await auth.updateStatus("HEALTHY");
        return {
            success: true,
            draftId: data?.id,
            messageId: data?.message?.id || data?.message?.threadId || data?.id,
        };
    } catch (error: any) {
        await auth.updateStatus(`ERROR: ${error.message}`);
        return { success: false, error: error?.message || "Failed to create Gmail draft." };
    }
}
