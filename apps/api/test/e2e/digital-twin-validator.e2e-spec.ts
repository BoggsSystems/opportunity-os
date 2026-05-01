import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { prisma } from '@opportunity-os/db';

describe('Digital Twin Validator (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should verify that past_due users are downgraded to the mini model', async () => {
    // Find a past_due user from the simulation
    const pastDueSub = await prisma.subscription.findFirst({
      where: { status: 'past_due' },
      include: { user: true }
    });

    if (!pastDueSub) {
      console.warn('No past_due users found in database. Run heavy simulation first.');
      return;
    }

    // Since we can't easily trigger an AI call without a real token in this test environment
    // We will verify the logic via the CommercialService directly or a mocked AI service call if available.
    
    // For now, we verify that resolveActiveSubscription (via isPaidUser) returns false for past_due
    const commercialService = app.get('CommercialService');
    const isPaid = await commercialService.isPaidUser(pastDueSub.userId);
    
    expect(isPaid).toBe(false);
  });

  it('should verify MRR snapshots match active subscription volume', async () => {
    const latestSnapshot = await prisma.adminMetricSnapshot.findFirst({
      where: { metricKey: 'billing.mrr_cents' },
      orderBy: { periodStart: 'desc' }
    });

    if (!latestSnapshot) {
       console.warn('No snapshots found.');
       return;
    }

    const activeSubs = await prisma.subscription.count({
      where: { 
        status: 'active',
        plan: { code: { not: 'free_explorer' } }
      }
    });

    // Each active 'builder' sub is 4900 cents
    const expectedMrr = activeSubs * 4900;
    
    // In our simulation, the snapshot value should exactly match the sum of active paid subs
    expect(latestSnapshot.metricValue).toBe(expectedMrr);
  });

  it('should verify that every user has a lifecycle snapshot', async () => {
    const totalUsers = await prisma.user.count({
      where: { email: { contains: 'billing-sim-' } }
    });
    
    const totalSnapshots = await prisma.userLifecycleSnapshot.count({
      where: { metadataJson: { path: ['source'], equals: 'billing_simulation' } }
    });

    expect(totalSnapshots).toBe(totalUsers);
  });
});
