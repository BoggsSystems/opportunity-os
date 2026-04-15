import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@opportunity-os/db';

const prisma = new PrismaClient();

@Injectable()
export class CommercialService {
  async getSubscription(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: userId,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });

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
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: userId,
        status: 'active',
      },
      include: {
        plan: {
          include: {
            planFeatures: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const entitlements = subscription.plan.planFeatures.map(feature => ({
      key: feature.featureKey,
      accessLevel: feature.accessLevel,
      config: feature.configJson,
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
    };
  }
}
