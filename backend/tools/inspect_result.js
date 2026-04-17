import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
    try {
        const statsWhere = { isRoleBased: false, isBlocked: false };
        const serviceGroup = await prisma.service.findMany({
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
        console.log("Service Group Result (First item):", JSON.stringify(serviceGroup[0], null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
