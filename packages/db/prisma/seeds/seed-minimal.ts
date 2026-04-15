import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedData = async () => {
  console.log('Starting database seed...');

  try {
    // Create a demo user
    const demoUser = await prisma.user.create({
      data: {
        email: 'demo@opportunity-os.com',
        fullName: 'Demo User',
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

    console.log('Database seed completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedData();
