import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function resetAdminPassword() {
    const email = "suraj.sonnar@ikf.co.in";
    const newPassword = "SurajSonnar@777"; // Defaulting to the potential password found in .env
    const passwordHash = await bcrypt.hash(newPassword, 10);

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                passwordHash,
                role: "ADMIN",
                status: "APPROVED"
            },
            create: {
                name: "Suraj Sonnar",
                email,
                passwordHash,
                role: "ADMIN",
                status: "APPROVED"
            }
        });

        console.log(`Successfully reset password for ${email}`);
        console.log(`New Password: ${newPassword}`);
        console.log(`Role: ${user.role}`);
        console.log(`Status: ${user.status}`);
    } catch (error) {
        console.error("Error resetting password:", error);
    } finally {
        await prisma.$disconnect();
    }
}

resetAdminPassword();
