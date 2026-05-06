import prisma from "@/backend/lib/prisma";
import crypto from "crypto";
import { ok, error } from "@/backend/lib/api-response";
import { z } from "zod";
import { isAdmin } from "@/backend/lib/auth";

const RAW_ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || "default_insecure_key_123456789012";
const ENCRYPTION_KEY = RAW_ENCRYPTION_KEY.padEnd(32, "0").substring(0, 32);

const RAW_ENCRYPTION_IV = process.env.ENCRYPTION_IV || "default_iv_12345";
const ENCRYPTION_IV = RAW_ENCRYPTION_IV.padEnd(16, "0").substring(0, 16);

function encrypt(text: string): string {
    if (!text) return text;
    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(ENCRYPTION_KEY),
        Buffer.from(ENCRYPTION_IV),
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString("hex");
}

const zohoSettingsSchema = z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    pipelineName: z.string().optional(),
    stageName: z.string().optional(),
    zohoFieldMapping: z.array(z.any()).optional(),
    zohoSyncAllToMetadata: z.boolean().optional(),
    zohoExcludedFields: z.array(z.string()).optional(),
    zohoStages: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
    try {
        if (!await isAdmin(req)) {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const settings = await prisma.globalSettings.findFirst();

        return ok({
            hasClientId: !!settings?.zohoClientIdEncrypted,
            hasClientSecret: !!settings?.zohoClientSecretEncrypted,
            hasRefreshToken: !!settings?.zohoRefreshTokenEncrypted,
            pipelineName: settings?.zohoPipelineName || "Sales Pipeline",
            stageName: settings?.zohoStageName || "Closed Won",
            zohoFieldMapping: settings?.zohoFieldMapping || [],
            zohoSyncAllToMetadata: (settings as any)?.zohoSyncAllToMetadata ?? false,
            zohoExcludedFields: (settings as any)?.zohoExcludedFields || [],
            zohoStages: (settings as any)?.zohoStages || [],
        });
    } catch (err) {
        console.error("Zoho Settings GET Error:", err);
        return error("INTERNAL_ERROR", "Failed to fetch settings.");
    }
}

export async function PUT(req: Request) {
    try {
        if (!await isAdmin(req)) {
            return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
        }

        const json = await req.json();
        const parsed = zohoSettingsSchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Invalid Zoho settings payload", {
                status: 400,
                details: parsed.error.flatten(),
            });
        }

        const { clientId, clientSecret, pipelineName, stageName, zohoFieldMapping, zohoSyncAllToMetadata, zohoExcludedFields, zohoStages } = parsed.data;

        let settings = await prisma.globalSettings.findFirst();

        const updateData: any = {};

        if (clientId) updateData.zohoClientIdEncrypted = encrypt(clientId);
        if (clientSecret) updateData.zohoClientSecretEncrypted = encrypt(clientSecret);
        if (pipelineName) updateData.zohoPipelineName = pipelineName;
        if (stageName) updateData.zohoStageName = stageName;
        if (zohoFieldMapping) updateData.zohoFieldMapping = zohoFieldMapping;
        if (zohoSyncAllToMetadata !== undefined) updateData.zohoSyncAllToMetadata = zohoSyncAllToMetadata;
        if (zohoExcludedFields) updateData.zohoExcludedFields = zohoExcludedFields;
        if (zohoStages) updateData.zohoStages = zohoStages;

        const { zohoFieldMapping: mappingToSave, zohoExcludedFields: excludedToSave, zohoStages: stagesToSave, zohoSyncAllToMetadata: syncAllToSave, ...standardData } = updateData;

        if (settings) {
            console.log("[ZOHO_SETTINGS] Updating existing singleton. Standard fields:", Object.keys(standardData));
            
            // Only update fields that definitely exist in the base Prisma client
            const baseFields: any = {};
            if (standardData.zohoClientIdEncrypted) baseFields.zohoClientIdEncrypted = standardData.zohoClientIdEncrypted;
            if (standardData.zohoClientSecretEncrypted) baseFields.zohoClientSecretEncrypted = standardData.zohoClientSecretEncrypted;
            if (standardData.zohoPipelineName) baseFields.zohoPipelineName = standardData.zohoPipelineName;
            if (standardData.zohoStageName) baseFields.zohoStageName = standardData.zohoStageName;

            if (Object.keys(baseFields).length > 0) {
                await (prisma.globalSettings as any).update({
                    where: { id: settings.id },
                    data: baseFields,
                });
            }
            
            if (zohoSyncAllToMetadata !== undefined) {
                try {
                    await prisma.$executeRawUnsafe(
                        `UPDATE "GlobalSettings" SET "zohoSyncAllToMetadata" = $1 WHERE id = $2`,
                        zohoSyncAllToMetadata,
                        settings.id
                    );
                } catch (e) {
                    console.error("Raw SQL Update Error (zohoSyncAllToMetadata):", e);
                }
            }

            if (excludedToSave) {
                console.log("[ZOHO_SETTINGS] Updating exclusions via raw SQL");
                try {
                    await prisma.$executeRawUnsafe(
                        `UPDATE "GlobalSettings" SET "zohoExcludedFields" = $1::jsonb WHERE id = $2`,
                        JSON.stringify(excludedToSave),
                        settings.id
                    );
                } catch (e) {
                    console.error("Raw SQL Update Error (zohoExcludedFields):", e);
                }
            }

            if (stagesToSave) {
                console.log("[ZOHO_SETTINGS] Updating stages via raw SQL");
                try {
                    await prisma.$executeRawUnsafe(
                        `UPDATE "GlobalSettings" SET "zohoStages" = $1::jsonb WHERE id = $2`,
                        JSON.stringify(stagesToSave),
                        settings.id
                    );
                } catch (e) {
                    console.error("Raw SQL Update Error (zohoStages):", e);
                }
            }
        } else {
            console.log("[ZOHO_SETTINGS] Creating new singleton.");
            // Create minimal record first
            await prisma.$executeRawUnsafe(
                `INSERT INTO "GlobalSettings" (id, "zohoPipelineName", "zohoStageName") VALUES ('singleton', $1, $2) ON CONFLICT (id) DO NOTHING`,
                pipelineName || "Sales Pipeline",
                stageName || "Closed Won"
            );

            if (clientId) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "GlobalSettings" SET "zohoClientIdEncrypted" = $1 WHERE id = 'singleton'`,
                    encrypt(clientId)
                );
            }
            if (clientSecret) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "GlobalSettings" SET "zohoClientSecretEncrypted" = $1 WHERE id = 'singleton'`,
                    encrypt(clientSecret)
                );
            }
            if (zohoSyncAllToMetadata !== undefined) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "GlobalSettings" SET "zohoSyncAllToMetadata" = $1 WHERE id = 'singleton'`,
                    zohoSyncAllToMetadata
                );
            }
            if (mappingToSave) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "GlobalSettings" SET "zohoFieldMapping" = $1::jsonb WHERE id = 'singleton'`,
                    JSON.stringify(mappingToSave)
                );
            }
            if (excludedToSave) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "GlobalSettings" SET "zohoExcludedFields" = $1::jsonb WHERE id = 'singleton'`,
                    JSON.stringify(excludedToSave)
                );
            }
            if (stagesToSave) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "GlobalSettings" SET "zohoStages" = $1::jsonb WHERE id = 'singleton'`,
                    JSON.stringify(stagesToSave)
                );
            }
        }

        return ok({ updated: true });
    } catch (err: any) {
        console.error("Zoho Settings PUT Error:", err);
        return error("INTERNAL_ERROR", "Failed to update settings.", {
            details: { message: err.message, stack: err.stack }
        });
    }
}
