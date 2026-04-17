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

/**
 * STRATEGIC DISPATCH ENGINE
 * Implements high-availability failover logic.
 */
export async function sendStrategicEmail(options: MailOptions) {
    const settings = await getGlobalSettings();
    const primaryProvider = settings.emailProvider || "GMAIL";
    const autoFailover = (settings as any).autoFailover !== false; // Default true

    console.log(`[MAIL] Dispatch Protocol Engaged: ${primaryProvider} (Failover: ${autoFailover ? 'ON' : 'OFF'})`);

    let result;

    if (primaryProvider === "GMAIL") {
        result = await sendViaGmail(options, settings);
        
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
async function sendViaGmail({ to, subject, text, html }: MailOptions, settings: GlobalSettings) {
    const clientId = settings.googleClientId;
    const clientSecret = settings.googleClientSecret;

    let user = settings.googleEmail;
    let refreshToken = settings.googleRefreshToken;
    let identityId: string | null = null;

    try {
        const identity = await prisma.gmailAccount.findFirst({
            where: { isDefault: true, scopeGranted: true },
            orderBy: { updatedAt: "desc" },
        });

        if (identity) {
            identityId = identity.id;
            user = identity.email;
            refreshToken = identity.refreshTokenEncrypted ? decrypt(identity.refreshTokenEncrypted) : refreshToken;
        }
    } catch (err) {
        console.warn("[MAIL] Identity lookup error:", err);
    }

    const isConfigurationValid = user && clientId && clientSecret && refreshToken;

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
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        if (!tokenResponse.ok) {
            const errData = await tokenResponse.json();
            const errMsg = errData.error_description || errData.error;
            await updateStatus(`ERROR: ${errMsg}`);
            return {
                success: false,
                error: `Gmail OAuth failed: ${errMsg}`,
            };
        }

        const diagnosticHtml = (html || "") + `<!-- Provider: GMAIL | Dispatch Node: ${user} -->`;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: user,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
            } as any,
        });

        const sanitizedTo = (to || "").split(',')
            .map(email => email.trim())
            .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            .join(', ');

        const info = await transporter.sendMail({
            from: `"IKF Outreach" <${user}>`,
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
        return { success: false, error: error.message };
    }
}
