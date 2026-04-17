
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkClients() {
    console.log("Checking clients in database...");
    const clients = await prisma.client.findMany({
        take: 10,
        include: { services: true },
        select: {
          id: true,
          clientName: true,
          invoiceServiceNames: true,
          services: true,
          source: true
        }
    });
    console.log(JSON.stringify(clients, null, 2));
    await prisma.$disconnect();
    process.exit(0);
}

checkClients().catch(err => {
  console.error(err);
  process.exit(1);
});
