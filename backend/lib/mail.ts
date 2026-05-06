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
    const configuredClientId = settings.googleClientId;
    const configuredClientSecret = settings.googleClientSecret;
    const envClientId = process.env.GOOGLE_CLIENT_ID || "";
    const envClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    let user = settings.googleEmail;
    let refreshToken = settings.googleRefreshToken;
    let identityId: string | null = null;
    let selectedIdentity: any = null;

    try {
        if (dispatchOptions?.overrideGmailAccountId) {
            selectedIdentity = await prisma.gmailAccount.findUnique({
                where: { id: dispatchOptions.overrideGmailAccountId },
            });
        }

        if (!selectedIdentity) {
            selectedIdentity = await prisma.gmailAccount.findFirst({
                where: { isDefault: true, scopeGranted: true },
                orderBy: { updatedAt: "desc" },
            });
        }

        // Fallback to latest default account even if scope flag is stale
        if (!selectedIdentity) {
            selectedIdentity = await prisma.gmailAccount.findFirst({
                where: { isDefault: true },
                orderBy: { updatedAt: "desc" },
            });
        }

        // Final fallback: latest connected Gmail account
        if (!selectedIdentity) {
            selectedIdentity = await prisma.gmailAccount.findFirst({
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
        return {
            success: false,
            error: "Gmail configuration incomplete. No Primary Dispatcher linked."
        };
    }

    const updateStatus = async (status: string) => {
        if (identityId) {
            await prisma.gmailAccount.update({
                where: { id: identityId },
                data: { lastStatus: status, lastUsed: new Date() }
            }).catch(() => {});
        }
    };

    try {
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
                    refresh_token: refreshToken,
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

        const diagnosticHtml = (html || "") + `<!-- Provider: GMAIL | Dispatch Node: ${gmailUser} -->`;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: gmailUser,
                clientId: activeCreds.clientId,
                clientSecret: activeCreds.clientSecret,
                refreshToken: refreshToken,
                accessToken: oauthAccessToken || undefined,
            } as any,
        });

        const sanitizedTo = (to || "").split(',')
            .map(email => email.trim())
            .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            .join(', ');

        const info = await transporter.sendMail({
            from: `"IKF Outreach" <${gmailUser}>`,
            to: sanitizedTo,
            subject,
            text,
            html: diagnosticHtml,
        });

        await updateStatus("HEALTHY");
        console.log("[MAIL] Gmail communication dispatched:", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        await updateStatus(`ERROR: ${error.message}`);
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
