import { prisma, EngagementRewardTrigger, RewardType, RewardRuleType } from '@opportunity-os/db';

async function seedRewardRules() {
  console.log('Seeding Reward Rules...');

  const rules = [
    {
      ruleType: RewardRuleType.ACTION_THRESHOLD,
      triggerType: EngagementRewardTrigger.DAILY_QUOTA_MET,
      criteriaJson: { threshold: 5 },
      rewardType: RewardType.ai_usage_credit,
      rewardQuantity: 50,
      featureKey: 'ai_requests',
    },
    {
      ruleType: RewardRuleType.TEMPORAL_STREAK,
      triggerType: EngagementRewardTrigger.STREAK_HIT,
      criteriaJson: { streakDays: 3 },
      rewardType: RewardType.ai_usage_credit,
      rewardQuantity: 100,
      featureKey: 'ai_requests',
    },
    {
      ruleType: RewardRuleType.TEMPORAL_STREAK,
      triggerType: EngagementRewardTrigger.STREAK_HIT,
      criteriaJson: { streakDays: 7 },
      rewardType: RewardType.ai_usage_credit,
      rewardQuantity: 250,
      featureKey: 'ai_requests',
    },
  ];

  for (const rule of rules) {
    await prisma.rewardRule.upsert({
      where: {
        id: (await prisma.rewardRule.findFirst({
          where: { triggerType: rule.triggerType, ruleType: rule.ruleType, rewardQuantity: rule.rewardQuantity }
        }))?.id || '00000000-0000-0000-0000-000000000000',
      },
      create: rule,
      update: rule,
    });
  }

  console.log('Reward Rules Seeded.');
}

seedRewardRules()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
