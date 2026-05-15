import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { getBackendSession, isApprovedUser } from "@/services/auth";
import { runGoogleContactsSync } from "@/services/workers/google-contacts-sync";
import { z } from "zod";

const schema = z.object({
  accountId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!await isApprovedUser(request)) {
      return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
    }
    const session = await getBackendSession(request);
    if (!session?.user?.id) return error("UNAUTHORIZED", "Sign in required.", { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return error("VALIDATION_ERROR", "Account ID required", { status: 400, details: parsed.error.flatten() });
    const { accountId } = parsed.data;

    const accountRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id"
       FROM "GoogleContactsAccount"
       WHERE "id" = $1 AND "userId" = $2
       LIMIT 1`,
      accountId,
      session.user.id
    );
    const account = accountRows[0] || null;
    if (!account) return error("NOT_FOUND", "Account not found for current user", { status: 404 });

    const result = await runGoogleContactsSync(accountId);
    return ok(result);
  } catch (err: any) {
    console.error("Google Contacts Sync Route Error:", err);
    return error("INTERNAL_ERROR", err?.message || "Internal Server Error", { status: 500 });
  }
}

