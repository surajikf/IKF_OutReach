import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  await p.$connect();
  console.log('DB CONNECTED OK');
  await p.$disconnect();
} catch(e) {
  console.error('DB ERROR:', e.message);
  process.exit(1);
}
