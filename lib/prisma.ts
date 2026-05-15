import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    // Use DATABASE_URL (port 6543, PgBouncer transaction mode) for all runtime queries.
    // DIRECT_URL (port 5432, session mode) is capped at 15 connections on Supabase free tier
    // and must only be used by Prisma migrate — never for application queries.
    // pgbouncer=true disables prepared statements so transaction-mode pooling works correctly.
    let runtimeUrl = process.env.DATABASE_URL;

    if (runtimeUrl) {
        // Ensure pgbouncer=true is present to disable prepared statements
        if (!runtimeUrl.includes("pgbouncer=true")) {
            const sep = runtimeUrl.includes("?") ? "&" : "?";
            runtimeUrl += `${sep}pgbouncer=true`;
        }
        // Cap Prisma's own internal pool — the real pooling is handled by PgBouncer
        if (!runtimeUrl.includes("connection_limit")) {
            const sep = runtimeUrl.includes("?") ? "&" : "?";
            runtimeUrl += `${sep}connection_limit=3&pool_timeout=15`;
        }
    }
    const baseClient = runtimeUrl
        ? new PrismaClient({ datasourceUrl: runtimeUrl })
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

                        // If isRoleBased is NOT explicitly set in the query, exclude only confirmed
                        // role-based contacts (isRoleBased = true). Contacts where the field is null
                        // (e.g. Invoice System, Google Contacts) are included — they are not role-based.
                        if (anyArgs.where.isRoleBased === undefined) {
                            anyArgs.where.isRoleBased = { not: true };
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

