import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedData = async () => {
  console.log('Starting database seed...');

  // Create plans
  const starterPlan = await prisma.plan.create({
    data: {
      code: 'starter',
      name: 'Starter',
      description: 'Perfect for individuals and small teams',
      price: 2900, // $29/month
      interval: 'month',
      features: {
        create: [
          { key: 'MAX_COMPANIES', value: 10 },
          { key: 'MAX_OPPORTUNITIES', value: 50 },
          { key: 'AI_CREDITS_MONTHLY', value: 100 },
        ],
      },
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      code: 'pro',
      name: 'Pro',
      description: 'For growing teams and power users',
      price: 9900, // $99/month
      interval: 'month',
      features: {
        create: [
          { key: 'MAX_COMPANIES', value: 100 },
          { key: 'MAX_OPPORTUNITIES', value: 500 },
          { key: 'AI_CREDITS_MONTHLY', value: 1000 },
          { key: 'BROWSER_AUTOMATION', value: 1 },
        ],
      },
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      code: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for large organizations',
      price: 29900, // $299/month
      interval: 'month',
      features: {
        create: [
          { key: 'MAX_COMPANIES', value: -1 }, // Unlimited
          { key: 'MAX_OPPORTUNITIES', value: -1 }, // Unlimited
          { key: 'AI_CREDITS_MONTHLY', value: -1 }, // Unlimited
          { key: 'BROWSER_AUTOMATION', value: 1 },
          { key: 'API_ACCESS', value: 1 },
          { key: 'DEDICATED_SUPPORT', value: 1 },
        ],
      },
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
      stripeCustomerId: 'cus_demo',
      stripeSubscriptionId: 'sub_demo',
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
      value: 250000, // $2,500
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
        type: 'email',
        title: 'Initial outreach',
        description: 'Sent introductory email about our platform',
        userId: demoUser.id,
        opportunityId: demoOpportunity.id,
      },
      {
        type: 'call',
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
};

seedData()
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
