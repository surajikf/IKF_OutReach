import prisma from "@/lib/prisma";
import { encrypt, decrypt } from "@/services/encryption";
import { ok, error } from "@/services/api-response";
import { getGlobalSettings } from "@/services/settings";
import { getBackendSession, hasInvoiceAccess } from "@/services/auth";
import { z } from "zod";

const MASK = "********";

function isMaskedSecret(value?: string | null) {
    if (!value) return false;
    const v = value.trim();
    if (!v) return false;
    if (v === MASK) return true;
    return /^[*•●·]+$/.test(v) && v.length >= 6;
}

const settingsSchema = z.object({
    aiProvider: z.string().min(1),
    aiModel: z.string().min(1),
    groqApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    googleClientId: z.string().optional(),
    googleClientSecret: z.string().optional(),
    projectName: z.string().optional(),
    projectLogo: z.string().optional(),
    invoiceApiUrl: z.string().optional(),
    invoiceApiKey: z.string().optional(),
    emailProvider: z.enum(["GMAIL", "SMTP"]).optional(),
    
    // Generic SMTP
    smtpHost: z.string().optional(),
    smtpPort: z.number().int().optional(),
    smtpUser: z.string().optional(),
    smtpPass: z.string().optional(),
    smtpSecure: z.boolean().optional(),
    smtpSenderEmail: z.string().email("A valid email is required").optional().or(z.literal("")),
    smtpSenderName: z.string().optional(),
});

export async function GET(request: Request) {
    try {
        let settings: any;
        try {
            settings = await getGlobalSettings();
        } catch (settingsErr) {
            console.warn("Settings GET fallback: getGlobalSettings failed, using safe defaults.", settingsErr);
            settings = {
                projectName: "IKF Outreach",
                projectLogo: "",
                groqApiKey: "",
                openaiApiKey: "",
                googleClientId: "",
                googleClientSecret: "",
                invoiceApiKey: "",
                smtpPassEncrypted: "",
            };
        }
        const session = await getBackendSession(request);
        
        // Publicly accessible branding info
        const brandingInfo = {
            projectName: settings.projectName || "IKF Outreach",
            projectLogo: settings.projectLogo || "",
        };

        if (!session?.user?.id) {
            return ok(brandingInfo);
        }

        const canInvoice = await hasInvoiceAccess(request);
        let invoiceAccessRequested = false;
        try {
            const userRecord = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { onboardingSkippedSteps: true },
            });
            invoiceAccessRequested = Boolean(userRecord?.onboardingSkippedSteps?.includes("invoice_access_requested"));
        } catch (flagErr) {
            console.warn("Settings GET: onboardingSkippedSteps unavailable, disabling request flag.", flagErr);
        }
        const userScope = { userId: session.user.id };

        // Fetch current user's registered integrations and scoped sync stats.
        // Keep endpoint resilient if DB schema is partially migrated.
        let gmailAccounts: any[] = [];
        let invoiceCount = 0;
        let lastInvoice: { updatedAt: Date } | null = null;
        let gmailCount = 0;
        let gmailGenericCount = 0;
        let gmailRoleBasedCount = 0;
        let lastGmail: { updatedAt: Date } | null = null;
        let googleContactsCount = 0;
        let googleContactsLastSyncAt: Date | null = null;
        try {
            const contactsAccounts = await prisma.$queryRawUnsafe<Array<{ lastUsed: Date | null }>>(
                `SELECT "lastUsed"
                 FROM "GoogleContactsAccount"
                 WHERE "userId" = $1
                 ORDER BY "lastUsed" DESC NULLS LAST
                 LIMIT 1`,
                session.user.id
            );

            const gmailRoleRaw = await prisma.client.groupBy({
                by: ['isRoleBased'],
                _count: { _all: true },
                where: { ...userScope, source: "GMAIL" },
            });
            gmailRoleRaw.forEach((r: any) => {
                if (r.isRoleBased === true) gmailRoleBasedCount += r._count._all;
                else if (r.isRoleBased === false) gmailGenericCount += r._count._all;
                // null isRoleBased rows treated as generic
                else gmailGenericCount += r._count._all;
            });

            let lastGoogleContactsClient: { updatedAt: Date } | null = null;
            [gmailAccounts, invoiceCount, lastInvoice, gmailCount, lastGmail, googleContactsCount, lastGoogleContactsClient] = await Promise.all([
                prisma.gmailAccount.findMany({
                    where: userScope,
                    orderBy: { updatedAt: "desc" },
                    select: {
                        id: true,
                        userId: true,
                        accountName: true,
                        email: true,
                        lastStatus: true,
                        lastUsed: true,
                        updatedAt: true,
                    },
                }),
                canInvoice ? prisma.client.count({ where: { ...userScope, source: "INVOICE_SYSTEM" } }) : Promise.resolve(0),
                prisma.client.findFirst({
                    where: canInvoice ? { ...userScope, source: "INVOICE_SYSTEM" } : { id: "__none__" },
                    orderBy: { updatedAt: "desc" },
                    select: { updatedAt: true }
                }),
                prisma.client.count({ where: { ...userScope, source: "GMAIL" } }),
                prisma.client.findFirst({
                    where: { ...userScope, source: "GMAIL" },
                    orderBy: { updatedAt: "desc" },
                    select: { updatedAt: true }
                }),
                // Count only Google Contacts–sourced clients (distinct from Gmail inbox clients)
                prisma.client.count({
                    where: {
                        ...userScope,
                        source: "GMAIL",
                        metadata: { path: ["importChannels"], array_contains: "google_contacts" },
                    },
                }),
                prisma.client.findFirst({
                    where: {
                        ...userScope,
                        source: "GMAIL",
                        metadata: { path: ["importChannels"], array_contains: "google_contacts" },
                    },
                    orderBy: { updatedAt: "desc" },
                    select: { updatedAt: true },
                }),
            ]);
            googleContactsLastSyncAt = contactsAccounts[0]?.lastUsed ?? lastGoogleContactsClient?.updatedAt ?? null;
        } catch (integrationErr) {
            console.warn("Settings GET: integration stats query failed, using empty defaults.", integrationErr);
            gmailAccounts = [];
            invoiceCount = 0;
            lastInvoice = null;
            gmailCount = 0;
            lastGmail = null;
            googleContactsCount = 0;
            googleContactsLastSyncAt = null;
        }

        return ok({
            ...settings,
            ...brandingInfo,
            gmailAccounts: gmailAccounts, 
            invoiceStats: {
                count: invoiceCount,
                lastSyncAt: lastInvoice?.updatedAt || null
            },
            gmailStats: {
                count: gmailCount,
                generic: gmailGenericCount,
                roleBased: gmailRoleBasedCount,
                lastSyncAt: lastGmail?.updatedAt || null
            },
            googleContactsStats: {
                count: googleContactsCount,
                lastSyncAt: googleContactsLastSyncAt,
            },
            permissions: {
                canInvoice,
                invoiceAccessRequested,
            },
            groqApiKey: settings.groqApiKey ? MASK : "",
            openaiApiKey: settings.openaiApiKey ? MASK : "" ,
            googleClientId: settings.googleClientId ? MASK : "",
            googleClientSecret: settings.googleClientSecret ? MASK : "",
            invoiceApiKey: settings.invoiceApiKey ? MASK : "",
            smtpPass: settings.smtpPassEncrypted ? MASK : "",
        });
    } catch (err: any) {
        console.error("Settings GET failure:", err);
        return ok({
            projectName: "IKF Outreach",
            projectLogo: "",
            gmailAccounts: [],
            invoiceStats: { count: 0, lastSyncAt: null },
            gmailStats: { count: 0, lastSyncAt: null },
            googleContactsStats: { count: 0, lastSyncAt: null },
            permissions: { canInvoice: false, invoiceAccessRequested: false },
            groqApiKey: "",
            openaiApiKey: "",
            googleClientId: "",
            googleClientSecret: "",
            invoiceApiKey: "",
            smtpPass: "",
            degraded: true,
        });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = settingsSchema.safeParse(body);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Invalid payload.", { 
                status: 400, 
                details: parsed.error.flatten() 
            });
        }

        const data = parsed.data;
        const updateData: any = {
            aiProvider: data.aiProvider,
            aiModel: data.aiModel,
            projectName: data.projectName,
            projectLogo: data.projectLogo,
            emailProvider: data.emailProvider,
            smtpHost: data.smtpHost,
            smtpPort: data.smtpPort,
            smtpUser: data.smtpUser,
            smtpSecure: data.smtpSecure,
            smtpSenderEmail: data.smtpSenderEmail,
            smtpSenderName: data.smtpSenderName,
        };

        // Encrypt sensitive fields
        if (data.groqApiKey && !isMaskedSecret(data.groqApiKey)) updateData.groqApiKeyEncrypted = encrypt(data.groqApiKey);
        if (data.openaiApiKey && !isMaskedSecret(data.openaiApiKey)) updateData.openaiApiKeyEncrypted = encrypt(data.openaiApiKey);
        if (data.googleClientId && !isMaskedSecret(data.googleClientId)) updateData.googleClientIdEncrypted = encrypt(data.googleClientId);
        if (data.googleClientSecret && !isMaskedSecret(data.googleClientSecret)) updateData.googleClientSecretEncrypted = encrypt(data.googleClientSecret);
        if (data.invoiceApiKey && !isMaskedSecret(data.invoiceApiKey)) updateData.invoiceApiKeyEncrypted = encrypt(data.invoiceApiKey);
        if (data.smtpPass && !isMaskedSecret(data.smtpPass)) updateData.smtpPassEncrypted = encrypt(data.smtpPass);
        
        // Handle invoice URL separately if provided
        if (data.invoiceApiUrl) updateData.invoiceApiUrlEncrypted = encrypt(data.invoiceApiUrl);

        // Perform sanitized upsert
        const final = await prisma.globalSettings.upsert({
            where: { id: "singleton" },
            update: updateData,
            create: { id: "singleton", ...updateData },
        });

        return ok(final);

    } catch (err: any) {
        console.error("Settings Persistence Failure:", err);
        return error("INTERNAL_ERROR", "Persistence failed. Ensure database schema is synchronized.");
    }
}
