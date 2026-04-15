import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedData = async () => {
  console.log('Starting database seed...');

  try {
    // User
    const demoUser = await prisma.user.create({
      data: {
        email: `demo-${Date.now()}@opportunity-os.com`,
        fullName: 'Demo User',
      },
    });

    // Plans
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

    // PlanFeatures (skip if already exist)
    try {
      await prisma.planFeature.createMany({
        data: [
          { planId: starterPlan.id, featureKey: 'MAX_COMPANIES', accessLevel: 'enabled', configJson: { limit: 10 } },
          { planId: starterPlan.id, featureKey: 'MAX_OPPORTUNITIES', accessLevel: 'enabled', configJson: { limit: 50 } },
          { planId: proPlan.id, featureKey: 'MAX_COMPANIES', accessLevel: 'enabled', configJson: { limit: 100 } },
          { planId: proPlan.id, featureKey: 'MAX_OPPORTUNITIES', accessLevel: 'enabled', configJson: { limit: 500 } },
          { planId: proPlan.id, featureKey: 'AI_CREDITS_MONTHLY', accessLevel: 'enabled', configJson: { limit: 1000 } },
        ],
        skipDuplicates: true,
      });
    } catch (error) {
      // Ignore if features already exist
    }

    // Subscription
    const subscription = await prisma.subscription.create({
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

    // Company
    const demoCompany = await prisma.company.create({
      data: {
        name: 'Tech Corp',
        domain: 'techcorp.com',
        description: 'A technology company building innovative solutions',
        userId: demoUser.id,
      },
    });

    // People
    const johnPerson = await prisma.person.create({
      data: {
        firstName: 'John',
        lastName: 'Smith',
        fullName: 'John Smith',
        email: 'john.smith@techcorp.com',
        title: 'Engineering Manager',
        userId: demoUser.id,
        companyId: demoCompany.id,
      },
    });

    const sarahPerson = await prisma.person.create({
      data: {
        firstName: 'Sarah',
        lastName: 'Johnson',
        fullName: 'Sarah Johnson',
        email: 'sarah.johnson@techcorp.com',
        title: 'Product Manager',
        userId: demoUser.id,
        companyId: demoCompany.id,
      },
    });

    // Opportunity
    const demoOpportunity = await prisma.opportunity.create({
      data: {
        title: 'Enterprise Software License',
        stage: 'conversation_started',
        priority: 'high',
        estimatedValueCents: 250000,
        source: 'discovery',
        userId: demoUser.id,
        companyId: demoCompany.id,
        primaryPersonId: johnPerson.id,
      },
    });

    // Activities
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

    // Tasks
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

    // SearchProfile
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

    // SearchRun
    const searchRun = await prisma.searchRun.create({
      data: {
        searchProfileId: searchProfile.id,
        status: 'completed',
        resultCount: 25,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
    });

    // DiscoveredOpportunities
    await prisma.discoveredOpportunity.createMany({
      data: [
        {
          title: 'Senior Backend Engineer at StartupXYZ',
          companyNameRaw: 'StartupXYZ',
          location: 'Remote',
          descriptionRaw: 'Looking for experienced backend engineer',
          sourceType: 'linkedin',
          sourceUrl: 'https://linkedin.com/jobs/123',
          searchRunId: searchRun.id,
          lifecycleStatus: 'new',
        },
        {
          title: 'Full Stack Developer at TechCo',
          companyNameRaw: 'TechCo',
          location: 'San Francisco',
          descriptionRaw: 'Full stack position with modern tech stack',
          sourceType: 'angel',
          sourceUrl: 'https://angel.co/jobs/456',
          searchRunId: searchRun.id,
          lifecycleStatus: 'new',
        },
      ],
    });

    console.log('Database seed completed successfully!');
    console.log(`Created user: ${demoUser.id}`);
    console.log(`Created company: ${demoCompany.id}`);
    console.log(`Created opportunity: ${demoOpportunity.id}`);
    console.log(`Created subscription: ${subscription.id}`);
    console.log(`Created search profile: ${searchProfile.id}`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedData();
