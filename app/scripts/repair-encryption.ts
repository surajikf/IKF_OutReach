import prisma from "@/backend/lib/prisma";

async function main() {
  const settings = await prisma.globalSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    throw new Error("Missing GlobalSettings singleton.");
  }

  await prisma.globalSettings.update({
    where: { id: "singleton" },
    data: {
      groqApiKeyEncrypted: null,
      openaiApiKeyEncrypted: null,
      googleClientIdEncrypted: null,
      googleClientSecretEncrypted: null,
      googleRefreshTokenEncrypted: null,
      googleEmailEncrypted: null,
      invoiceApiKeyEncrypted: null,
      invoiceApiUrlEncrypted: null,
      smtpPassEncrypted: null,
      zohoClientIdEncrypted: null,
      zohoClientSecretEncrypted: null,
      zohoRefreshTokenEncrypted: null,
      brevoApiKeyEncrypted: null,
    },
  });

  await prisma.gmailAccount.updateMany({
    data: {
      refreshTokenEncrypted: "",
      accessTokenEncrypted: null,
      expiresAt: null,
      scopeGranted: false,
      lastStatus: "RECONNECT_REQUIRED",
    },
  });

  await prisma.zohoConnection.deleteMany({});

  console.log("Encryption repair complete.");
  console.log("All encrypted credentials were cleared.");
  console.log("Re-enter provider/API credentials in Settings and reconnect Gmail/Zoho.");
}

main()
  .catch((err) => {
    console.error("Encryption repair failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
