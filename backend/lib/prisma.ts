import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    return new PrismaClient().$extends({
        query: {
            client: {
                async $allOperations({ model, operation, args, query }) {
                    // List of read operations that we want to protect
                    const readOperations = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];

                    if (readOperations.includes(operation)) {
                        const anyArgs = args as any;
                        anyArgs.where = anyArgs.where || {};

                        // If isRoleBased is NOT explicitly set in the query, default it to false
                        // This prevents generic emails from leaking into normal business features
                        if (anyArgs.where.isRoleBased === undefined) {
                            anyArgs.where.isRoleBased = false;
                        }
                    }

                    return query(args);
                },
            },
        },
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
