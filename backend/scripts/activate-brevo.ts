import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await (prisma as any).globalSettings.upsert({
    where: { id: 'singleton' },
    update: { 
      emailProvider: 'BREVO',
    },
    create: {
      id: 'singleton',
      emailProvider: 'BREVO',
      aiProvider: 'Groq',
      aiModel: 'llama-3.3-70b-versatile',
      projectName: 'IKF Outreach'
    },
  })
  console.log('Settings updated:', result)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
