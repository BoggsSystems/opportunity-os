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

    // Create plans
    const starterPlan = await prisma.plan.upsert({
      where: { code: 'starter' },
      update: {},
      create: {
        code: 'starter',
        name: 'Starter',
        description: 'Perfect for individuals and small teams',
        monthlyPriceCents: 2900,
        annualPriceCents: 29000,
        currency: 'USD',
        isActive: true,
      },
    });

    const proPlan = await prisma.plan.upsert({
      where: { code: 'pro' },
      update: {},
      create: {
        code: 'pro',
        name: 'Pro',
        description: 'For growing teams and power users',
        monthlyPriceCents: 9900,
        annualPriceCents: 99000,
        currency: 'USD',
        isActive: true,
      },
    });

    
    // Create subscription for demo user
    await prisma.subscription.create({
      data: {
        userId: demoUser.id,
        planId: proPlan.id,
        status: 'active',
        providerCustomerId: `cus_demo_${Date.now()}`,
        providerSubscriptionId: `sub_demo_${Date.now()}`,
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Create a demo company
    const demoCompany = await prisma.company.create({
      data: {
        name: 'Tech Corp',
        domain: 'techcorp.com',
        description: 'A technology company building innovative solutions',
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
          title: 'Engineering Manager',
          userId: demoUser.id,
          companyId: demoCompany.id,
        },
        {
          firstName: 'Sarah',
          lastName: 'Johnson',
          fullName: 'Sarah Johnson',
          email: 'sarah.johnson@techcorp.com',
          title: 'Product Manager',
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
        estimatedValueCents: 250000,
        source: 'discovery',
        userId: demoUser.id,
        companyId: demoCompany.id,
      },
    });

    // Create demo activities
    await prisma.activity.createMany({
      data: [
        {
          activityType: 'email',
          subject: 'Initial outreach',
          bodySummary: 'Sent introductory email about our platform',
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
          occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          activityType: 'call',
          subject: 'Discovery call',
          bodySummary: '30-minute discovery call with John Smith',
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
          occurredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    // Create demo tasks
    await prisma.task.createMany({
      data: [
        {
          title: 'Prepare demo presentation',
          description: 'Create customized demo for Tech Corp',
          status: 'open',
          priority: 'high',
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
        },
        {
          title: 'Follow up with Sarah',
          description: 'Schedule follow-up call with product team',
          status: 'open',
          priority: 'medium',
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          userId: demoUser.id,
          opportunityId: demoOpportunity.id,
        },
      ],
    });

    // Create search profile
    const searchProfile = await prisma.searchProfile.create({
      data: {
        name: 'Enterprise Software Companies',
        queryText: 'Companies looking for enterprise software solutions',
        filtersJson: {
          companySize: ['51-200', '201-500'],
          industries: ['Technology', 'Software'],
          locations: ['San Francisco', 'New York'],
        },
        isActive: true,
        userId: demoUser.id,
      },
    });

    // Create search run
    await prisma.searchRun.create({
      data: {
        searchProfileId: searchProfile.id,
        status: 'completed',
        resultCount: 25,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
    });

    // Create discovered opportunities
    await prisma.discoveredOpportunity.createMany({
      data: [
        {
          title: 'Senior Backend Engineer at StartupXYZ',
          company: 'StartupXYZ',
          location: 'Remote',
          description: 'Looking for experienced backend engineer',
          source: 'linkedin',
          url: 'https://linkedin.com/jobs/123',
          searchRunId: searchProfile.id,
          status: 'new',
        },
        {
          title: 'Full Stack Developer at TechCo',
          company: 'TechCo',
          location: 'San Francisco',
          description: 'Full stack position with modern tech stack',
          source: 'angel',
          url: 'https://angel.co/jobs/456',
          searchRunId: searchProfile.id,
          status: 'new',
        },
      ],
    });

    console.log('Database seed completed successfully!');
    console.log(`Created user: ${demoUser.id}`);
    console.log(`Created company: ${demoCompany.id}`);
    console.log(`Created opportunity: ${demoOpportunity.id}`);
    console.log(`Created plans: ${starterPlan.id}, ${proPlan.id}`);
    console.log(`Created search profile: ${searchProfile.id}`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedData();
