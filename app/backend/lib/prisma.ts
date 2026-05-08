import { PrismaClient } from '@prisma/client';

function normalizeDatasourceUrl(url: string) {
    // Supabase pooler in session mode can hit low max-client limits in dev.
    if (!url.includes("pooler.supabase.com")) return url;
    const hasQuery = url.includes("?");
    const query = hasQuery ? url.split("?")[1] : "";
    if (/(^|&)connection_limit=/.test(query)) return url;
    return `${url}${hasQuery ? "&" : "?"}connection_limit=1&pool_timeout=20`;
}

const prismaClientSingleton = () => {
    const runtimeUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const datasourceUrl = runtimeUrl ? normalizeDatasourceUrl(runtimeUrl) : undefined;
    const baseClient = runtimeUrl
        ? new PrismaClient({ datasourceUrl })
        : new PrismaClient();

    return baseClient.$extends({
        query: {
            client: {
                async $allOperations({ model, operation, args, query }) {
                    // List of read operations that we want to protect
                    const readOperations = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];

                    if (model === 'Client' && readOperations.includes(operation)) {
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
