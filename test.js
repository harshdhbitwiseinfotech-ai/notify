const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    await prisma.session.upsert({
      where: { id: 'test' },
      update: { id: 'test', shop: 'test', state: 'test', accessToken: 'test', isOnline: false },
      create: { id: 'test', shop: 'test', state: 'test', accessToken: 'test', isOnline: false }
    });
    console.log('Success');
  } catch (e) {
    console.error('ERROR: ', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
