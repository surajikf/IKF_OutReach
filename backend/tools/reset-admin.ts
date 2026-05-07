import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetAdminPassword() {
    const email = "suraj.sonnar@ikf.co.in";

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                role: "ADMIN",
                status: "APPROVED",
                canAccessInvoiceData: true,
            },
            create: {
                id: crypto.randomUUID(),
                name: "Suraj Sonnar",
                email,
                role: "ADMIN",
                status: "APPROVED",
                canAccessInvoiceData: true,
            }
        });

        console.log(`Successfully reset admin role/status for ${email}`);
        console.log(`Role: ${user.role}`);
        console.log(`Status: ${user.status}`);
    } catch (error) {
        console.error("Error resetting password:", error);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdminPassword();
