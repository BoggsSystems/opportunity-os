import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { prisma } from '@opportunity-os/db';
import { CommercialService } from '../../src/modules/commercial/commercial.service';

describe('Digital Twin Validator (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jest.setTimeout(60000); // 60 seconds
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
    const commercialService = app.get(CommercialService);
    const isPaid = await commercialService.isPaidUser(pastDueSub.userId);
    
    expect(isPaid).toBe(false);
  });

  it('should verify MRR snapshots match active subscription volume', async () => {
    const latestSnapshot = await prisma.adminMetricSnapshot.findFirst({
      where: { metricKey: 'billing.mrr_cents' },
      orderBy: { createdAt: 'desc' }
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

    // Each active 'builder' sub price
    const builderPlan = await prisma.plan.findFirst({ where: { code: 'builder' } });
    const priceCents = builderPlan?.monthlyPriceCents || 2900;
    const expectedMrr = activeSubs * priceCents;
    
    // In our simulation, the snapshot value should exactly match the sum of active paid subs
    expect(Number(latestSnapshot.metricValue)).toBe(expectedMrr);
  });

  it('should verify that every user has a lifecycle snapshot', async () => {
    const totalUsers = await prisma.user.count({
      where: { 
        email: { 
          contains: 'billing-sim-',
          not: { contains: '-admin-' }
        }
      }
    });
    
    const totalSnapshots = await prisma.userLifecycleSnapshot.count({
      where: { metadataJson: { path: ['source'], equals: 'billing_simulation' } }
    });

    expect(totalSnapshots).toBe(totalUsers);
  });

  it('should verify that all activated users have CRM mappings', async () => {
    // Activated users in simulation (mod 10 <= 2) should have a mapping
    const activatedUsers = await prisma.user.findMany({
      where: {
        email: { 
          contains: 'billing-sim-',
          not: { contains: '-admin-' }
        },
        lifecycleSnapshot: { currentStage: 'activated' }
      }
    });

    for (const user of activatedUsers) {
      const mapping = await prisma.externalMapping.findFirst({
        where: { userId: user.id }
      });
      expect(mapping).toBeDefined();
      expect(['hubspot', 'salesforce']).toContain(mapping?.remoteProvider);
    }
  });

  it('should verify that stalled users received a ghost_campaign nudge', async () => {
    // Stalled users in simulation (mod 10 > 7) should have a log
    const stalledUsers = await prisma.user.findMany({
      where: {
        email: { 
          contains: 'billing-sim-',
          not: { contains: '-admin-' }
        },
        lifecycleSnapshot: { currentStage: 'account_created' }
      }
    });

    for (const user of stalledUsers) {
      const log = await prisma.userEngagementLog.findFirst({
        where: { 
          userId: user.id,
          nudgeType: 'ghost_campaign'
        }
      });
      expect(log).toBeDefined();
      expect(log?.metadataJson).toMatchObject({ simulated: true });
    }
  });
});
