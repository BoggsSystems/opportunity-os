import { Injectable, NotFoundException } from '@nestjs/common';
import { FeatureAccessLevel, GrowthCreditStatus, Prisma, prisma } from '@opportunity-os/db';

const UpgradeReason = {
  plan_does_not_include_capability: 'plan_does_not_include_capability',
  usage_limit_reached: 'usage_limit_reached',
  connector_limit_reached: 'connector_limit_reached',
  missing_required_connector: 'missing_required_connector',
  trial_expired: 'trial_expired',
  payment_required: 'payment_required',
  feature_temporarily_disabled: 'feature_temporarily_disabled',
} as const;

type UpgradeReason = (typeof UpgradeReason)[keyof typeof UpgradeReason];

type CapabilityCheckInput = {
  featureKey: string;
  quantity?: number;
  connectorCapability?: string;
};

type CapabilityCheckResult = {
  allowed: boolean;
  featureKey: string;
  requestedQuantity: number;
  accessLevel: FeatureAccessLevel | 'missing';
  plan: {
    code: string;
    name: string;
  } | null;
  limit: number | null;
  used: number;
  credited: number;
  remaining: number | null;
  upgradeReason?: UpgradeReason;
  upgradeHint?: string;
};

@Injectable()
export class CommercialService {
  private readonly freePlanCode = 'free_explorer';

  async getSubscription(userId: string) {
    const subscription = await this.resolveActiveSubscription(userId);

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    return {
      id: subscription.id,
      status: subscription.status,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        description: subscription.plan.description,
        monthlyPriceCents: subscription.plan.monthlyPriceCents,
        annualPriceCents: subscription.plan.annualPriceCents,
        currency: subscription.plan.currency,
      },
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      startedAt: subscription.startedAt,
    };
  }

  async getEntitlements(userId: string): Promise<any> {
    const subscription = await this.resolveActiveSubscription(userId);

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const entitlements = await Promise.all(subscription.plan.planFeatures.map(async feature => {
      const usage = await this.getCurrentUsage(userId, feature.featureKey);
      const credits = await this.getAvailableCredits(userId, feature.featureKey);
      const limit = this.extractLimit(feature.configJson);

      return {
        key: feature.featureKey,
        accessLevel: feature.accessLevel,
        config: feature.configJson,
        usage: {
          used: usage,
          credited: credits,
          limit,
          remaining: limit === null ? null : Math.max(limit + credits - usage, 0),
        },
      };
    }));

    return {
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      entitlements,
    };
  }

  async getUsage(userId: string) {
    const usageCounters = await prisma.usageCounter.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const growthCredits = await prisma.growthCredit.findMany({
      where: {
        userId,
        status: {
          in: [GrowthCreditStatus.available, GrowthCreditStatus.partially_used],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: {
        grantedAt: 'desc',
      },
    });

    return {
      usageCounters: usageCounters.map(counter => ({
        key: counter.featureKey,
        value: counter.usedCount,
        period: {
          start: counter.usagePeriodStart,
          end: counter.usagePeriodEnd,
        },
        updatedAt: counter.updatedAt,
      })),
      growthCredits: growthCredits.map(credit => ({
        id: credit.id,
        key: credit.featureKey,
        creditType: credit.creditType,
        granted: credit.quantityGranted,
        used: credit.quantityUsed,
        remaining: Math.max(credit.quantityGranted - credit.quantityUsed, 0),
        expiresAt: credit.expiresAt,
      })),
    };
  }

  async checkCapability(userId: string, input: CapabilityCheckInput): Promise<CapabilityCheckResult> {
    const requestedQuantity = Math.max(input.quantity ?? 1, 1);
    const subscription = await this.resolveActiveSubscription(userId);

    if (!subscription) {
      return this.blocked(input.featureKey, requestedQuantity, UpgradeReason.payment_required, 'Choose a plan to continue.');
    }

    const feature = subscription.plan.planFeatures.find(planFeature => planFeature.featureKey === input.featureKey);

    if (!feature || feature.accessLevel === FeatureAccessLevel.disabled) {
      return this.blocked(
        input.featureKey,
        requestedQuantity,
        UpgradeReason.plan_does_not_include_capability,
        'Upgrade to a plan that includes this capability.',
        subscription,
        feature?.accessLevel ?? 'missing',
      );
    }

    if (input.connectorCapability) {
      const connector = await prisma.userConnector.findFirst({
        where: {
          userId,
          capability: {
            capabilityType: input.connectorCapability as any,
          },
          status: 'connected',
        },
      });

      if (!connector) {
        return this.blocked(
          input.featureKey,
          requestedQuantity,
          UpgradeReason.missing_required_connector,
          'Connect the required account to use this capability.',
          subscription,
          feature.accessLevel,
        );
      }
    }

    const limit = this.extractLimit(feature.configJson);
    const used = await this.getCurrentUsage(userId, input.featureKey);
    const credited = await this.getAvailableCredits(userId, input.featureKey);
    const remaining = limit === null ? null : Math.max(limit + credited - used, 0);

    if (feature.accessLevel === FeatureAccessLevel.limited && remaining !== null && remaining < requestedQuantity) {
      return {
        allowed: false,
        featureKey: input.featureKey,
        requestedQuantity,
        accessLevel: feature.accessLevel,
        plan: {
          code: subscription.plan.code,
          name: subscription.plan.name,
        },
        limit,
        used,
        credited,
        remaining,
        upgradeReason: UpgradeReason.usage_limit_reached,
        upgradeHint: 'Upgrade or earn credits to continue using this capability.',
      };
    }

    return {
      allowed: true,
      featureKey: input.featureKey,
      requestedQuantity,
      accessLevel: feature.accessLevel,
      plan: {
        code: subscription.plan.code,
        name: subscription.plan.name,
      },
      limit,
      used,
      credited,
      remaining,
    };
  }

  async incrementUsage(userId: string, featureKey: string, quantity = 1) {
    const requestedQuantity = Math.max(quantity, 1);
    const check = await this.checkCapability(userId, { featureKey, quantity: requestedQuantity });

    if (!check.allowed) {
      return check;
    }

    const previousUsed = check.used;
    const baseLimit = check.limit;
    const creditQuantityToConsume =
      baseLimit === null ? 0 : Math.max(Math.min(previousUsed + requestedQuantity - baseLimit, requestedQuantity), 0);

    const { counter, creditsConsumed } = await prisma.$transaction(async (tx) => {
      const { start, end } = this.currentMonthlyWindow();
      const updatedCounter = await tx.usageCounter.upsert({
        where: {
          userId_featureKey_usagePeriodStart_usagePeriodEnd: {
            userId,
            featureKey,
            usagePeriodStart: start,
            usagePeriodEnd: end,
          },
        },
        update: {
          usedCount: {
            increment: requestedQuantity,
          },
        },
        create: {
          userId,
          featureKey,
          usagePeriodStart: start,
          usagePeriodEnd: end,
          usedCount: requestedQuantity,
        },
      });

      const consumed = creditQuantityToConsume > 0
        ? await this.consumeGrowthCredits(tx, userId, featureKey, creditQuantityToConsume)
        : 0;

      return {
        counter: updatedCounter,
        creditsConsumed: consumed,
      };
    });

    const creditedRemaining = Math.max(check.credited - creditsConsumed, 0);

    return {
      ...check,
      used: counter.usedCount,
      credited: creditedRemaining,
      creditsConsumed,
      remaining: check.limit === null ? null : Math.max(check.limit + creditedRemaining - counter.usedCount, 0),
    };
  }

  private async resolveActiveSubscription(userId: string) {
    let subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        plan: {
          include: {
            planFeatures: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      const freePlan = await prisma.plan.findUnique({
        where: {
          code: this.freePlanCode,
        },
        include: {
          planFeatures: true,
        },
      });

      if (!freePlan) {
        return null;
      }

      subscription = await prisma.subscription.create({
        data: {
          userId,
          planId: freePlan.id,
          status: 'active',
          startedAt: new Date(),
          currentPeriodStart: this.currentMonthlyWindow().start,
          currentPeriodEnd: this.currentMonthlyWindow().end,
        },
        include: {
          plan: {
            include: {
              planFeatures: true,
            },
          },
        },
      });
    }

    return subscription;
  }

  private extractLimit(configJson: unknown): number | null {
    if (!configJson || typeof configJson !== 'object' || !('limit' in configJson)) {
      return null;
    }

    const limit = Number((configJson as { limit?: unknown }).limit);
    return Number.isFinite(limit) ? limit : null;
  }

  private async getCurrentUsage(userId: string, featureKey: string): Promise<number> {
    const { start, end } = this.currentMonthlyWindow();
    const counter = await prisma.usageCounter.findUnique({
      where: {
        userId_featureKey_usagePeriodStart_usagePeriodEnd: {
          userId,
          featureKey,
          usagePeriodStart: start,
          usagePeriodEnd: end,
        },
      },
    });

    return counter?.usedCount ?? 0;
  }

  private async getAvailableCredits(userId: string, featureKey: string): Promise<number> {
    const credits = await prisma.growthCredit.findMany({
      where: {
        userId,
        featureKey,
        status: {
          in: [GrowthCreditStatus.available, GrowthCreditStatus.partially_used],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    return credits.reduce((sum, credit) => sum + Math.max(credit.quantityGranted - credit.quantityUsed, 0), 0);
  }

  private async consumeGrowthCredits(
    tx: Prisma.TransactionClient,
    userId: string,
    featureKey: string,
    quantity: number,
  ): Promise<number> {
    let remainingToConsume = quantity;
    let consumed = 0;

    const credits = await tx.growthCredit.findMany({
      where: {
        userId,
        featureKey,
        status: {
          in: [GrowthCreditStatus.available, GrowthCreditStatus.partially_used],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: {
        grantedAt: 'asc',
      },
    });

    for (const credit of credits) {
      if (remainingToConsume <= 0) {
        break;
      }

      const available = Math.max(credit.quantityGranted - credit.quantityUsed, 0);
      const toConsume = Math.min(available, remainingToConsume);

      if (toConsume <= 0) {
        continue;
      }

      const nextUsed = credit.quantityUsed + toConsume;
      const nextStatus = nextUsed >= credit.quantityGranted
        ? GrowthCreditStatus.consumed
        : GrowthCreditStatus.partially_used;

      await tx.growthCredit.update({
        where: {
          id: credit.id,
        },
        data: {
          quantityUsed: nextUsed,
          status: nextStatus,
        },
      });

      remainingToConsume -= toConsume;
      consumed += toConsume;
    }

    return consumed;
  }

  private currentMonthlyWindow() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }

  private blocked(
    featureKey: string,
    requestedQuantity: number,
    upgradeReason: UpgradeReason,
    upgradeHint: string,
    subscription: Awaited<ReturnType<CommercialService['resolveActiveSubscription']>> = null,
    accessLevel: FeatureAccessLevel | 'missing' = 'missing',
  ): CapabilityCheckResult {
    return {
      allowed: false,
      featureKey,
      requestedQuantity,
      accessLevel,
      plan: subscription
        ? {
            code: subscription.plan.code,
            name: subscription.plan.name,
          }
        : null,
      limit: null,
      used: 0,
      credited: 0,
      remaining: 0,
      upgradeReason,
      upgradeHint,
    };
  }
}
