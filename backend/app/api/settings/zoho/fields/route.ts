import prisma from "@/backend/lib/prisma";
import crypto from "crypto";
import { error, ok } from "@/backend/lib/api-response";
import { getBackendSession, isApprovedUser } from "@/backend/lib/auth";

const RAW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default_insecure_key_123456789012";
const ENCRYPTION_KEY = RAW_ENCRYPTION_KEY.padEnd(32, "0").substring(0, 32);
const RAW_ENCRYPTION_IV = process.env.ENCRYPTION_IV || "default_iv_12345";
const ENCRYPTION_IV = RAW_ENCRYPTION_IV.padEnd(16, "0").substring(0, 16);

function decrypt(encryptedText: string | null): string | null {
  if (!encryptedText) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      Buffer.from(ENCRYPTION_IV)
    );
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    if (!await isApprovedUser(req)) {
      return error("FORBIDDEN", "Unauthorized access.", { status: 403 });
    }
    const session = await getBackendSession(req);
    if (!session?.user?.id) return error("UNAUTHORIZED", "Sign in required.", { status: 401 });

    const settingsList = await prisma.$queryRawUnsafe(`SELECT * FROM "GlobalSettings" LIMIT 1`) as any[];
    const settings = settingsList?.[0];
    const zohoConnection = await prisma.zohoConnection.findUnique({
      where: { userId: session.user.id },
      select: { refreshTokenEncrypted: true, grantedScopes: true },
    });

    if (!settings || !zohoConnection?.refreshTokenEncrypted) {
      return error("BAD_REQUEST", "Zoho is not connected.");
    }

    console.log("[ZOHO_FIELDS] Decrypting credentials...");
    const clientId = decrypt(settings.zohoClientIdEncrypted);
    const clientSecret = decrypt(settings.zohoClientSecretEncrypted);
    const refreshToken = decrypt(zohoConnection.refreshTokenEncrypted);

    if (!clientId || !clientSecret || !refreshToken) {
      console.error("[ZOHO_FIELDS] Decryption failed or empty credentials.");
      return error("INTERNAL_ERROR", "Failed to decrypt Zoho credentials.");
    }

    // Refresh token
    console.log("[ZOHO_FIELDS_V2] Refreshing access token...");
    const tokenRes = await fetch(`https://accounts.zoho.in/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      console.error("[ZOHO_FIELDS_V2] Token refresh failed:", tokenData);
      return error("INTEGRATION_ERROR", `Zoho Token Refresh failed: ${tokenData.error || 'Unknown error'}`);
    }

    const accessToken = tokenData.access_token;

    // Fetch fields for Pipelines (Deals in v1) and Contacts
    console.log("[ZOHO_FIELDS] Fetching fields from Zoho (v2 with v1 fallback)...");
    let pipelinesFieldsRes = await fetch(`https://www.zohoapis.in/bigin/v2/settings/fields?module=Pipelines`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (pipelinesFieldsRes.status === 401 || pipelinesFieldsRes.status === 403) {
        console.warn("[ZOHO_FIELDS] v2 failed, trying v1 fallback for Deals...");
        pipelinesFieldsRes = await fetch(`https://www.zohoapis.in/bigin/v1/settings/fields?module=Deals`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
    }

    const contactsFieldsRes = await fetch(`https://www.zohoapis.in/bigin/v1/settings/fields?module=Contacts`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (!pipelinesFieldsRes.ok || !contactsFieldsRes.ok) {
        const failedModule = !pipelinesFieldsRes.ok ? (pipelinesFieldsRes.status === 401 ? "Deals (Auth)" : "Deals") : "Contacts";
        const status = !pipelinesFieldsRes.ok ? pipelinesFieldsRes.status : contactsFieldsRes.status;
        console.error(`[ZOHO_FIELDS] Metadata fetch failed for ${failedModule}`);
        return error("ZOHO_API_ERROR", `Failed to fetch ${failedModule} metadata (${status}).`, {
            details: { grantedScopes: zohoConnection.grantedScopes }
        });
    }

    const pipelinesFieldsData = await pipelinesFieldsRes.json();
    const contactsFieldsData = await contactsFieldsRes.json();

    return ok({
      deals: pipelinesFieldsData.fields || [],
      contacts: contactsFieldsData.fields || [],
    });

  } catch (err: any) {
    console.error("Zoho Fields Error:", err);
    return error("INTERNAL_ERROR", "Internal Server Error", {
      details: { message: err.message },
    });
  }
}
