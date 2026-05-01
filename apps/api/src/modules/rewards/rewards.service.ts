import { Injectable, Logger } from '@nestjs/common';
import { prisma, EngagementRewardTrigger, RewardType, RewardRuleType } from '@opportunity-os/db';
import { SystemDateService } from '../../common/system-date.service';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);
  constructor(private readonly systemDateService: SystemDateService) {}

  /**
   * Evaluates if an action completion triggers any rewards.
   */
  async evaluateActionCompletion(userId: string, actionItemId: string) {
    this.logger.log(`Evaluating rewards for user ${userId} after action ${actionItemId}`);

    // 1. Update Momentum State
    await this.updateMomentumForAction(userId);

    // 2. Check for daily quota rewards
    await this.checkDailyQuotaReward(userId);

    // 3. Check for streaks
    await this.evaluateStreak(userId);
  }

  /**
   * Increments the user's velocity pulse and updates streak state.
   */
  private async updateMomentumForAction(userId: string) {
    const today = this.systemDateService.today();

    // Find or create today's momentum state
    const existing = await prisma.momentumState.findFirst({
      where: {
        userId,
        stateType: 'velocity_pulse',
        createdAt: { gte: today },
      },
    });

    if (existing) {
      await prisma.momentumState.update({
        where: { id: existing.id },
        data: {
          score: (existing.score || 0) + 1,
          computedAt: this.systemDateService.now(),
        },
      });
    } else {
      await prisma.momentumState.create({
        data: {
          userId,
          stateType: 'velocity_pulse',
          score: 1,
          reason: 'Daily action pulse',
        },
      });
    }
  }

  /**
   * Checks if the user has met a daily action threshold for a reward.
   */
  private async checkDailyQuotaReward(userId: string) {
    const today = this.systemDateService.today();

    // Count completed actions today
    const count = await prisma.commandQueueItem.count({
      where: {
        userId,
        status: 'completed',
        completedAt: { gte: today },
      },
    });

    // Check rules for ACTION_THRESHOLD
    const rules = await prisma.rewardRule.findMany({
      where: {
        ruleType: 'ACTION_THRESHOLD',
        triggerType: 'DAILY_QUOTA_MET',
        isActive: true,
      },
    });

    for (const rule of rules) {
      const criteria = rule.criteriaJson as any;
      const threshold = criteria?.threshold || 5;

      if (count >= threshold) {
        await this.grantReward(userId, rule.id, EngagementRewardTrigger.DAILY_QUOTA_MET);
      }
    }
  }

  /**
   * Evaluates the current active streak and grants rewards for milestones.
   */
  async evaluateStreak(userId: string) {
    const today = this.systemDateService.today();

    // Get recent activity days
    const activities = await prisma.momentumState.findMany({
      where: {
        userId,
        stateType: 'velocity_pulse',
        score: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    if (activities.length === 0) return 0;

    let streak = 0;
    let currentDate = today;

    // Simplified streak logic: check consecutive days
    for (const activity of activities) {
      const activityDate = new Date(activity.createdAt);
      activityDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((currentDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        streak++;
      } else if (diffDays === 1) {
        streak++;
        currentDate = activityDate;
      } else {
        break;
      }
    }

    // Update streak in MomentumState
    await prisma.momentumState.upsert({
      where: {
        // We'll use a specific metadata key or find by type
        id: (await prisma.momentumState.findFirst({ where: { userId, stateType: 'streak' } }))?.id || '00000000-0000-0000-0000-000000000000',
      },
      create: {
        userId,
        stateType: 'streak',
        score: streak,
        reason: `${streak} day execution streak`,
      },
      update: {
        score: streak,
        computedAt: this.systemDateService.now(),
        reason: `${streak} day execution streak`,
      },
    });

    // Check for streak-hit rewards (e.g., 3-day, 7-day)
    const streakRules = await prisma.rewardRule.findMany({
      where: {
        ruleType: 'TEMPORAL_STREAK',
        triggerType: 'STREAK_HIT',
        isActive: true,
      },
    });

    for (const rule of streakRules) {
      const criteria = rule.criteriaJson as any;
      const targetStreak = criteria?.streakDays;

      if (streak === targetStreak) {
        await this.grantReward(userId, rule.id, EngagementRewardTrigger.STREAK_HIT);
      }
    }

    return streak;
  }

  /**
   * Internal method to grant a reward and its associated growth credits.
   */
  private async grantReward(userId: string, ruleId: string, triggerType: EngagementRewardTrigger) {
    // Prevent duplicate rewards for the same rule/trigger on the same day
    const today = this.systemDateService.today();

    const existing = await prisma.engagementReward.findFirst({
      where: {
        userId,
        ruleId,
        createdAt: { gte: today },
      },
    });

    if (existing) return;

    const rule = await prisma.rewardRule.findUnique({ where: { id: ruleId } });
    if (!rule) return;

    await prisma.$transaction(async (tx) => {
      const reward = await tx.engagementReward.create({
        data: {
          userId,
          ruleId,
          triggerType,
          rewardType: rule.rewardType,
          quantity: rule.rewardQuantity,
          featureKey: rule.featureKey,
          status: 'granted',
          metadataJson: { ruleTitle: rule.ruleType },
        },
      });

      // If it's a credit-based reward, add it to GrowthCredits
      if (rule.rewardType.endsWith('_credit') && rule.featureKey) {
        await tx.growthCredit.create({
          data: {
            userId,
            engagementRewardId: reward.id,
            featureKey: rule.featureKey,
            creditType: rule.rewardType,
            quantityGranted: rule.rewardQuantity,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 day expiry
          },
        });
      }
    });

    this.logger.log(`Granted ${rule.rewardQuantity} ${rule.rewardType} to user ${userId} for ${triggerType}`);
  }

  /**
   * Fetches the user's reward history and current momentum.
   */
  async getRewardsGallery(userId: string) {
    const [rewards, momentum, streak] = await Promise.all([
      prisma.engagementReward.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.momentumState.findMany({
        where: { userId, stateType: 'velocity_pulse' },
        orderBy: { createdAt: 'desc' },
        take: 7,
      }),
      prisma.momentumState.findFirst({
        where: { userId, stateType: 'streak' },
      }),
    ]);

    return {
      streak: streak?.score || 0,
      recentVelocity: momentum.map(m => ({ date: m.createdAt, score: m.score })),
      history: rewards.map(r => ({
        id: r.id,
        trigger: r.triggerType,
        type: r.rewardType,
        quantity: r.quantity,
        grantedAt: r.grantedAt,
      })),
    };
  }
}
