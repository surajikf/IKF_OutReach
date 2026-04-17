import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding clients...");

    const services = await prisma.service.findMany();

    if (services.length === 0) {
        console.log("No services found. Please run service seed first.");
        return;
    }

    const clients = [
        {
            clientName: "Ashish",
            contactPerson: "Ashish",
            email: "ashishikf@mailinator.com",
            industry: "Digital",
            relationshipLevel: "Active",
            serviceNames: ["Website"]
        },
        {
            clientName: "Vivek",
            contactPerson: "Vivek",
            email: "vivekikf@mailinator.com",
            industry: "Digital",
            relationshipLevel: "Active",
            serviceNames: ["SEO"]
        },
        {
            clientName: "Mayur",
            contactPerson: "Mayur",
            email: "mayurikf@mailinator.com",
            industry: "Marketing",
            relationshipLevel: "Active",
            serviceNames: ["PPC"]
        },
        {
            clientName: "Suraj",
            contactPerson: "Suraj",
            email: "surajikf@mailinator.com",
            industry: "Technology",
            relationshipLevel: "Active",
            serviceNames: ["Hosting"]
        }
    ];

    for (const client of clients) {
        const dbServices = await prisma.service.findMany({
            where: { serviceName: { in: client.serviceNames } }
        });

        const existing = await prisma.client.findUnique({
            where: { email: client.email }
        });

        if (!existing) {
            await prisma.client.create({
                data: {
                    clientName: client.clientName,
                    contactPerson: client.contactPerson,
                    email: client.email,
                    industry: client.industry,
                    relationshipLevel: client.relationshipLevel,
                    services: {
                        connect: dbServices.map((s: any) => ({ id: s.id }))
                    }
                }
            });
        }
    }

    console.log("Client seeding complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
