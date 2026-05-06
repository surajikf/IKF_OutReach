import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
    try {
        console.log("Starting full API simulation with CLIENT_V2...");
        
        const showRoleBased = false;
        const statsWhere = {
            isRoleBased: showRoleBased,
            isBlocked: false
        };

        // This is the line that failed in the user's report
        console.log("Testing service findMany with isBlocked filter...");
        const result = await prisma.service.findMany({
            select: {
                id: true,
                serviceName: true,
                _count: { 
                    select: { 
                        clients: { where: statsWhere } 
                    } 
                }
            }
        });
        console.log("Success! Count of services:", result.length);
        console.log("First service stats:", JSON.stringify(result[0]._count, null, 2));

        console.log("ALL V2 TESTS PASSED.");
    } catch (err) {
        console.error("V2 SIMULATION FAILED!");
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
