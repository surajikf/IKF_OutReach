import prisma from "../prisma";
import { decrypt, encrypt } from "../encryption";
import { isRoleBasedEmail } from "../email-utils";

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;

  return await new Promise<R[]>((resolve, reject) => {
    const runNext = () => {
      if (nextIndex >= items.length && active === 0) {
        resolve(results);
        return;
      }

      while (active < limit && nextIndex < items.length) {
        const i = nextIndex++;
        active++;
        fn(items[i], i)
          .then((r) => {
            results[i] = r;
            active--;
            runNext();
          })
          .catch((e) => reject(e));
      }
    };

    runNext();
  });
}

export async function runGmailSync(accountId: string) {
  console.log(`[GMAIL_SYNC] Starting sync for account: ${accountId}`);

  // 1) Fetch Gmail account and ensure access token.
  const account = await prisma.gmailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error("Gmail account not found.");
  }

  const accessTokenDecrypted = decrypt(account.accessTokenEncrypted || "");
  let accessToken = accessTokenDecrypted;

  // Refresh token if expired
  if (!accessToken || !account.expiresAt || account.expiresAt < new Date()) {
    console.log("[GMAIL_SYNC] Refreshing access token...");
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });

    let clientId = settings?.googleClientIdEncrypted ? decrypt(settings.googleClientIdEncrypted) : "";
    let clientSecret = settings?.googleClientSecretEncrypted ? decrypt(settings.googleClientSecretEncrypted) : "";

    // Fallback to environment variables if DB is unconfigured
    if (!clientId) clientId = process.env.GOOGLE_CLIENT_ID || "";
    if (!clientSecret) clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials missing (tried DB and .env).");
    }

    const refreshToken = decrypt(account.refreshTokenEncrypted);

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

    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(`Gmail token refresh failed: ${tokens?.error_description || tokens?.error || "Unknown error"}`);
    }

    accessToken = tokens.access_token;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.gmailAccount.update({
      where: { id: accountId },
      data: {
        accessTokenEncrypted: encrypt(accessToken),
        expiresAt,
      },
    });
  }

  // 2) Fetch recent messages
  console.log("[GMAIL_SYNC] Fetching messages from Google API...");
  const messagesRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40&q=after:2024/01/01`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!messagesRes.ok) {
    throw new Error("Failed to read Gmail messages.");
  }

  const { messages = [] } = await messagesRes.json();
  console.log(`[GMAIL_SYNC] Found ${messages.length} messages.`);

  // 3) Extract headers (From/To)
  const contacts = new Map<string, { email: string; name: string }>();

  const parseEmailHeader = (headerValue: string): { email: string; name: string }[] => {
    const parts = headerValue.split(",");
    const out: { email: string; name: string }[] = [];
    parts.forEach((part) => {
      const emailMatch = part.match(/<(.+@.+)>/);
      const email = emailMatch ? emailMatch[1].trim() : part.trim();

      if (email.includes("@")) {
        let name = "";
        if (emailMatch) {
          name = part.replace(emailMatch[0], "").replace(/["']/g, "").trim();
        }
        out.push({ email, name });
      }
    });
    return out;
  };

  const detailItems = await mapLimit(messages, 5, async (msg: any) => {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!detailRes.ok) return null;
    return await detailRes.json();
  });

  for (const detail of detailItems) {
    const headers = (detail as any)?.payload?.headers || [];
    headers.forEach((h: any) => {
      const results = parseEmailHeader(h.value);
      results.forEach((res: any) => {
        const emailLower = String(res.email || "").toLowerCase();
        if (
          emailLower &&
          emailLower !== String(account.email || "").toLowerCase() &&
          !emailLower.includes("@noreply") &&
          !emailLower.includes("google.com")
        ) {
          contacts.set(emailLower, { email: emailLower, name: res.name });
        }
      });
    });
  }

  // 4) Upsert Clients
  console.log(`[GMAIL_SYNC] Processing ${contacts.size} extracted contacts...`);
  const emailList = Array.from(contacts.keys());
  const existing = await prisma.client.findMany({
    where: { email: { in: emailList } },
    select: { email: true, source: true },
  });
  const existingMap = new Map(existing.map((c) => [String(c.email).toLowerCase(), c.source]));

  const contactEntries = Array.from(contacts.entries());
  const upsertResults = await mapLimit(contactEntries, 5, async ([email, info]: any) => {
    const existingSource = existingMap.get(String(email).toLowerCase());
    const isConflict = !!(existingSource && existingSource !== "GMAIL");

    try {
      await prisma.client.upsert({
        where: {
          source_externalId: {
            source: "GMAIL",
            externalId: `${account.id}:${email}`,
          },
        },
        update: {
          clientName: info.name || String(email).split("@")[0].replace(/[._]/g, " "),
          contactPerson: info.name || null,
          gmailSourceAccount: account.email,
          isRoleBased: isRoleBasedEmail(email),
        },
        create: {
          clientName: info.name || String(email).split("@")[0].replace(/[._]/g, " "),
          contactPerson: info.name || null,
          email: email,
          industry: "Corporate",
          relationshipLevel: "Warm Lead",
          source: "GMAIL",
          externalId: `${account.id}:${email}`,
          gmailSourceAccount: account.email,
          isRoleBased: isRoleBasedEmail(email),
        },
      });
    } catch (err) {
       console.error(`[GMAIL_SYNC] Upsert failed for ${email}:`, err);
    }

    return { isConflict };
  });

  const importedCount = upsertResults.length;
  const conflictCount = upsertResults.filter((r) => r.isConflict).length;

  console.log(`[GMAIL_SYNC] Sync complete. Imported: ${importedCount}, Conflicts: ${conflictCount}`);
  return { count: importedCount, conflicts: conflictCount };
}
