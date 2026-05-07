-- Gmail accounts must belong to a user
ALTER TABLE "GmailAccount" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Backfill owner by matching Gmail email to registered user email
UPDATE "GmailAccount" ga
SET "userId" = u.id
FROM "User" u
WHERE lower(ga.email) = lower(u.email)
  AND ga."userId" IS NULL;

-- For any legacy rows still unmatched, attach to earliest admin if available
UPDATE "GmailAccount" ga
SET "userId" = u.id
FROM (
  SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1
) u
WHERE ga."userId" IS NULL;

ALTER TABLE "GmailAccount" ALTER COLUMN "userId" SET NOT NULL;

-- Replace global unique email with per-user unique email
DROP INDEX IF EXISTS "GmailAccount_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GmailAccount_userId_email_key" ON "GmailAccount"("userId", "email");
CREATE INDEX IF NOT EXISTS "GmailAccount_userId_updatedAt_idx" ON "GmailAccount"("userId", "updatedAt");

ALTER TABLE "GmailAccount"
ADD CONSTRAINT "GmailAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-user Zoho authorization tokens
CREATE TABLE IF NOT EXISTS "ZohoConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "grantedScopes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ZohoConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ZohoConnection_userId_key" ON "ZohoConnection"("userId");

ALTER TABLE "ZohoConnection"
ADD CONSTRAINT "ZohoConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
