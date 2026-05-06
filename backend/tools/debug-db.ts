import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("--- DB DEBUG START ---");
  const clientsWithServices = await prisma.client.findMany({
    where: {
      OR: [
        { invoiceServiceNames: { not: null } },
        { services: { some: {} } }
      ]
    },
    include: { services: true },
    take: 5
  });

  console.log(`Found ${clientsWithServices.length} clients with services/invoiceServiceNames populated.`);
  
  if (clientsWithServices.length > 0) {
    clientsWithServices.forEach((c: any) => {
      console.log(`Client: ${c.clientName}`);
      console.log(`- invoiceServiceNames: ${c.invoiceServiceNames}`);
      console.log(`- services count: ${c.services.length}`);
    });
  } else {
    console.log("Checking first 3 raw clients...");
    const rawClients = await prisma.client.findMany({ take: 3 });
    rawClients.forEach((c: any) => {
      console.log(`Client: ${c.clientName} | Source: ${c.source} | Raw Services: ${c.invoiceServiceNames}`);
    });
  }
  console.log("--- DB DEBUG END ---");
}

main().catch(console.error).finally(() => prisma.$disconnect());
