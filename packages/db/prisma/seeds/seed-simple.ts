import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedData = async () => {
  console.log('Starting database seed...');

  try {
    // Create plans
    const starterPlan = await prisma.plan.create({
      data: {
        code: 'starter',
        name: 'Starter',
        description: 'Perfect for individuals and small teams',
        monthlyPriceCents: 2900, // $29/month
        currency: 'USD',
      },
    });

    const proPlan = await prisma.plan.create({
      data: {
        code: 'pro',
        name: 'Pro',
        description: 'For growing teams and power users',
        monthlyPriceCents: 9900, // $99/month
        currency: 'USD',
      },
    });

    const enterprisePlan = await prisma.plan.create({
      data: {
        code: 'enterprise',
        name: 'Enterprise',
        description: 'Custom solutions for large organizations',
        monthlyPriceCents: 29900, // $299/month
        currency: 'USD',
      },
    });

    console.log('Plans created:', { starterPlan, proPlan, enterprisePlan });

    // Create a demo user
    const demoUser = await prisma.user.create({
      data: {
        email: 'demo@opportunity-os.com',
        name: 'Demo User',
      },
    });

    // Create subscription for demo user
    await prisma.subscription.create({
      data: {
        userId: demoUser.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        providerCustomerId: 'cus_demo',
        providerSubscriptionId: 'sub_demo',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    // Create a demo company
    const demoCompany = await prisma.company.create({
      data: {
        name: 'Tech Corp',
        domain: 'techcorp.com',
        description: 'A technology company building innovative solutions',
        website: 'https://techcorp.com',
        size: '51-200',
        industry: 'Technology',
        foundedYear: 2015,
        location: 'San Francisco, CA',
        userId: demoUser.id,
      },
    });

    // Create demo people
    await prisma.person.createMany({
      data: [
        {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@techcorp.com',
          title: 'Engineering Manager',
          seniority: 'senior',
          department: 'Engineering',
          companyId: demoCompany.id,
        },
        {
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.johnson@techcorp.com',
          title: 'Product Manager',
          seniority: 'senior',
          department: 'Product',
          companyId: demoCompany.id,
        },
      ],
    });

    // Create demo opportunity
    const demoOpportunity = await prisma.opportunity.create({
      data: {
        title: 'Enterprise Software License',
        description: 'Large enterprise license deal for our core platform',
        stage: 'QUALIFIED',
        priority: 'high',
        estimatedValueCents: 250000, // $2,500
        closeDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        source: 'discovery',
        tags: ['enterprise', 'software', 'high-value'],
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
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedData();
