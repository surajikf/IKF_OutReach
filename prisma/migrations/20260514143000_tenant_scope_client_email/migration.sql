DROP INDEX IF EXISTS "Client_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Client_userId_email_key" ON "Client"("userId", "email");
CREATE INDEX IF NOT EXISTS "Client_email_idx" ON "Client"("email");
