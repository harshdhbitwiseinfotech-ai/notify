import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.backInStockSubscriber.findMany()
  .then(c => console.log('Subscribers:', JSON.stringify(c, null, 2)))
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
