/** Seeds/refreshes the built-in templates. Runs during deploys (`vercel-build`). */
import { prisma } from '../lib/prisma';
import { seedTemplates } from '../jobs/seedTemplates';

await seedTemplates();
await prisma.$disconnect();
console.log('Templates seeded');
