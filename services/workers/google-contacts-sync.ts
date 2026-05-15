import prisma from "@/lib/prisma";
import { decrypt, encrypt } from "../encryption";

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

function deriveNameFromEmail(email: string) {
  const local = String(email || "").split("@")[0] || "";
  const tokens = local
    .replace(/[0-9]+/g, " ")
    .replace(/[._\-+]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return "";
  return toTitleCase(tokens[0]);
}

function isInsufficientScopeMessage(message: string) {
  return message.toLowerCase().includes("insufficient authentication scopes");
}

function addPeopleEmails(
  contacts: Map<string, { email: string; name: string }>,
  person: any,
) {
  const emails = Array.isArray(person.emailAddresses) ? person.emailAddresses : [];
  const names = Array.isArray(person.names) ? person.names : [];
  const displayName = String(names[0]?.displayName || "").trim();
  let added = 0;

  for (const e of emails) {
    const email = String(e?.value || "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    const existing = contacts.get(email);
    contacts.set(email, { email, name: existing?.name || displayName });
    added += existing ? 0 : 1;
  }

  return { hasEmail: emails.length > 0, added };
}

async function fetchPeopleCollection(params: {
  accessToken: string;
  url: string;
  itemKey: "connections" | "otherContacts";
  query: Record<string, string>;
  contacts: Map<string, { email: string; name: string }>;
}) {
  let pageToken = "";
  let pages = 0;
  let totalRows = 0;
  let rowsWithEmail = 0;
  let addedUniqueEmails = 0;

  do {
    const urlParams = new URLSearchParams(params.query);
    if (pageToken) urlParams.set("pageToken", pageToken);
    const res = await fetch(`${params.url}?${urlParams.toString()}`, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || "";
      if (isInsufficientScopeMessage(msg)) {
        return {
          pages,
          totalRows,
          rowsWithEmail,
          addedUniqueEmails,
          skippedReason: "Re-auth Contacts to include Google Other Contacts. Current permission only allows My Contacts.",
        };
      }
      if (msg.toLowerCase().includes("people api has not been used") || msg.toLowerCase().includes("api not enabled")) {
        throw new Error(
          "Google People API Not Enabled: Please ask your administrator to enable the 'Google People API' in the Google Cloud Console for this project. Link: https://console.cloud.google.com/apis/library/people.googleapis.com"
        );
      }
      throw new Error(`Google Contacts API failed: ${msg || res.status}`);
    }

    const list = Array.isArray(data[params.itemKey]) ? data[params.itemKey] : [];
    for (const person of list) {
      totalRows += 1;
      const result = addPeopleEmails(params.contacts, person);
      if (result.hasEmail) rowsWithEmail += 1;
      addedUniqueEmails += result.added;
    }

    pageToken = String(data.nextPageToken || "");
    pages += 1;
  } while (pageToken && pages < 100);

  return { pages, totalRows, rowsWithEmail, addedUniqueEmails, skippedReason: null };
}

async function ensureAccessToken(accountId: string) {
  const accountRows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    userId: string;
    accountName: string;
    email: string;
    refreshTokenEncrypted: string;
    accessTokenEncrypted: string | null;
    expiresAt: Date | null;
  }>>(
    `SELECT "id", "userId", "accountName", "email", "refreshTokenEncrypted", "accessTokenEncrypted", "expiresAt"
     FROM "GoogleContactsAccount"
     WHERE "id" = $1
     LIMIT 1`,
    accountId
  );
  const account = accountRows[0] || null;
  if (!account) throw new Error("Google account not found.");

  const storedAccessToken = decrypt(account.accessTokenEncrypted || "");
  const expiresAt: Date | null = account.expiresAt ? new Date(account.expiresAt) : null;
  if (storedAccessToken && expiresAt && expiresAt > new Date()) {
    return { account, accessToken: storedAccessToken };
  }

  const refreshToken = decrypt(account.refreshTokenEncrypted);
  if (!refreshToken) throw new Error("No contacts refresh token found. Please re-authenticate via 'Re-auth Contacts'.");

  const settings = await prisma.globalSettings.findUnique({ where: { id: "singleton" } });
  let clientId = settings?.googleClientIdEncrypted ? decrypt(settings.googleClientIdEncrypted) : "";
  let clientSecret = settings?.googleClientSecretEncrypted ? decrypt(settings.googleClientSecretEncrypted) : "";
  if (!clientId) clientId = process.env.GOOGLE_CLIENT_ID || "";
  if (!clientSecret) clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials missing.");

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
  if (!tokenResponse.ok) throw new Error(`Google token refresh failed: ${tokens?.error || "unknown"}`);

  const accessToken: string = tokens.access_token;
  const refreshedExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);

  await prisma.$executeRawUnsafe(
    `UPDATE "GoogleContactsAccount"
     SET "accessTokenEncrypted" = $1,
         "expiresAt" = $2,
         "lastUsed" = NOW(),
         "lastStatus" = 'HEALTHY',
         "updatedAt" = NOW()
     WHERE "id" = $3`,
    encrypt(accessToken),
    refreshedExpiresAt,
    accountId
  );
  return { account, accessToken };
}

export async function runGoogleContactsSync(accountId: string) {
  const { account, accessToken } = await ensureAccessToken(accountId);

  const contacts = new Map<string, { email: string; name: string }>();
  const myContactsStats = await fetchPeopleCollection({
    accessToken,
    url: "https://people.googleapis.com/v1/people/me/connections",
    itemKey: "connections",
    query: {
      personFields: "names,emailAddresses",
      pageSize: "1000",
    },
    contacts,
  });
  if (myContactsStats.skippedReason) {
    throw new Error(
      "Google Contacts Access Denied: Please click 'Re-auth Contacts' and approve Contacts access on the Google permission screen."
    );
  }

  const otherContactsStats = await fetchPeopleCollection({
    accessToken,
    url: "https://people.googleapis.com/v1/otherContacts",
    itemKey: "otherContacts",
    query: {
      readMask: "names,emailAddresses",
      pageSize: "1000",
    },
    contacts,
  });

  const entries = Array.from(contacts.values());
  // Only clean records that were tagged by this exact Google Contacts account.
  // Legacy records without googleContactsAccountIds are left intact to avoid losing old imports.
  const contactEmails = new Set(entries.map((c) => c.email));
  const staleTagged = await prisma.client.findMany({
    where: {
      userId: account.userId,
      source: "GMAIL",
      metadata: { path: ["googleContactsAccountIds"], array_contains: account.id as any },
    },
    select: { id: true, email: true, metadata: true },
  });
  for (const stale of staleTagged) {
    if (stale.email && contactEmails.has(stale.email.toLowerCase())) continue;
    const staleMeta = stale.metadata && typeof stale.metadata === "object" ? (stale.metadata as any) : {};
    const remainingAccountIds = Array.isArray(staleMeta.googleContactsAccountIds)
      ? staleMeta.googleContactsAccountIds.filter((id: string) => id !== account.id)
      : [];
    const existingChannels = Array.isArray(staleMeta.importChannels) ? staleMeta.importChannels : [];
    const cleanedChannels = remainingAccountIds.length === 0
      ? existingChannels.filter((ch: string) => ch !== "google_contacts")
      : existingChannels;
    await prisma.client.update({
      where: { id: stale.id },
      data: {
        metadata: {
          ...staleMeta,
          importChannels: cleanedChannels,
          googleContactsAccountIds: remainingAccountIds,
        },
      },
    }).catch(() => null);
  }

  let conflicts = 0;
  let synced = 0;
  for (const c of entries) {
    const resolvedName = c.name || deriveNameFromEmail(c.email) || "Anonymous Contact";
    const externalId = `${account.id}:google_contacts:${c.email}`;

    // Only read/tag records owned by this user — never touch other users' records.
    const prev = await prisma.client.findFirst({
      where: { email: c.email, userId: account.userId },
      select: { id: true, source: true, metadata: true },
    });
    if (prev && prev.source !== "GMAIL") {
      conflicts += 1;
      continue;
    }

    const prevMeta = prev?.metadata && typeof prev.metadata === "object" ? (prev.metadata as any) : {};
    const channels = Array.isArray(prevMeta.importChannels) ? prevMeta.importChannels : [];
    const googleContactsAccountIds = Array.isArray(prevMeta.googleContactsAccountIds) ? prevMeta.googleContactsAccountIds : [];
    const googleContactsSourceAccounts = Array.isArray(prevMeta.googleContactsSourceAccounts) ? prevMeta.googleContactsSourceAccounts : [];
    const meta = {
      ...prevMeta,
      importChannels: Array.from(new Set([...channels, "google_contacts"])),
      googleContactsAccountIds: Array.from(new Set([...googleContactsAccountIds, account.id])),
      googleContactsSourceAccounts: Array.from(new Set([...googleContactsSourceAccounts, account.email])),
    };

    try {
      await prisma.client.upsert({
        where: { source_externalId: { source: "GMAIL", externalId } },
        update: {
          clientName: resolvedName,
          contactPerson: resolvedName,
          gmailSourceAccount: account.email,
          metadata: meta,
        },
        create: {
          clientName: resolvedName,
          contactPerson: resolvedName,
          email: c.email,
          industry: "Corporate",
          relationshipLevel: "Warm Lead",
          source: "GMAIL",
          externalId,
          gmailSourceAccount: account.email,
          userId: account.userId,
          metadata: {
            importChannels: ["google_contacts"],
            googleContactsAccountIds: [account.id],
            googleContactsSourceAccounts: [account.email],
          },
        },
      });
      synced += 1;
    } catch (e: any) {
      if (e?.code === "P2002") {
        // Email exists for this user under a different externalId (e.g. from Gmail inbox sync).
        // Tag that existing record with "google_contacts" so filters work correctly.
        if (prev) {
          const tagResult = await prisma.client.update({
            where: { id: prev.id },
            data: { metadata: meta },
          }).catch((tagErr: any) => {
            console.error(`[google-contacts-sync] Failed to tag existing record id=${prev.id} email=${c.email}:`, tagErr?.message || tagErr);
            return null;
          });
          if (tagResult) {
            synced += 1;
          } else {
            console.error(`[google-contacts-sync] Could not tag existing record for email=${c.email}, counting as conflict.`);
            conflicts += 1;
          }
        } else {
          // Email exists but belongs to a different user — true conflict, skip.
          console.error(`[google-contacts-sync] Email ${c.email} exists under a different userId — skipping.`);
          conflicts += 1;
        }
      } else {
        console.error(`[google-contacts-sync] Unexpected error for email=${c.email}:`, e?.message || e);
        throw e;
      }
    }
  }

  return {
    count: synced,
    conflicts,
    fetched: entries.length,
    myContacts: myContactsStats,
    otherContacts: otherContactsStats,
    otherContactsSkippedReason: otherContactsStats.skippedReason,
  };
}

