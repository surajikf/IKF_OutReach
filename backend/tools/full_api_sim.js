import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
    try {
        console.log("Starting full API simulation...");
        
        // 1. Source Stats
        console.log("S1: Fetching source stats...");
        const [sourceStatsRaw, gmailStatsRaw, gmailAccounts] = await Promise.all([
            prisma.client.groupBy({
                by: ['source', 'relationshipLevel'],
                _count: { _all: true }
            }),
            prisma.client.groupBy({
                by: ['gmailSourceAccount'],
                where: { source: 'GMAIL' },
                _count: { _all: true }
            }),
            prisma.gmailAccount.findMany({
                select: { accountName: true, email: true }
            }),
        ]);
        console.log("S1 Success");

        // 2. Zoho Tags
        console.log("S2: Fetching Zoho tags...");
        const zohoClients = await prisma.client.findMany({
            where: { source: 'ZOHO_BIGIN' },
            select: { zohoTags: true }
        });
        console.log("S2 Success. Counts:", zohoClients.length);

        // 3. Filter Stats
        console.log("S3: Fetching filter stats...");
        const showRoleBased = false;
        const statsWhere = {
            isRoleBased: showRoleBased,
            isBlocked: false
        };
        const [industryGroup, levelGroup, serviceGroup] = await Promise.all([
            prisma.client.groupBy({
                by: ['industry'],
                _count: { _all: true },
                where: statsWhere
            }),
            prisma.client.groupBy({
                by: ['relationshipLevel'],
                _count: { _all: true },
                where: statsWhere
            }),
            prisma.service.findMany({
                select: {
                    id: true,
                    serviceName: true,
                    _count: { 
                        select: { 
                            clients: { where: statsWhere } 
                        } 
                    }
                }
            })
        ]);
        console.log("S3 Success");

        // 4. Main List
        console.log("S4: Fetching main list...");
        const [clients, total] = await Promise.all([
            prisma.client.findMany({
                where: { isRoleBased: false },
                take: 25
            }),
            prisma.client.count({ where: { isRoleBased: false } }),
        ]);
        console.log("S4 Success. Total:", total);

        console.log("ALL STEPS COMPLETED SUCCESSFULLY.");
    } catch (err) {
        console.error("SIMULATION FAILED!");
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
