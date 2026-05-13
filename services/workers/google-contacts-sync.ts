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

async function ensureAccessToken(accountId: string) {
  const account = await prisma.gmailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Google account not found.");

  let accessToken = decrypt(account.accessTokenEncrypted || "");
  if (accessToken && account.expiresAt && account.expiresAt > new Date()) return { account, accessToken };

  const settings = await prisma.globalSettings.findUnique({ where: { id: "singleton" } });
  let clientId = settings?.googleClientIdEncrypted ? decrypt(settings.googleClientIdEncrypted) : "";
  let clientSecret = settings?.googleClientSecretEncrypted ? decrypt(settings.googleClientSecretEncrypted) : "";
  if (!clientId) clientId = process.env.GOOGLE_CLIENT_ID || "";
  if (!clientSecret) clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials missing.");

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
  if (!tokenResponse.ok) throw new Error(`Google token refresh failed: ${tokens?.error || "unknown"}`);

  accessToken = tokens.access_token;
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
  await prisma.gmailAccount.update({
    where: { id: accountId },
    data: { accessTokenEncrypted: encrypt(accessToken), expiresAt, lastUsed: new Date(), lastStatus: "CONTACTS_HEALTHY" },
  });
  return { account, accessToken };
}

export async function runGoogleContactsSync(accountId: string) {
  const { account, accessToken } = await ensureAccessToken(accountId);

  const contacts = new Map<string, { email: string; name: string }>();
  let pageToken = "";
  let pages = 0;
  do {
    const params = new URLSearchParams({
      personFields: "names,emailAddresses",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Google Contacts API failed: ${data?.error?.message || res.status}`);
    const list = Array.isArray(data.connections) ? data.connections : [];
    for (const person of list) {
      const emails = Array.isArray(person.emailAddresses) ? person.emailAddresses : [];
      const names = Array.isArray(person.names) ? person.names : [];
      const displayName = String(names[0]?.displayName || "").trim();
      for (const e of emails) {
        const email = String(e?.value || "").trim().toLowerCase();
        if (!email || !email.includes("@")) continue;
        contacts.set(email, { email, name: displayName });
      }
    }
    pageToken = String(data.nextPageToken || "");
    pages += 1;
  } while (pageToken && pages < 20);

  const entries = Array.from(contacts.values());
  const existing = await prisma.client.findMany({
    where: { email: { in: entries.map((c) => c.email) } },
    select: { email: true, source: true },
  });
  const existingMap = new Map(existing.map((c) => [String(c.email).toLowerCase(), c.source]));

  let conflicts = 0;
  let synced = 0;
  for (const c of entries) {
    const existingSource = existingMap.get(c.email);
    if (existingSource && existingSource !== "GMAIL") conflicts += 1;
    const resolvedName = c.name || deriveNameFromEmail(c.email) || "Anonymous Contact";
    // Only read metadata for records owned by this user
    const prev = await prisma.client.findFirst({
      where: { email: c.email, userId: account.userId },
      select: { metadata: true },
    });
    const prevMeta = prev?.metadata && typeof prev.metadata === "object" ? (prev.metadata as any) : {};
    const channels = Array.isArray(prevMeta.importChannels) ? prevMeta.importChannels : [];
    const meta = { ...prevMeta, importChannels: Array.from(new Set([...channels, "google_contacts"])) };

    try {
      await prisma.client.upsert({
        where: {
          source_externalId: {
            source: "GMAIL",
            externalId: `${account.id}:google_contacts:${c.email}`,
          },
        },
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
          externalId: `${account.id}:google_contacts:${c.email}`,
          gmailSourceAccount: account.email,
          userId: account.userId,
          metadata: { importChannels: ["google_contacts"] },
        },
      });
      synced += 1;
    } catch (e: any) {
      if (e?.code === "P2002") {
        // Email already exists under a different externalId (e.g. synced from Gmail inbox/sent).
        // The upsert's CREATE leg failed the email unique constraint. We still need to tag that
        // existing record with "google_contacts" in importChannels so the count and filter work.
        const updated = await prisma.client.updateMany({
          where: { email: c.email, userId: account.userId },
          data: { metadata: meta },
        }).catch(() => null);
        if (updated && updated.count > 0) {
          synced += 1;
        } else {
          conflicts += 1;
        }
      } else {
        throw e;
      }
    }
  }

  return { count: synced, conflicts };
}

