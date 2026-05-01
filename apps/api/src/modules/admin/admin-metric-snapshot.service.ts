import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ActionItemStatus,
  ActionCycleStatus,
  AdminMetricSnapshotScope,
  CampaignStatus,
  Prisma,
  prisma,
  ReferralMilestoneType,
  SubscriptionStatus,
} from "@opportunity-os/db";

const MONTHLY_METRIC_KEYS = [
  "users.total",
  "users.new",
  "users.activated",
  "billing.paid_users",
  "billing.new_paid_users",
  "billing.churned_users",
  "billing.mrr_cents",
  "billing.arr_cents",
  "billing.failed_payment_users",
  "referrals.signups",
  "referrals.paid_conversions",
  "usage.active_users",
  "campaigns.created",
  "campaigns.active",
  "action_cycles.created",
  "action_cycles.completed",
  "actions.suggested",
  "actions.completed",
  "actions.responded",
  "actions.converted",
] as const;

const COMPLETED_ACTION_STATUSES = [
  ActionItemStatus.sent_confirmed,
  ActionItemStatus.published_confirmed,
  ActionItemStatus.converted,
];

type MonthlyMetricKey = (typeof MONTHLY_METRIC_KEYS)[number];

type MetricRow = {
  key: MonthlyMetricKey;
  value: number;
  unit: string;
  dimensionsJson?: Prisma.InputJsonValue;
};

@Injectable()
export class AdminMetricSnapshotService {
  async createMonthlySnapshot(input: {
    month?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    const period = this.resolvePeriod(input);
    const metrics = await this.computeMonthlyMetrics(period);

    await prisma.$transaction(async (tx) => {
      await tx.adminMetricSnapshot.deleteMany({
        where: {
          scope: AdminMetricSnapshotScope.billing_referrals,
          periodStart: period.start,
          periodEnd: period.end,
          metricKey: { in: MONTHLY_METRIC_KEYS as unknown as string[] },
        },
      });

      await tx.adminMetricSnapshot.createMany({
        data: metrics.map((metric) => ({
          scope: AdminMetricSnapshotScope.billing_referrals,
          metricKey: metric.key,
          metricValue: metric.value,
          metricUnit: metric.unit,
          periodStart: period.start,
          periodEnd: period.end,
          dimensionsJson: metric.dimensionsJson,
          metadataJson: {
            snapshotKind: "monthly_growth_billing",
            idempotency: "delete_and_recompute_for_period",
          },
        })),
      });
    });

    return {
      scope: AdminMetricSnapshotScope.billing_referrals,
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      metrics,
      count: metrics.length,
    };
  }

  async listSnapshots(input: {
    metricKey?: string;
    periodStart?: string;
    periodEnd?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(input.limit || 250, 1), 1000);
    const periodStart = input.periodStart
      ? this.parseDate(input.periodStart, "periodStart")
      : undefined;
    const periodEnd = input.periodEnd
      ? this.parseDate(input.periodEnd, "periodEnd")
      : undefined;

    const snapshots = await prisma.adminMetricSnapshot.findMany({
      where: {
        scope: AdminMetricSnapshotScope.billing_referrals,
        metricKey: input.metricKey || undefined,
        periodStart: periodStart ? { gte: periodStart } : undefined,
        periodEnd: periodEnd ? { lte: periodEnd } : undefined,
      },
      orderBy: [{ periodStart: "asc" }, { metricKey: "asc" }, { createdAt: "asc" }],
      take,
    });

    return {
      scope: AdminMetricSnapshotScope.billing_referrals,
      snapshots,
      count: snapshots.length,
      metricKeys: MONTHLY_METRIC_KEYS,
    };
  }

  private async computeMonthlyMetrics(period: { start: Date; end: Date }) {
    const [aggregateMetrics, planMetrics] = await Promise.all([
      this.computeAggregateMetrics(period),
      this.computePlanMetrics(period),
    ]);

    return [...aggregateMetrics, ...planMetrics];
  }

  private async computeAggregateMetrics(period: { start: Date; end: Date }) {
    const [
      totalUsers,
      newUsers,
      activatedUsers,
      paidSubscriptions,
      newPaidUsers,
      churnedUsers,
      failedPaymentUsers,
      referralSignups,
      referralPaidConversions,
      activeUsageUsers,
      createdCampaigns,
      activeCampaigns,
      createdActionCycles,
      completedActionCycles,
      suggestedActions,
      completedActions,
      respondedActions,
      convertedActions,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { lt: period.end } } }),
      prisma.user.count({
        where: { createdAt: { gte: period.start, lt: period.end } },
      }),
      prisma.userLifecycleSnapshot.count({
        where: { activatedAt: { gte: period.start, lt: period.end } },
      }),
      prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.active,
          startedAt: { lt: period.end },
          plan: { monthlyPriceCents: { gt: 0 } },
        },
        include: { plan: true },
      }),
      prisma.subscription.findMany({
        where: {
          startedAt: { gte: period.start, lt: period.end },
          plan: { monthlyPriceCents: { gt: 0 } },
          status: {
            in: [
              SubscriptionStatus.active,
              SubscriptionStatus.trialing,
              SubscriptionStatus.past_due,
            ],
          },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.subscription.findMany({
        where: {
          OR: [
            { endedAt: { gte: period.start, lt: period.end } },
            {
              status: {
                in: [
                  SubscriptionStatus.canceled,
                  SubscriptionStatus.expired,
                  SubscriptionStatus.unpaid,
                ],
              },
              updatedAt: { gte: period.start, lt: period.end },
            },
          ],
          plan: { monthlyPriceCents: { gt: 0 } },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.subscription.findMany({
        where: {
          status: {
            in: [SubscriptionStatus.past_due, SubscriptionStatus.unpaid],
          },
          startedAt: { lt: period.end },
          plan: { monthlyPriceCents: { gt: 0 } },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.referralMilestone.count({
        where: {
          milestoneType: ReferralMilestoneType.signup,
          occurredAt: { gte: period.start, lt: period.end },
        },
      }),
      prisma.referralMilestone.count({
        where: {
          milestoneType: ReferralMilestoneType.paid_conversion,
          occurredAt: { gte: period.start, lt: period.end },
        },
      }),
      this.countActiveUsageUsers(period),
      prisma.campaign.count({
        where: { createdAt: { gte: period.start, lt: period.end } },
      }),
      prisma.campaign.count({
        where: {
          status: CampaignStatus.ACTIVE,
          createdAt: { lt: period.end },
        },
      }),
      prisma.actionCycle.count({
        where: { createdAt: { gte: period.start, lt: period.end } },
      }),
      prisma.actionCycle.count({
        where: {
          status: {
            in: [
              ActionCycleStatus.completed,
              ActionCycleStatus.executed,
              ActionCycleStatus.confirmed,
            ],
          },
          OR: [
            { confirmedAt: { gte: period.start, lt: period.end } },
            { executedAt: { gte: period.start, lt: period.end } },
            { updatedAt: { gte: period.start, lt: period.end } },
          ],
        },
      }),
      prisma.actionItem.count({
        where: { createdAt: { gte: period.start, lt: period.end } },
      }),
      prisma.actionItem.count({
        where: {
          status: { in: COMPLETED_ACTION_STATUSES },
          completedAt: { gte: period.start, lt: period.end },
        },
      }),
      prisma.actionItem.count({
        where: {
          status: ActionItemStatus.responded,
          respondedAt: { gte: period.start, lt: period.end },
        },
      }),
      prisma.actionItem.count({
        where: {
          status: ActionItemStatus.converted,
          completedAt: { gte: period.start, lt: period.end },
        },
      }),
    ]);

    const mrrCents = paidSubscriptions.reduce(
      (sum, subscription) => sum + this.monthlySubscriptionCents(subscription),
      0,
    );

    return [
      this.metric("users.total", totalUsers, "count"),
      this.metric("users.new", newUsers, "count"),
      this.metric("users.activated", activatedUsers, "count"),
      this.metric("billing.paid_users", this.distinctCount(paidSubscriptions), "count"),
      this.metric("billing.new_paid_users", newPaidUsers.length, "count"),
      this.metric("billing.churned_users", churnedUsers.length, "count"),
      this.metric("billing.mrr_cents", mrrCents, "cents"),
      this.metric("billing.arr_cents", mrrCents * 12, "cents"),
      this.metric("billing.failed_payment_users", failedPaymentUsers.length, "count"),
      this.metric("referrals.signups", referralSignups, "count"),
      this.metric("referrals.paid_conversions", referralPaidConversions, "count"),
      this.metric("usage.active_users", activeUsageUsers, "count"),
      this.metric("campaigns.created", createdCampaigns, "count"),
      this.metric("campaigns.active", activeCampaigns, "count"),
      this.metric("action_cycles.created", createdActionCycles, "count"),
      this.metric("action_cycles.completed", completedActionCycles, "count"),
      this.metric("actions.suggested", suggestedActions, "count"),
      this.metric("actions.completed", completedActions, "count"),
      this.metric("actions.responded", respondedActions, "count"),
      this.metric("actions.converted", convertedActions, "count"),
    ];
  }

  private async countActiveUsageUsers(period: { start: Date; end: Date }) {
    const [campaignUsers, actionUsers, activatedUsers, paidUsers] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          userId: { not: null },
          createdAt: { gte: period.start, lt: period.end },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.actionItem.findMany({
        where: {
          OR: [
            { createdAt: { gte: period.start, lt: period.end } },
            { completedAt: { gte: period.start, lt: period.end } },
            { respondedAt: { gte: period.start, lt: period.end } },
          ],
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.userLifecycleSnapshot.findMany({
        where: {
          activatedAt: { gte: period.start, lt: period.end },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.subscription.findMany({
        where: {
          startedAt: { gte: period.start, lt: period.end },
          plan: { monthlyPriceCents: { gt: 0 } },
        },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ]);

    return new Set(
      [...campaignUsers, ...actionUsers, ...activatedUsers, ...paidUsers]
        .map((record) => record.userId)
        .filter(Boolean),
    ).size;
  }

  private async computePlanMetrics(period: { start: Date; end: Date }) {
    const [plans, activePaidSubscriptions] = await Promise.all([
      prisma.plan.findMany({ where: { monthlyPriceCents: { gt: 0 } } }),
      prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.active,
          startedAt: { lt: period.end },
          plan: { monthlyPriceCents: { gt: 0 } },
        },
        include: { plan: true },
      }),
    ]);

    const metrics: MetricRow[] = [];

    for (const plan of plans) {
      const subscriptionsForPlan = activePaidSubscriptions.filter(
        (subscription) => subscription.planId === plan.id,
      );
      const planMrr = subscriptionsForPlan.reduce(
        (sum, subscription) => sum + this.monthlySubscriptionCents(subscription),
        0,
      );
      const dimensionsJson = { planCode: plan.code };

      metrics.push(
        this.metric(
          "billing.paid_users",
          this.distinctCount(subscriptionsForPlan),
          "count",
          dimensionsJson,
        ),
        this.metric("billing.mrr_cents", planMrr, "cents", dimensionsJson),
        this.metric("billing.arr_cents", planMrr * 12, "cents", dimensionsJson),
      );
    }

    return metrics;
  }

  private resolvePeriod(input: {
    month?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    if (input.month) {
      const match = /^(\d{4})-(\d{2})$/.exec(input.month);
      if (!match) {
        throw new BadRequestException("month must use YYYY-MM format");
      }

      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      if (monthIndex < 0 || monthIndex > 11) {
        throw new BadRequestException("month must use YYYY-MM format");
      }

      return {
        start: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0)),
      };
    }

    if (!input.periodStart || !input.periodEnd) {
      const now = new Date();
      return {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      };
    }

    const start = this.parseDate(input.periodStart, "periodStart");
    const end = this.parseDate(input.periodEnd, "periodEnd");
    if (start >= end) {
      throw new BadRequestException("periodStart must be before periodEnd");
    }

    return { start, end };
  }

  private parseDate(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date`);
    }
    return parsed;
  }

  private metric(
    key: MonthlyMetricKey,
    value: number,
    unit: string,
    dimensionsJson?: Prisma.InputJsonValue,
  ): MetricRow {
    return { key, value, unit, dimensionsJson };
  }

  private distinctCount(subscriptions: Array<{ userId: string }>) {
    return new Set(subscriptions.map((subscription) => subscription.userId)).size;
  }

  private monthlySubscriptionCents(subscription: {
    billingInterval: string | null;
    plan: { monthlyPriceCents: number; annualPriceCents: number };
  }) {
    if (subscription.billingInterval === "annual") {
      return Math.round(subscription.plan.annualPriceCents / 12);
    }
    return subscription.plan.monthlyPriceCents;
  }
}
