
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const connectionCount = await prisma.connectionRecord.count();
  const personCount = await prisma.person.count();
  const userCount = await prisma.user.count();
  const campaignCount = await prisma.campaign.count();

  console.log('--- Database Stats ---');
  console.log('Users:', userCount);
  console.log('ConnectionRecords:', connectionCount);
  console.log('People:', personCount);
  console.log('Campaigns:', campaignCount);
  
  if (connectionCount > 0) {
    const samples = await prisma.connectionRecord.findMany({ take: 3 });
    console.log('Sample Connections:', samples.map(c => `${c.firstName} ${c.lastName} (${c.company})`));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
