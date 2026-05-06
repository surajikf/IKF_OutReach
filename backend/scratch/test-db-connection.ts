
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Testing database connection...");
    await prisma.$connect();
    console.log("Connection successful.");

    console.log("Checking GmailAccount table...");
    const count = await prisma.gmailAccount.count();
    console.log(`GmailAccount count: ${count}`);
  } catch (err) {
    console.error("Database test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
