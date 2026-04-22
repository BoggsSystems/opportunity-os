import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PlanSeed = {
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  features: Array<{
    featureKey: string;
    accessLevel: 'disabled' | 'enabled' | 'limited' | 'premium';
    configJson?: Record<string, unknown>;
  }>;
};

const plans: PlanSeed[] = [
  {
    code: 'free_explorer',
    name: 'Free Explorer',
    description: 'Bounded free usage for onboarding and the first real momentum loop.',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    features: [
      { featureKey: 'offerings', accessLevel: 'limited', configJson: { limit: 1 } },
      { featureKey: 'ai_requests', accessLevel: 'limited', configJson: { limit: 30 } },
      { featureKey: 'opportunity_cycles', accessLevel: 'limited', configJson: { limit: 5 } },
      { featureKey: 'discovery_scans', accessLevel: 'limited', configJson: { limit: 3 } },
      { featureKey: 'content_ingestions', accessLevel: 'limited', configJson: { limit: 2 } },
      { featureKey: 'email_drafts', accessLevel: 'limited', configJson: { limit: 10 } },
      { featureKey: 'email_send', accessLevel: 'disabled' },
      { featureKey: 'connectors', accessLevel: 'limited', configJson: { limit: 1 } },
      { featureKey: 'advanced_coaching', accessLevel: 'disabled' },
      { featureKey: 'background_sync', accessLevel: 'disabled' },
    ],
  },
  {
    code: 'builder',
    name: 'Builder',
    description: 'For users actively building repeatable opportunity motion.',
    monthlyPriceCents: 2900,
    annualPriceCents: 29000,
    features: [
      { featureKey: 'offerings', accessLevel: 'limited', configJson: { limit: 3 } },
      { featureKey: 'ai_requests', accessLevel: 'limited', configJson: { limit: 300 } },
      { featureKey: 'opportunity_cycles', accessLevel: 'limited', configJson: { limit: 50 } },
      { featureKey: 'discovery_scans', accessLevel: 'limited', configJson: { limit: 25 } },
      { featureKey: 'content_ingestions', accessLevel: 'limited', configJson: { limit: 20 } },
      { featureKey: 'email_drafts', accessLevel: 'enabled' },
      { featureKey: 'email_send', accessLevel: 'limited', configJson: { limit: 100 } },
      { featureKey: 'connectors', accessLevel: 'limited', configJson: { limit: 3 } },
      { featureKey: 'advanced_coaching', accessLevel: 'enabled' },
      { featureKey: 'background_sync', accessLevel: 'disabled' },
    ],
  },
  {
    code: 'operator',
    name: 'Operator',
    description: 'For higher-volume execution across discovery, outreach, and follow-through.',
    monthlyPriceCents: 7900,
    annualPriceCents: 79000,
    features: [
      { featureKey: 'offerings', accessLevel: 'limited', configJson: { limit: 10 } },
      { featureKey: 'ai_requests', accessLevel: 'limited', configJson: { limit: 1500 } },
      { featureKey: 'opportunity_cycles', accessLevel: 'limited', configJson: { limit: 250 } },
      { featureKey: 'discovery_scans', accessLevel: 'limited', configJson: { limit: 150 } },
      { featureKey: 'content_ingestions', accessLevel: 'limited', configJson: { limit: 100 } },
      { featureKey: 'email_drafts', accessLevel: 'enabled' },
      { featureKey: 'email_send', accessLevel: 'limited', configJson: { limit: 500 } },
      { featureKey: 'connectors', accessLevel: 'limited', configJson: { limit: 8 } },
      { featureKey: 'advanced_coaching', accessLevel: 'enabled' },
      { featureKey: 'background_sync', accessLevel: 'enabled' },
    ],
  },
  {
    code: 'studio',
    name: 'Studio',
    description: 'For power users and internal dogfooding with broad usage allowances.',
    monthlyPriceCents: 19900,
    annualPriceCents: 199000,
    features: [
      { featureKey: 'offerings', accessLevel: 'enabled' },
      { featureKey: 'ai_requests', accessLevel: 'limited', configJson: { limit: 10000 } },
      { featureKey: 'opportunity_cycles', accessLevel: 'enabled' },
      { featureKey: 'discovery_scans', accessLevel: 'limited', configJson: { limit: 1000 } },
      { featureKey: 'content_ingestions', accessLevel: 'enabled' },
      { featureKey: 'email_drafts', accessLevel: 'enabled' },
      { featureKey: 'email_send', accessLevel: 'limited', configJson: { limit: 2500 } },
      { featureKey: 'connectors', accessLevel: 'enabled' },
      { featureKey: 'advanced_coaching', accessLevel: 'enabled' },
      { featureKey: 'background_sync', accessLevel: 'enabled' },
    ],
  },
];

async function seedCommercialFoundation() {
  for (const planSeed of plans) {
    const plan = await prisma.plan.upsert({
      where: { code: planSeed.code },
      update: {
        name: planSeed.name,
        description: planSeed.description,
        monthlyPriceCents: planSeed.monthlyPriceCents,
        annualPriceCents: planSeed.annualPriceCents,
        currency: 'USD',
        isActive: true,
      },
      create: {
        code: planSeed.code,
        name: planSeed.name,
        description: planSeed.description,
        monthlyPriceCents: planSeed.monthlyPriceCents,
        annualPriceCents: planSeed.annualPriceCents,
        currency: 'USD',
        isActive: true,
      },
    });

    for (const feature of planSeed.features) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureKey: {
            planId: plan.id,
            featureKey: feature.featureKey,
          },
        },
        update: {
          accessLevel: feature.accessLevel,
          configJson: feature.configJson,
        },
        create: {
          planId: plan.id,
          featureKey: feature.featureKey,
          accessLevel: feature.accessLevel,
          configJson: feature.configJson,
        },
      });
    }
  }

  console.log(`Seeded ${plans.length} commercial plans with entitlement features.`);
}

seedCommercialFoundation()
  .catch((error) => {
    console.error('Commercial foundation seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
