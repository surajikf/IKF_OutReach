import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
    try {
        const clients = await prisma.client.findMany({
            take: 1,
            select: { id: true, isRoleBased: true }
        })
        console.log('RUNTIME_SUCCESS: isRoleBased column detected in client.', clients)
    } catch (e: any) {
        console.log('RUNTIME_ERROR:', e.message)
    } finally {
        await prisma.$disconnect()
    }
}

main()
