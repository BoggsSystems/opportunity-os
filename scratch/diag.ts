
import { PrismaClient } from '@opportunity-os/db';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Diagnostic ---');
  
  try {
    const userCount = await prisma.user.count();
    const campaignCount = await prisma.campaign.count();
    const connectionCount = await prisma.connectionRecord.count();
    const personCount = await prisma.person.count();
    const opportunityCount = await prisma.opportunity.count();

    console.log('Users:', userCount);
    console.log('Campaigns:', campaignCount);
    console.log('ConnectionRecords:', connectionCount);
    console.log('People:', personCount);
    console.log('Opportunities:', opportunityCount);

    if (campaignCount > 0) {
      const campaigns = await prisma.campaign.findMany({ take: 5 });
      console.log('\nRecent Campaigns:');
      campaigns.forEach(c => console.log(`- ${c.title} (${c.id})`));
    }

    if (connectionCount > 0) {
      const connections = await prisma.connectionRecord.findMany({ take: 5 });
      console.log('\nSample Connections:');
      connections.forEach(c => console.log(`- ${c.firstName} ${c.lastName} (${c.company})`));
    }
  } catch (error) {
    console.error('Diagnostic failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
