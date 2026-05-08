import prisma from "./prisma";
import { decrypt } from "./encryption";

export interface GlobalSettings {
    aiProvider: string;
    aiModel: string;
    groqApiKey: string;
    openaiApiKey: string;
    googleClientId: string;
    googleClientSecret: string;
    googleRefreshToken: string;
    googleEmail: string;
    invoiceApiKey: string;
    invoiceApiUrl: string;
    emailProvider: string;
    projectName: string;
    projectLogo: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassEncrypted: string;
    smtpSecure: boolean;
    smtpSenderEmail: string;
    smtpSenderName: string;
    autoFailover: boolean;
}

function asString(value: unknown, field: string) {
    if (value == null) return "";
    if (typeof value !== "string") {
        throw new Error(`Invalid settings field type for ${field}.`);
    }
    return value;
}

function asNumber(value: unknown, field: string) {
    if (value == null) return 0;
    if (typeof value !== "number") {
        throw new Error(`Invalid settings field type for ${field}.`);
    }
    return value;
}

function asBoolean(value: unknown, field: string) {
    if (value == null) return false;
    if (typeof value !== "boolean") {
        throw new Error(`Invalid settings field type for ${field}.`);
    }
    return value;
}

function decryptIfPresent(value: unknown, field: string) {
    const raw = asString(value, field);
    if (!raw) return "";
    try {
        return decrypt(raw);
    } catch (err) {
        throw new Error(`Failed to decrypt ${field}: ${err instanceof Error ? err.message : String(err)}`);
    }
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
    const settings = await prisma.globalSettings.findUnique({
        where: { id: "singleton" },
    });

    if (!settings) {
        throw new Error("Missing GlobalSettings singleton.");
    }

    const baseSettings: GlobalSettings = {
        aiProvider: asString(settings.aiProvider, "aiProvider"),
        aiModel: asString(settings.aiModel, "aiModel"),
        groqApiKey: decryptIfPresent(settings.groqApiKeyEncrypted, "groqApiKeyEncrypted"),
        openaiApiKey: decryptIfPresent(settings.openaiApiKeyEncrypted, "openaiApiKeyEncrypted"),
        googleClientId: decryptIfPresent(settings.googleClientIdEncrypted, "googleClientIdEncrypted"),
        googleClientSecret: decryptIfPresent(settings.googleClientSecretEncrypted, "googleClientSecretEncrypted"),
        googleRefreshToken: decryptIfPresent(settings.googleRefreshTokenEncrypted, "googleRefreshTokenEncrypted"),
        googleEmail: decryptIfPresent(settings.googleEmailEncrypted, "googleEmailEncrypted"),
        invoiceApiKey: decryptIfPresent(settings.invoiceApiKeyEncrypted, "invoiceApiKeyEncrypted").trim(),
        invoiceApiUrl: decryptIfPresent(settings.invoiceApiUrlEncrypted, "invoiceApiUrlEncrypted").trim(),
        emailProvider: asString(settings.emailProvider, "emailProvider").toUpperCase().trim(),
        projectName: asString(settings.projectName, "projectName"),
        projectLogo: asString(settings.projectLogo, "projectLogo"),
        smtpHost: asString(settings.smtpHost, "smtpHost"),
        smtpPort: asNumber(settings.smtpPort, "smtpPort"),
        smtpUser: asString(settings.smtpUser, "smtpUser"),
        smtpPassEncrypted: asString(settings.smtpPassEncrypted, "smtpPassEncrypted"),
        smtpSecure: asBoolean(settings.smtpSecure, "smtpSecure"),
        smtpSenderEmail: asString(settings.smtpSenderEmail, "smtpSenderEmail"),
        smtpSenderName: asString(settings.smtpSenderName, "smtpSenderName"),
        autoFailover: asBoolean(settings.autoFailover, "autoFailover"),
    };

    const defaultAccount = await prisma.gmailAccount.findFirst({
        where: { isDefault: true, scopeGranted: true },
        orderBy: { updatedAt: "desc" },
    });

    if (defaultAccount) {
        baseSettings.googleEmail = defaultAccount.email;
        baseSettings.googleRefreshToken = decryptIfPresent(
            defaultAccount.refreshTokenEncrypted,
            "gmailAccount.refreshTokenEncrypted"
        );
    }

    if (!baseSettings.aiProvider || !baseSettings.aiModel || !baseSettings.emailProvider) {
        throw new Error("GlobalSettings is missing required runtime fields.");
    }

    return baseSettings;
}
