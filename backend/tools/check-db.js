
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkClient() {
    const client = await prisma.client.findFirst({
        where: { clientName: { contains: "Ashish", mode: "insensitive" } },
        include: { services: true }
    });
    console.log(JSON.stringify(client, null, 2));
    process.exit(0);
}

checkClient();
