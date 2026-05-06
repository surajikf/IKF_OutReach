import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const services = [
    { serviceName: 'Website', category: 'Digital', description: 'Custom website building and design.' },
    { serviceName: 'SEO', category: 'Digital', description: 'Search Engine Optimization.' },
    { serviceName: 'PPC', category: 'Marketing', description: 'Pay-Per-Click Advertising.' },
    { serviceName: 'Hosting', category: 'Technology', description: 'Web hosting and infrastructure.' },
    { serviceName: 'LinkedIn Branding', category: 'Marketing', description: 'Optimizing LinkedIn profiles and presence.' },
    { serviceName: 'Social Media Management', category: 'Marketing', description: 'Managing social platforms and content.' },
    { serviceName: 'AI Automation', category: 'Technology', description: 'Implementing AI workflows and tools.' },
    { serviceName: 'HR Consulting', category: 'Corporate', description: 'Human resources and recruitment strategy.' },
];

async function main() {
    console.log('Seeding services...');
    for (const service of services) {
        await prisma.service.upsert({
            where: { serviceName: service.serviceName },
            update: {},
            create: service,
        });
    }
    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
