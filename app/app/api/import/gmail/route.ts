import prisma from "@/backend/lib/prisma";
import { runGmailSync } from "@/backend/lib/workers/gmail-sync";
import { ok, error } from "@/backend/lib/api-response";
import { createClient } from "@/backend/lib/supabase/server";
import { z } from "zod";

const gmailImportSchema = z.object({
    accountId: z.string().min(1, "Account ID required"),
    options: z.object({
        sourceFolders: z.array(z.enum(["INBOX", "SENT", "LABEL"])).min(1).max(3).optional(),
        customLabels: z.array(z.string().min(1)).max(10).optional(),
        extractHeaders: z.array(z.enum(["from", "to", "cc", "bcc"])).min(1).max(4).optional(),
        excludedDomains: z.array(z.string().min(1)).max(100).optional(),
        excludedKeywords: z.array(z.string().min(1)).max(100).optional(),
        persistBlockList: z.boolean().optional(),
        includeAutomatedEmails: z.boolean().optional(),
    }).optional(),
});

import { getBackendSession, isApprovedUser } from "@/backend/lib/auth";

export async function POST(request: Request) {
    try {
        if (!await isApprovedUser(request)) {
            return error("FORBIDDEN", "Unauthorized access. Level-5 Clearance Required.", {
                status: 403,
            });
        }
        const session = await getBackendSession(request);
        if (!session?.user?.id) {
            return error("UNAUTHORIZED", "Sign in required.", { status: 401 });
        }

        const json = await request.json();
        const parsed = gmailImportSchema.safeParse(json);

        if (!parsed.success) {
            return error("VALIDATION_ERROR", "Account ID required", {
                status: 400,
                details: parsed.error.flatten(),
            });
        }

        const { accountId, options } = parsed.data;

        const account = await prisma.gmailAccount.findFirst({
            where: { id: accountId, userId: session.user.id },
        });
        if (!account) {
            return error("NOT_FOUND", "Account not found for current user", { status: 404 });
        }

        // Check for immediate execution flag
        const url = new URL(request.url);
        const immediate = url.searchParams.get("immediate") === "true";

        if (immediate) {
            console.log(`[GMAIL_ROUTE] Running immediate sync for account: ${accountId}`);
            try {
                const result = await runGmailSync(accountId, options);
                return ok({ ...result, immediate: true });
            } catch (syncErr: any) {
                console.error("[GMAIL_ROUTE] Immediate sync failed:", syncErr);
                return error("INTEGRATION_ERROR", `Sync failed: ${syncErr.message}`, { status: 502 });
            }
        }

        // Fast UX: run Gmail import in the background as a job.
        const job = await (prisma as any).job.create({
            data: {
                type: "GMAIL_IMPORT",
                status: "QUEUED",
                progress: 0,
                payload: { accountId, options: options || null },
            },
        });

        return ok({ jobId: job.id }, { status: 202 });
    } catch (err: any) {
        console.error("Gmail Sync Route Error:", err);
        return error("INTERNAL_ERROR", "Internal Server Error", {
            details: { message: err.message },
        });
    }
}
