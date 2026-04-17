import prisma from "./prisma";
import { decrypt } from "./encryption";

/** Default when neither DB nor INVOICE_API_URL is set */
export const DEFAULT_INVOICE_API_URL =
    "http://192.168.2.79/invoice/api/ApiService.asmx";

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

    // SMTP Node
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassEncrypted: string;
    smtpSecure: boolean;
    smtpSenderEmail: string;
    smtpSenderName: string;

    // System Strategy
    autoFailover: boolean;
}

const DEFAULT_SETTINGS: GlobalSettings = {
    aiProvider: "Groq",
    aiModel: "llama-3.3-70b-versatile",
    groqApiKey: "",
    openaiApiKey: "",
    googleClientId: "",
    googleClientSecret: "",
    googleRefreshToken: "",
    googleEmail: "",
    invoiceApiKey: "",
    invoiceApiUrl: "",
    emailProvider: "GMAIL",
    projectName: "IKF Outreach",
    projectLogo: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassEncrypted: "",
    smtpSecure: false,
    smtpSenderEmail: "",
    smtpSenderName: "IKF Outreach",
    autoFailover: true
};

export async function getGlobalSettings(): Promise<GlobalSettings> {
    try {
        const settings = await prisma.globalSettings.findUnique({
            where: { id: "singleton" },
        });
        if (settings) return await processSettings(settings);
        return getDefaultSettings();
    } catch (error) {
        console.error("Settings Hub Failure:", error);
        return getDefaultSettings();
    }
}

function getDefaultSettings(): GlobalSettings {
    return {
        ...DEFAULT_SETTINGS,
        groqApiKey: process.env.GROQ_API_KEY || "",
        openaiApiKey: process.env.OPENAI_API_KEY || "",
        googleClientId: process.env.GOOGLE_CLIENT_ID || "",
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        invoiceApiKey: process.env.INVOICE_API_KEY?.trim() || "",
        invoiceApiUrl: process.env.INVOICE_API_URL?.trim() || DEFAULT_INVOICE_API_URL,
        emailProvider: (process.env.EMAIL_PROVIDER as any) || "GMAIL",
    };
}

async function processSettings(settings: any): Promise<GlobalSettings> {
    const safeDecrypt = (val: string | null) => {
        if (!val) return "";
        try { return decrypt(val); } catch (e) { return ""; }
    };

    const get = (obj: any, key: string) => obj[key] !== undefined ? obj[key] : obj[key.toLowerCase()];

    const baseSettings: GlobalSettings = {
        aiProvider: get(settings, 'aiProvider') || "Groq",
        aiModel: get(settings, 'aiModel') || "llama-3.3-70b-versatile",
        groqApiKey: safeDecrypt(get(settings, 'groqApiKeyEncrypted')) || process.env.GROQ_API_KEY || "",
        openaiApiKey: safeDecrypt(get(settings, 'openaiApiKeyEncrypted')) || process.env.OPENAI_API_KEY || "",
        googleClientId: safeDecrypt(get(settings, 'googleClientIdEncrypted')) || process.env.GOOGLE_CLIENT_ID || "",
        googleClientSecret: safeDecrypt(get(settings, 'googleClientSecretEncrypted')) || process.env.GOOGLE_CLIENT_SECRET || "",
        googleRefreshToken: safeDecrypt(get(settings, 'googleRefreshTokenEncrypted')) || process.env.GOOGLE_REFRESH_TOKEN || "",
        googleEmail: safeDecrypt(get(settings, 'googleEmailEncrypted')) || process.env.EMAIL_USER || "",
        invoiceApiKey: (safeDecrypt(get(settings, 'invoiceApiKeyEncrypted')) || process.env.INVOICE_API_KEY || "").trim(),
        invoiceApiUrl: safeDecrypt(get(settings, 'invoiceApiUrlEncrypted'))?.trim() || process.env.INVOICE_API_URL?.trim() || DEFAULT_INVOICE_API_URL,
        emailProvider: (String(get(settings, 'emailProvider') || (process.env.EMAIL_PROVIDER as any) || "GMAIL")).toUpperCase().trim(),
        projectName: get(settings, 'projectName') || "IKF Outreach",
        projectLogo: get(settings, 'projectLogo') || "",
        
        // SMTP Diagnostics
        smtpHost: get(settings, 'smtpHost') || "",
        smtpPort: get(settings, 'smtpPort') || 587,
        smtpUser: get(settings, 'smtpUser') || "",
        smtpPassEncrypted: get(settings, 'smtpPassEncrypted') || "",
        smtpSecure: get(settings, 'smtpSecure') ?? false,
        smtpSenderEmail: get(settings, 'smtpSenderEmail') || "",
        smtpSenderName: get(settings, 'smtpSenderName') || "IKF Outreach",
        
        autoFailover: get(settings, 'autoFailover') ?? true
    };

    // Linked Identity Override
    try {
        const defaultAccount = await (prisma.gmailAccount as any).findFirst({
            where: { isDefault: true, scopeGranted: true },
            orderBy: { updatedAt: "desc" }
        });
        if (defaultAccount) {
            baseSettings.googleEmail = defaultAccount.email;
            baseSettings.googleRefreshToken = safeDecrypt(defaultAccount.refreshTokenEncrypted || "");
        }
    } catch (err) {}

    return baseSettings;
}
