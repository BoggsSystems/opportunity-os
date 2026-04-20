const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const userCount = await prisma.user.count();
    const goalCount = await prisma.goal.count();
    const campaignCount = await prisma.strategicCampaign.count();
    const oppCount = await prisma.opportunity.count();
    const convCount = await prisma.aIConversation.count();

    console.log('--- Database Status ---');
    console.log(`Users: ${userCount}`);
    console.log(`Goals: ${goalCount}`);
    console.log(`Campaigns: ${campaignCount}`);
    console.log(`Opportunities: ${oppCount}`);
    console.log(`AI Conversations: ${convCount}`);
  } catch (err) {
    console.error('Error checking DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
