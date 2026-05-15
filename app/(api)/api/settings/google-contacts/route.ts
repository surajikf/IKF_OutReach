import prisma from "@/lib/prisma";
import { ok, error } from "@/services/api-response";
import { getBackendSession } from "@/services/auth";

export async function GET(request: Request) {
  try {
    const session = await getBackendSession(request);
    const userId = session?.user?.id;
    if (!userId) {
      return error("UNAUTHORIZED", "Sign in required.", { status: 401 });
    }

    const accounts = await prisma.$queryRawUnsafe<Array<{
      id: string;
      accountName: string;
      email: string;
      lastStatus: string | null;
      lastUsed: Date | null;
      updatedAt: Date;
    }>>(
      `SELECT "id", "accountName", "email", "lastStatus", "lastUsed", "updatedAt"
       FROM "GoogleContactsAccount"
       WHERE "userId" = $1
       ORDER BY "updatedAt" DESC`,
      userId
    );

    const accountList = await Promise.all(accounts.map(async (account) => {
      const count = await prisma.client.count({
        where: {
          userId,
          source: "GMAIL",
          metadata: { path: ["importChannels"], array_contains: "google_contacts" },
          OR: [
            { metadata: { path: ["googleContactsAccountIds"], array_contains: account.id as any } },
            { gmailSourceAccount: account.email },
          ],
        },
      });

      return {
        ...account,
        count,
      };
    }));

    return ok({ accounts: accountList });
  } catch (err) {
    console.error("Failed to fetch Google Contacts accounts:", err);
    return error("INTERNAL_ERROR", "Internal Server Error");
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getBackendSession(request);
    const userId = session?.user?.id;
    if (!userId) {
      return error("UNAUTHORIZED", "Sign in required.", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return error("VALIDATION_ERROR", "ID required", { status: 400 });
    }

    const accountRows = await prisma.$queryRawUnsafe<Array<{ id: string; accountName: string; email: string }>>(
      `SELECT "id", "accountName", "email"
       FROM "GoogleContactsAccount"
       WHERE "id" = $1 AND "userId" = $2
       LIMIT 1`,
      id,
      userId,
    );
    const account = accountRows[0] || null;
    if (!account) {
      return error("FORBIDDEN", "Access denied for this Google Contacts account.", { status: 403 });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "GoogleContactsAccount"
       WHERE "id" = $1 AND "userId" = $2`,
      id,
      userId,
    );

    return ok({ deletedId: id, accountName: account.accountName, email: account.email });
  } catch (err) {
    console.error("Failed to delete Google Contacts account:", err);
    return error("INTERNAL_ERROR", "Internal Server Error");
  }
}
