import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedData = async () => {
  console.log('Starting database seed...');

  try {
    // Create a demo user
    const demoUser = await prisma.user.create({
      data: {
        email: `demo-${Date.now()}@opportunity-os.com`,
        fullName: 'Demo User',
      },
    });

    // Create a demo company
    const demoCompany = await prisma.company.create({
      data: {
        name: 'Tech Corp',
        domain: 'techcorp.com',
        userId: demoUser.id,
      },
    });

    // Create demo people
    await prisma.person.createMany({
      data: [
        {
          firstName: 'John',
          lastName: 'Smith',
          fullName: 'John Smith',
          email: 'john.smith@techcorp.com',
          userId: demoUser.id,
          companyId: demoCompany.id,
        },
        {
          firstName: 'Sarah',
          lastName: 'Johnson',
          fullName: 'Sarah Johnson',
          email: 'sarah.johnson@techcorp.com',
          userId: demoUser.id,
          companyId: demoCompany.id,
        },
      ],
    });

    // Create demo opportunity
    const demoOpportunity = await prisma.opportunity.create({
      data: {
        title: 'Enterprise Software License',
        stage: 'conversation_started',
        priority: 'high',
        estimatedValueCents: 250000, // $2,500
        source: 'discovery',
        userId: demoUser.id,
        companyId: demoCompany.id,
      },
    });

    // Create demo activities
    await prisma.activity.createMany({
      data: [
        {
          type: 'EMAIL',
          title: 'Initial outreach',
          description: 'Sent introductory email about our platform',
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
        },
        {
          type: 'CALL',
          title: 'Discovery call',
          description: '30-minute discovery call with John Smith',
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
        },
      ],
    });

    // Create demo tasks
    await prisma.task.createMany({
      data: [
        {
          title: 'Prepare demo presentation',
          description: 'Create customized demo for Tech Corp',
          status: 'TODO',
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
        },
        {
          title: 'Follow up with Sarah',
          description: 'Schedule follow-up call with product team',
          status: 'TODO',
          priority: 'medium',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
        },
      ],
    });

    console.log('Database seed completed successfully!');
    console.log(`Created user: ${demoUser.id}`);
    console.log(`Created company: ${demoCompany.id}`);
    console.log(`Created opportunity: ${demoOpportunity.id}`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedData();
