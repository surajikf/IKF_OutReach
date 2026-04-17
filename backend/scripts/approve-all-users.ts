import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting user status migration...");
    
    const result = await prisma.user.updateMany({
        where: {
            status: "PENDING"
        },
        data: {
            status: "APPROVED"
        }
    });
    
    console.log(`Successfully migrated ${result.count} users to APPROVED status.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
