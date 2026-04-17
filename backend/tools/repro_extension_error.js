import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient().$extends({
    query: {
        client: {
            async $allOperations({ model, operation, args, query }) {
                const readOperations = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];
                if (readOperations.includes(operation)) {
                    const anyArgs = args;
                    anyArgs.where = anyArgs.where || {};
                    if (anyArgs.where.isRoleBased === undefined) {
                        anyArgs.where.isRoleBased = false;
                    }
                }
                return query(args);
            },
        },
    },
});

async function test() {
    try {
        console.log("Testing stats queries with EXTENSION (Plain JS)...");
        const showRoleBased = false;
        const statsWhere = {
            isRoleBased: showRoleBased,
            isBlocked: false
        };

        console.log("1. Industry GroupBy...");
        const industryGroup = await prisma.client.groupBy({
            by: ['industry'],
            _count: { _all: true },
            where: statsWhere
        });
        console.log("Industry Group Success");

        console.log("All queries succeeded with extension.");
    } catch (err) {
        console.error("Query Failed with extension!");
        console.error(err);
    } finally {
        // await prisma.$disconnect();
    }
}

test();
