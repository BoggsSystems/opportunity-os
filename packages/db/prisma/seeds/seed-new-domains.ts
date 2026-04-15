import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedNewDomains = async () => {
  console.log('Seeding new domains...');

  // Get any existing user
  const demoUser = await prisma.user.findFirst();

  if (!demoUser) {
    console.error('No user found. Please run main seed first.');
    return;
  }

  console.log(`Found user: ${demoUser.email}`);

  // Create demo offerings
  const demoOffering = await prisma.offering.create({
    data: {
      title: 'Full-Stack Development Services',
      description: 'End-to-end web development with modern technologies',
      offeringType: 'service',
      status: 'active',
      userId: demoUser.id,
    },
  });

  const demoPositioning = await prisma.offeringPositioning.create({
    data: {
      title: 'Startup Technical Co-founder',
      description: 'Technical partnership for early-stage startups',
      offeringId: demoOffering.id,
      status: 'active',
    },
  });

  await prisma.offeringAsset.create({
    data: {
      title: 'Portfolio Website',
      description: 'Recent portfolio project showcasing full-stack capabilities',
      assetType: 'portfolio',
      contentUrl: 'https://example.com/portfolio',
      offeringId: demoOffering.id,
      status: 'active',
    },
  });

  // Create demo AI conversation
  const demoConversation = await prisma.aIConversation.create({
    data: {
      title: 'Offering Strategy Discussion',
      purpose: 'offering_strategy',
      offeringId: demoOffering.id,
      userId: demoUser.id,
      status: 'active',
    },
  });

  await prisma.aIConversationMessage.createMany({
    data: [
      {
        conversationId: demoConversation.id,
        messageType: 'user',
        content: 'How should I position my development services for startups?',
      },
      {
        conversationId: demoConversation.id,
        messageType: 'assistant',
        content: 'Based on your full-stack experience, consider positioning as a technical co-founder partner...',
      },
    ],
  });

  // Create demo AI context summary
  await prisma.aIContextSummary.create({
    data: {
      title: 'Development Services Summary',
      summaryType: 'offering_summary',
      content: 'Full-stack development services with expertise in React, Node.js, and cloud deployment.',
      sourceType: 'offering',
      sourceId: demoOffering.id,
      offeringId: demoOffering.id,
      userId: demoUser.id,
    },
  });

  // Create demo AI task
  await prisma.aITask.create({
    data: {
      taskType: 'offering_analysis',
      title: 'Analyze offering positioning',
      description: 'Review and suggest improvements for current positioning',
      offeringId: demoOffering.id,
      aiConversationId: demoConversation.id,
      status: 'completed',
      completedAt: new Date(),
      userId: demoUser.id,
    },
  });

  console.log('New domains seeded successfully!');
  console.log(`Created offering: ${demoOffering.title}`);
  console.log(`Created positioning: ${demoPositioning.title}`);
  console.log(`Created conversation: ${demoConversation.title}`);
};

seedNewDomains()
  .catch((error) => {
    console.error('Error seeding new domains:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
