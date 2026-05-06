const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clients = await prisma.client.findMany({
        include: {
            services: true
        }
    });

    console.log('--- Client Data Audit ---');
    console.log('Total Clients:', clients.length);

    const audit = clients.map(c => ({
        name: c.clientName,
        email: c.email,
        level: c.relationshipLevel,
        servicesCount: c.services.length
    }));

    console.table(audit);

    const levelCounts = await prisma.client.groupBy({
        by: ['relationshipLevel'],
        _count: true
    });
    console.log('Relationship Levels in DB:', levelCounts);

    const sources = await prisma.client.groupBy({
        by: ['source'],
        _count: true
    });
    console.log('Sources in DB:', sources);
}

main().catch(console.error).finally(() => prisma.$disconnect());
