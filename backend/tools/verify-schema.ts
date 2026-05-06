import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
    try {
        const result: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Client' AND column_name = 'isRoleBased'
    `
        if (result.length > 0) {
            console.log('COLUMN_EXISTS: isRoleBased column found.', result)
        } else {
            console.log('COLUMN_MISSING: isRoleBased column NOT found.')
            const allColumns: any[] = await prisma.$queryRaw`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'Client'
      `
            console.log('Available columns in Client table:', allColumns.map(c => c.column_name))
        }
    } catch (e: any) {
        console.log('ERROR_DURING_CHECK:', e.message)
    } finally {
        await prisma.$disconnect()
    }
}

main()
