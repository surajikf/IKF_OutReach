CREATE TABLE IF NOT EXISTS "GoogleContactsAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3),
  "lastUsed" TIMESTAMP(3),
  "lastStatus" TEXT DEFAULT 'IDLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleContactsAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleContactsAccount_userId_email_key" ON "GoogleContactsAccount"("userId", "email");
CREATE INDEX IF NOT EXISTS "GoogleContactsAccount_userId_updatedAt_idx" ON "GoogleContactsAccount"("userId", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleContactsAccount_userId_fkey'
  ) THEN
    ALTER TABLE "GoogleContactsAccount"
    ADD CONSTRAINT "GoogleContactsAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  has_legacy_contacts_columns BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'GmailAccount'
      AND column_name = 'contactsRefreshTokenEncrypted'
  ) INTO has_legacy_contacts_columns;

  IF has_legacy_contacts_columns THEN
    EXECUTE '
      INSERT INTO "GoogleContactsAccount" (
        "id", "userId", "accountName", "email", "refreshTokenEncrypted",
        "accessTokenEncrypted", "expiresAt", "lastUsed", "lastStatus", "createdAt", "updatedAt"
      )
      SELECT
        "id",
        "userId",
        "accountName",
        "email",
        COALESCE("contactsRefreshTokenEncrypted", "refreshTokenEncrypted"),
        COALESCE("contactsAccessTokenEncrypted", "accessTokenEncrypted"),
        COALESCE("contactsExpiresAt", "expiresAt"),
        "lastUsed",
        ''HEALTHY'',
        NOW(),
        NOW()
      FROM "GmailAccount"
      WHERE ("lastStatus" LIKE ''%CONTACTS%'' OR "contactsRefreshTokenEncrypted" IS NOT NULL)
        AND COALESCE("contactsRefreshTokenEncrypted", "refreshTokenEncrypted") IS NOT NULL
      ON CONFLICT ("userId", "email")
      DO UPDATE SET
        "accountName" = EXCLUDED."accountName",
        "refreshTokenEncrypted" = EXCLUDED."refreshTokenEncrypted",
        "accessTokenEncrypted" = EXCLUDED."accessTokenEncrypted",
        "expiresAt" = EXCLUDED."expiresAt",
        "lastUsed" = COALESCE(EXCLUDED."lastUsed", "GoogleContactsAccount"."lastUsed"),
        "lastStatus" = ''HEALTHY'',
        "updatedAt" = NOW()';
  ELSE
    INSERT INTO "GoogleContactsAccount" (
      "id", "userId", "accountName", "email", "refreshTokenEncrypted",
      "accessTokenEncrypted", "expiresAt", "lastUsed", "lastStatus", "createdAt", "updatedAt"
    )
    SELECT
      "id",
      "userId",
      "accountName",
      "email",
      "refreshTokenEncrypted",
      "accessTokenEncrypted",
      "expiresAt",
      "lastUsed",
      'HEALTHY',
      NOW(),
      NOW()
    FROM "GmailAccount"
    WHERE "lastStatus" LIKE '%CONTACTS%'
      AND "refreshTokenEncrypted" IS NOT NULL
    ON CONFLICT ("userId", "email")
    DO UPDATE SET
      "accountName" = EXCLUDED."accountName",
      "refreshTokenEncrypted" = EXCLUDED."refreshTokenEncrypted",
      "accessTokenEncrypted" = EXCLUDED."accessTokenEncrypted",
      "expiresAt" = EXCLUDED."expiresAt",
      "lastUsed" = COALESCE(EXCLUDED."lastUsed", "GoogleContactsAccount"."lastUsed"),
      "lastStatus" = 'HEALTHY',
      "updatedAt" = NOW();
  END IF;
END $$;
