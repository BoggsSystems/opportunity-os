import { Injectable } from "@nestjs/common";
import {
  ActionItemStatus,
  AdminOperationalIssueStatus,
  ConnectorStatus,
  prisma,
  SubscriptionStatus,
  UserLifecycleStage,
} from "@opportunity-os/db";

const FUNNEL_STAGES: UserLifecycleStage[] = [
  UserLifecycleStage.account_created,
  UserLifecycleStage.onboarding_started,
  UserLifecycleStage.profile_grounded,
  UserLifecycleStage.campaign_generated,
  UserLifecycleStage.action_lanes_selected,
  UserLifecycleStage.connector_ready,
  UserLifecycleStage.first_action_primed,
  UserLifecycleStage.first_action_completed,
  UserLifecycleStage.activated,
  UserLifecycleStage.paid,
];

@Injectable()
export class AdminAnalyticsService {
  async getOverview() {
    const [
      totalUsers,
      activatedUsers,
      firstActionCompletedUsers,
      paidUsers,
      usersWithConnectedConnectors,
      openOperationalIssues,
      totalCampaigns,
      completedActions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userLifecycleSnapshot.count({
        where: { activatedAt: { not: null } },
      }),
      prisma.userLifecycleSnapshot.count({
        where: { firstActionCompletedAt: { not: null } },
      }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.active,
          plan: { code: { not: "free_explorer" } },
        },
      }),
      prisma.userConnector.findMany({
        where: { status: ConnectorStatus.connected },
        distinct: ["userId"],
        select: { userId: true },
      }),
      prisma.adminOperationalIssue.count({
        where: { status: AdminOperationalIssueStatus.open },
      }),
      prisma.campaign.count(),
      prisma.actionItem.count({
        where: {
          status: {
            in: [
              ActionItemStatus.sent_confirmed,
              ActionItemStatus.published_confirmed,
              ActionItemStatus.converted,
            ],
          },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        activated: activatedUsers,
        firstActionCompleted: firstActionCompletedUsers,
        paid: paidUsers,
      },
      activation: {
        activationRate: this.rate(activatedUsers, totalUsers),
        firstActionCompletionRate: this.rate(firstActionCompletedUsers, totalUsers),
      },
      connectors: {
        usersWithConnectedConnectors: usersWithConnectedConnectors.length,
        adoptionRate: this.rate(usersWithConnectedConnectors.length, totalUsers),
      },
      campaigns: {
        total: totalCampaigns,
        completedActions,
      },
      operations: {
        openIssues: openOperationalIssues,
      },
    };
  }

  async getFunnel() {
    const [currentStageGroups, furthestStageGroups, totalUsers] =
      await Promise.all([
        prisma.userLifecycleSnapshot.groupBy({
          by: ["currentStage"],
          _count: { _all: true },
        }),
        prisma.userLifecycleSnapshot.groupBy({
          by: ["furthestStage"],
          _count: { _all: true },
        }),
        prisma.user.count(),
      ]);

    const furthestCounts = new Map(
      furthestStageGroups.map((group) => [group.furthestStage, group._count._all]),
    );
    const currentCounts = new Map(
      currentStageGroups.map((group) => [group.currentStage, group._count._all]),
    );

    let previousReached = totalUsers;
    const stages = FUNNEL_STAGES.map((stage) => {
      const reached = this.countReachedStage(stage, furthestCounts);
      const droppedFromPrevious = Math.max(previousReached - reached, 0);
      const result = {
        stage,
        current: currentCounts.get(stage) || 0,
        reached,
        dropoffFromPrevious: droppedFromPrevious,
        conversionFromPrevious: this.rate(reached, previousReached),
      };
      previousReached = reached;
      return result;
    });

    return {
      totalUsers,
      stages,
      currentStageCounts: Object.fromEntries(currentCounts),
      furthestStageCounts: Object.fromEntries(furthestCounts),
    };
  }

  async listUsers(input: {
    query?: string;
    stage?: UserLifecycleStage;
    limit?: number;
    cursor?: string;
  }) {
    const take = Math.min(input.limit || 50, 100);
    const users = await prisma.user.findMany({
      where: {
        OR: input.query
          ? [
              { email: { contains: input.query, mode: "insensitive" } },
              { fullName: { contains: input.query, mode: "insensitive" } },
            ]
          : undefined,
        lifecycleSnapshot: input.stage
          ? { currentStage: input.stage }
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      take,
      skip: input.cursor ? 1 : 0,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      include: {
        lifecycleSnapshot: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
        userConnectors: {
          include: {
            capability: true,
            capabilityProvider: true,
          },
        },
        _count: {
          select: {
            campaigns: true,
            actionItems: true,
            referralAttributionsGiven: true,
            referralAttributionsReceived: true,
            adminOperationalIssues: true,
          },
        },
      },
    });

    return {
      users,
      nextCursor: users.length === take ? users[users.length - 1]?.id : null,
    };
  }

  async getUserState(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        lifecycleSnapshot: true,
        lifecycleEvents: {
          orderBy: { occurredAt: "desc" },
          take: 50,
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { plan: true },
        },
        billingCustomers: true,
        referralAttributionsGiven: {
          include: { referred: true, milestones: true, rewards: true },
        },
        referralAttributionsReceived: {
          include: { referrer: true, milestones: true, rewards: true },
        },
        offerings: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        campaigns: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            actionLanes: true,
            actionCycles: true,
            actionItems: true,
          },
        },
        userConnectors: {
          include: {
            capability: true,
            capabilityProvider: true,
            connectorSyncStates: true,
          },
        },
        adminOperationalIssues: {
          orderBy: { detectedAt: "desc" },
          take: 20,
        },
      },
    });

    return { user };
  }

  async getCampaignAnalytics() {
    const [
      campaignStatus,
      laneStatus,
      cycleStatus,
      actionStatus,
      totalCampaigns,
      totalActionItems,
    ] = await Promise.all([
      prisma.campaign.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.actionLane.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.actionCycle.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.actionItem.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.campaign.count(),
      prisma.actionItem.count(),
    ]);

    return {
      totals: {
        campaigns: totalCampaigns,
        actionItems: totalActionItems,
      },
      campaignStatus,
      laneStatus,
      cycleStatus,
      actionStatus,
    };
  }

  async getConnectorAnalytics() {
    const [statusCounts, providerStatusCounts, recentFailures] =
      await Promise.all([
        prisma.userConnector.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.userConnector.groupBy({
          by: ["capabilityProviderId", "status"],
          _count: { _all: true },
        }),
        prisma.userConnector.findMany({
          where: { status: { in: [ConnectorStatus.error, ConnectorStatus.expired] } },
          orderBy: { updatedAt: "desc" },
          take: 25,
          include: {
            user: { select: { id: true, email: true, fullName: true } },
            capability: true,
            capabilityProvider: true,
          },
        }),
      ]);

    const providers = await prisma.capabilityProvider.findMany({
      where: {
        id: { in: providerStatusCounts.map((row) => row.capabilityProviderId) },
      },
    });
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));

    return {
      statusCounts,
      providerStatusCounts: providerStatusCounts.map((row) => ({
        provider: providerById.get(row.capabilityProviderId) || null,
        status: row.status,
        count: row._count._all,
      })),
      recentFailures,
    };
  }

  async getBillingReferralAnalytics() {
    const [
      planDistribution,
      paidConversions,
      referralVisits,
      referralAttributions,
      referralMilestones,
      referralRewards,
    ] = await Promise.all([
      prisma.subscription.groupBy({
        by: ["planId", "status"],
        _count: { _all: true },
      }),
      prisma.referralMilestone.count({
        where: { milestoneType: "paid_conversion" },
      }),
      prisma.referralVisit.count(),
      prisma.referralAttribution.count(),
      prisma.referralMilestone.groupBy({
        by: ["milestoneType"],
        _count: { _all: true },
      }),
      prisma.referralReward.groupBy({
        by: ["rewardType", "status"],
        _count: { _all: true },
      }),
    ]);

    const plans = await prisma.plan.findMany({
      where: { id: { in: planDistribution.map((row) => row.planId) } },
    });
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    return {
      planDistribution: planDistribution.map((row) => ({
        plan: planById.get(row.planId) || null,
        status: row.status,
        count: row._count._all,
      })),
      referrals: {
        visits: referralVisits,
        attributions: referralAttributions,
        paidConversions,
        milestones: referralMilestones,
        rewards: referralRewards,
      },
    };
  }

  private countReachedStage(
    stage: UserLifecycleStage,
    counts: Map<UserLifecycleStage, number>,
  ): number {
    const rank = FUNNEL_STAGES.indexOf(stage);
    return FUNNEL_STAGES.slice(rank).reduce(
      (sum, candidate) => sum + (counts.get(candidate) || 0),
      0,
    );
  }

  private rate(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Number((numerator / denominator).toFixed(4));
  }
}
