import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import {
  FeatureAccessLevel,
  GrowthCreditStatus,
  Prisma,
  ReferralMilestoneType,
  RewardType,
  SubscriptionStatus,
  prisma,
} from "@opportunity-os/db";

const UpgradeReason = {
  plan_does_not_include_capability: "plan_does_not_include_capability",
  usage_limit_reached: "usage_limit_reached",
  connector_limit_reached: "connector_limit_reached",
  missing_required_connector: "missing_required_connector",
  trial_expired: "trial_expired",
  payment_required: "payment_required",
  feature_temporarily_disabled: "feature_temporarily_disabled",
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
  accessLevel: FeatureAccessLevel | "missing";
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
  bypassed?: boolean;
};

type ReferralVisitInput = {
  referralCode?: string;
  visitorId?: string;
  guestSessionId?: string;
  landingPath?: string;
  landingUrl?: string;
  referrerUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  country?: string;
  region?: string;
  city?: string;
  deviceType?: string;
  browser?: string;
  ipAddress?: string;
  userAgent?: string | string[];
  metadata?: unknown;
};

type ReferralSignupInput = {
  referralCode?: string;
  referralVisitId?: string;
  referralVisitorId?: string;
  guestSessionId?: string;
};

@Injectable()
export class CommercialService {
  private readonly freePlanCode = "free_explorer";

  async getAccountState(userId: string) {
    const [subscription, entitlements, usage, referral] = await Promise.all([
      this.getSubscription(userId),
      this.getEntitlements(userId),
      this.getUsage(userId),
      this.getOrCreateReferralLink(userId),
    ]);

    return {
      subscription,
      entitlements,
      usage,
      referral,
      billing: {
        provider: process.env["BILLING_PROVIDER"] || "local",
        checkoutConfigured: Boolean(process.env["BILLING_CHECKOUT_URL"]),
      },
      bypass: await this.getBypassState(userId),
    };
  }

  async listPlans() {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      include: { planFeatures: true },
      orderBy: { monthlyPriceCents: "asc" },
    });
    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthlyPriceCents: plan.monthlyPriceCents,
      annualPriceCents: plan.annualPriceCents,
      currency: plan.currency,
      features: plan.planFeatures.map((feature) => ({
        key: feature.featureKey,
        accessLevel: feature.accessLevel,
        config: feature.configJson,
        limit: this.extractLimit(feature.configJson),
      })),
    }));
  }

  async getSubscription(userId: string) {
    const subscription = await this.resolveActiveSubscription(userId);

    if (!subscription) {
      throw new NotFoundException("No active subscription found");
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

  async isPaidUser(userId: string): Promise<boolean> {
    if (!userId) return false;
    const sub = await this.resolveActiveSubscription(userId);
    return !!sub && sub.plan.code !== this.freePlanCode;
  }

  async getEntitlements(userId: string): Promise<any> {
    const subscription = await this.resolveActiveSubscription(userId);

    if (!subscription) {
      throw new NotFoundException("No active subscription found");
    }

    const entitlements = await Promise.all(
      subscription.plan.planFeatures.map(async (feature) => {
        const usage = await this.getCurrentUsage(userId, feature.featureKey);
        const credits = await this.getAvailableCredits(
          userId,
          feature.featureKey,
        );
        const limit = this.extractLimit(feature.configJson);

        return {
          key: feature.featureKey,
          accessLevel: feature.accessLevel,
          config: feature.configJson,
          usage: {
            used: usage,
            credited: credits,
            limit,
            remaining:
              limit === null ? null : Math.max(limit + credits - usage, 0),
          },
        };
      }),
    );

    return {
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      entitlements,
    };
  }

  async getUsage(userId: string) {
    const entitlements = await this.getEntitlements(userId).catch(() => null);
    const usageCounters = await prisma.usageCounter.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        updatedAt: "desc",
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
        grantedAt: "desc",
      },
    });

    return {
      planCode: entitlements?.planCode,
      planName: entitlements?.planName,
      usage:
        entitlements?.entitlements?.map((entitlement: any) => ({
          featureKey: entitlement.key,
          enabled: entitlement.accessLevel !== FeatureAccessLevel.disabled,
          limit: entitlement.usage.limit,
          used: entitlement.usage.used,
          remaining: entitlement.usage.remaining,
        })) ?? [],
      usageCounters: usageCounters.map((counter) => ({
        key: counter.featureKey,
        value: counter.usedCount,
        period: {
          start: counter.usagePeriodStart,
          end: counter.usagePeriodEnd,
        },
        updatedAt: counter.updatedAt,
      })),
      growthCredits: growthCredits.map((credit) => ({
        id: credit.id,
        key: credit.featureKey,
        featureKey: credit.featureKey,
        creditType: credit.creditType,
        granted: credit.quantityGranted,
        used: credit.quantityUsed,
        remaining: Math.max(credit.quantityGranted - credit.quantityUsed, 0),
        remainingQuantity: Math.max(
          credit.quantityGranted - credit.quantityUsed,
          0,
        ),
        expiresAt: credit.expiresAt,
      })),
    };
  }

  async checkCapability(
    userId: string,
    input: CapabilityCheckInput,
  ): Promise<CapabilityCheckResult> {
    const requestedQuantity = Math.max(input.quantity ?? 1, 1);
    if (await this.isBypassUser(userId)) {
      return {
        allowed: true,
        featureKey: input.featureKey,
        requestedQuantity,
        accessLevel: FeatureAccessLevel.enabled,
        plan: { code: "founder_bypass", name: "Founder / Dev Bypass" },
        limit: null,
        used: 0,
        credited: 0,
        remaining: null,
        bypassed: true,
      };
    }

    const subscription = await this.resolveActiveSubscription(userId);

    if (!subscription) {
      return this.blocked(
        input.featureKey,
        requestedQuantity,
        UpgradeReason.payment_required,
        "Choose a plan to continue.",
      );
    }

    const feature = subscription.plan.planFeatures.find(
      (planFeature) => planFeature.featureKey === input.featureKey,
    );

    if (!feature || feature.accessLevel === FeatureAccessLevel.disabled) {
      return this.blocked(
        input.featureKey,
        requestedQuantity,
        UpgradeReason.plan_does_not_include_capability,
        "Upgrade to a plan that includes this capability.",
        subscription,
        feature?.accessLevel ?? "missing",
      );
    }

    if (input.connectorCapability) {
      const connector = await prisma.userConnector.findFirst({
        where: {
          userId,
          capability: {
            capabilityType: input.connectorCapability as any,
          },
          status: "connected",
        },
      });

      if (!connector) {
        return this.blocked(
          input.featureKey,
          requestedQuantity,
          UpgradeReason.missing_required_connector,
          "Connect the required account to use this capability.",
          subscription,
          feature.accessLevel,
        );
      }
    }

    const limit = this.extractLimit(feature.configJson);
    const used = await this.getCurrentUsage(userId, input.featureKey);
    const credited = await this.getAvailableCredits(userId, input.featureKey);
    const remaining =
      limit === null ? null : Math.max(limit + credited - used, 0);

    if (
      feature.accessLevel === FeatureAccessLevel.limited &&
      remaining !== null &&
      remaining < requestedQuantity
    ) {
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
        upgradeHint:
          "Upgrade or earn credits to continue using this capability.",
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
    const check = await this.checkCapability(userId, {
      featureKey,
      quantity: requestedQuantity,
    });

    if (!check.allowed) {
      return check;
    }
    if (check.bypassed) {
      return check;
    }

    const previousUsed = check.used;
    const baseLimit = check.limit;
    const creditQuantityToConsume =
      baseLimit === null
        ? 0
        : Math.max(
            Math.min(
              previousUsed + requestedQuantity - baseLimit,
              requestedQuantity,
            ),
            0,
          );

    const { counter, creditsConsumed } = await prisma.$transaction(
      async (tx) => {
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

        const consumed =
          creditQuantityToConsume > 0
            ? await this.consumeGrowthCredits(
                tx,
                userId,
                featureKey,
                creditQuantityToConsume,
              )
            : 0;

        return {
          counter: updatedCounter,
          creditsConsumed: consumed,
        };
      },
    );

    const creditedRemaining = Math.max(check.credited - creditsConsumed, 0);

    return {
      ...check,
      used: counter.usedCount,
      credited: creditedRemaining,
      creditsConsumed,
      remaining:
        check.limit === null
          ? null
          : Math.max(check.limit + creditedRemaining - counter.usedCount, 0),
    };
  }

  async createCheckoutSession(
    userId: string,
    planCode: string,
    interval: "monthly" | "annual" = "monthly",
  ) {
    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException("Plan not found");
    }
    if (plan.code === this.freePlanCode) {
      throw new BadRequestException("Free plan does not require checkout");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const configuredUrl = process.env["BILLING_CHECKOUT_URL"];
    const successUrl =
      process.env["BILLING_SUCCESS_URL"] ||
      "http://localhost:5173/?billing=success";
    const cancelUrl =
      process.env["BILLING_CANCEL_URL"] ||
      "http://localhost:5173/?billing=cancelled";
    const checkoutUrl = configuredUrl
      ? this.withQuery(configuredUrl, {
          plan: plan.code,
          interval,
          email: user?.email ?? "",
          success_url: successUrl,
          cancel_url: cancelUrl,
        })
      : this.withQuery("http://localhost:5173/billing/local-checkout", {
          plan: plan.code,
          interval,
        });

    return {
      provider: process.env["BILLING_PROVIDER"] || "local",
      plan: {
        code: plan.code,
        name: plan.name,
        monthlyPriceCents: plan.monthlyPriceCents,
        annualPriceCents: plan.annualPriceCents,
      },
      interval,
      checkoutUrl,
      mode: configuredUrl ? "provider_redirect" : "local_pending",
    };
  }

  async activatePlanForDev(userId: string, planCode: string) {
    if (!(await this.isBypassUser(userId))) {
      throw new BadRequestException(
        "Dev plan activation is only available to founder/dev bypass users.",
      );
    }
    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    const { start, end } = this.currentMonthlyWindow();
    await prisma.subscription.updateMany({
      where: { userId, status: SubscriptionStatus.active },
      data: { status: SubscriptionStatus.canceled },
    });
    return prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.active,
        provider: "dev_bypass",
        billingInterval: "monthly",
        startedAt: new Date(),
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
      include: { plan: true },
    });
  }

  async recordReferralVisit(input: ReferralVisitInput) {
    const referralCode = input.referralCode?.trim();
    const referralLink = referralCode
      ? await prisma.referralLink.findFirst({
          where: { code: referralCode, isActive: true },
        })
      : null;

    const userAgent = Array.isArray(input.userAgent)
      ? input.userAgent.join(" ")
      : input.userAgent;
    const visit = await prisma.referralVisit.create({
      data: {
        referralLinkId: referralLink?.id,
        referrerUserId: referralLink?.userId,
        referralCode,
        visitorId: input.visitorId?.trim() || undefined,
        guestSessionId: input.guestSessionId?.trim() || undefined,
        landingPath: input.landingPath,
        landingUrl: input.landingUrl,
        referrerUrl: input.referrerUrl,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
        utmTerm: input.utmTerm,
        ipHash: this.hashSensitiveValue(input.ipAddress),
        userAgentHash: this.hashSensitiveValue(userAgent),
        country: input.country,
        region: input.region,
        city: input.city,
        deviceType: input.deviceType,
        browser: input.browser,
        metadataJson: this.toJson(input.metadata),
      },
    });

    return {
      id: visit.id,
      referralCode: visit.referralCode,
      referralLinkId: visit.referralLinkId,
      referrerUserId: visit.referrerUserId,
      tracked: true,
      validReferralCode: Boolean(referralLink),
    };
  }

  async applyReferralAtSignup(
    referredUserId: string,
    input: ReferralSignupInput,
  ) {
    const visit = await this.findReferralVisitForSignup(input);
    const referralCode =
      input.referralCode?.trim() || visit?.referralCode || undefined;
    const referralLink = referralCode
      ? await prisma.referralLink.findFirst({
          where: { code: referralCode, isActive: true },
        })
      : visit?.referralLinkId
        ? await prisma.referralLink.findUnique({
            where: { id: visit.referralLinkId },
          })
        : null;

    if (!referralLink) {
      return { applied: false, reason: "no_valid_referral" };
    }
    if (referralLink.userId === referredUserId) {
      return { applied: false, reason: "self_referral_blocked" };
    }

    const attribution = await prisma.referralAttribution.upsert({
      where: { referredUserId },
      create: {
        referralLinkId: referralLink.id,
        referrerUserId: referralLink.userId,
        referredUserId,
        attributionSource: visit ? "referral_visit" : "referral_code",
      },
      update: {
        referralLinkId: referralLink.id,
        referrerUserId: referralLink.userId,
        attributionSource: visit ? "referral_visit" : "referral_code",
      },
    });

    await this.attachReferralVisitsToAttribution(
      attribution.id,
      referredUserId,
      referralLink.id,
      input,
      visit?.id,
    );
    const milestone = await this.recordReferralMilestone(
      referredUserId,
      ReferralMilestoneType.signup,
      {
        entityType: "referral_attribution",
        entityId: attribution.id,
      },
    );

    return {
      applied: true,
      attributionId: attribution.id,
      referralLinkId: referralLink.id,
      referrerUserId: referralLink.userId,
      milestone,
    };
  }

  async getOrCreateReferralLink(userId: string) {
    let link = await prisma.referralLink.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!link) {
      link = await prisma.referralLink.create({
        data: {
          userId,
          code: await this.uniqueReferralCode(userId),
          label: "Default referral link",
          campaignSource: "product",
        },
      });
    }
    return {
      id: link.id,
      code: link.code,
      label: link.label,
      url: this.referralUrl(link.code),
      campaignSource: link.campaignSource,
    };
  }

  async applyReferralCode(referredUserId: string, code: string) {
    const link = await prisma.referralLink.findFirst({
      where: { code, isActive: true },
    });
    if (!link) {
      throw new NotFoundException("Referral link not found");
    }
    if (link.userId === referredUserId) {
      throw new BadRequestException("Users cannot refer themselves");
    }
    const attribution = await prisma.referralAttribution.upsert({
      where: { referredUserId },
      create: {
        referralLinkId: link.id,
        referrerUserId: link.userId,
        referredUserId,
        attributionSource: "referral_code",
      },
      update: {
        referralLinkId: link.id,
        referrerUserId: link.userId,
        attributionSource: "referral_code",
      },
    });
    await this.recordReferralMilestone(
      referredUserId,
      ReferralMilestoneType.signup,
    );
    return attribution;
  }

  async recordReferralMilestone(
    referredUserId: string,
    milestoneType: ReferralMilestoneType,
    source?: { entityType?: string; entityId?: string },
  ) {
    const attribution = await prisma.referralAttribution.findUnique({
      where: { referredUserId },
      include: { milestones: true },
    });
    if (!attribution) {
      return { recorded: false, reason: "no_referral_attribution" };
    }
    const milestone = await prisma.referralMilestone.upsert({
      where: {
        referralAttributionId_milestoneType: {
          referralAttributionId: attribution.id,
          milestoneType,
        },
      },
      create: {
        referralAttributionId: attribution.id,
        milestoneType,
        sourceEntityType: source?.entityType,
        sourceEntityId: source?.entityId,
      },
      update: {},
    });

    const rewards = await this.grantReferralRewards(
      attribution.id,
      milestone.id,
      attribution.referrerUserId,
      attribution.referredUserId,
      milestoneType,
    );
    return { recorded: true, milestone, rewards };
  }

  async getBypassState(userId: string) {
    return {
      enabled: await this.isBypassUser(userId),
      source: (await this.isBypassUser(userId)) ? "env_or_user_metadata" : null,
    };
  }

  private async resolveActiveSubscription(userId: string) {
    let subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
      include: {
        plan: {
          include: {
            planFeatures: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
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
          status: "active",
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
    if (
      !configJson ||
      typeof configJson !== "object" ||
      !("limit" in configJson)
    ) {
      return null;
    }

    const limit = Number((configJson as { limit?: unknown }).limit);
    return Number.isFinite(limit) ? limit : null;
  }

  private async getCurrentUsage(
    userId: string,
    featureKey: string,
  ): Promise<number> {
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

  private async getAvailableCredits(
    userId: string,
    featureKey: string,
  ): Promise<number> {
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

    return credits.reduce(
      (sum, credit) =>
        sum + Math.max(credit.quantityGranted - credit.quantityUsed, 0),
      0,
    );
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
        grantedAt: "asc",
      },
    });

    for (const credit of credits) {
      if (remainingToConsume <= 0) {
        break;
      }

      const available = Math.max(
        credit.quantityGranted - credit.quantityUsed,
        0,
      );
      const toConsume = Math.min(available, remainingToConsume);

      if (toConsume <= 0) {
        continue;
      }

      const nextUsed = credit.quantityUsed + toConsume;
      const nextStatus =
        nextUsed >= credit.quantityGranted
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
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    return { start, end };
  }

  private async grantReferralRewards(
    referralAttributionId: string,
    referralMilestoneId: string,
    referrerUserId: string,
    referredUserId: string,
    milestoneType: ReferralMilestoneType,
  ) {
    const rewardConfig = this.rewardForMilestone(milestoneType);
    if (!rewardConfig) return [];

    const rewards = [];
    for (const userId of [referrerUserId, referredUserId]) {
      const existing = await prisma.referralReward.findFirst({
        where: {
          referralAttributionId,
          referralMilestoneId,
          userId,
          featureKey: rewardConfig.featureKey,
        },
      });
      if (existing) {
        rewards.push(existing);
        continue;
      }

      const reward = await prisma.referralReward.create({
        data: {
          referralAttributionId,
          referralMilestoneId,
          userId,
          rewardType: rewardConfig.rewardType,
          featureKey: rewardConfig.featureKey,
          quantity: rewardConfig.quantity,
          expiresAt: rewardConfig.expiresAt,
          metadataJson: this.toJson({ milestoneType }),
        },
      });
      await prisma.growthCredit.create({
        data: {
          userId,
          referralRewardId: reward.id,
          featureKey: rewardConfig.featureKey,
          creditType: rewardConfig.rewardType,
          quantityGranted: rewardConfig.quantity,
          expiresAt: rewardConfig.expiresAt,
          metadataJson: this.toJson({
            referralAttributionId,
            referralMilestoneId,
            milestoneType,
          }),
        },
      });
      rewards.push(reward);
    }
    return rewards;
  }

  private async findReferralVisitForSignup(input: ReferralSignupInput) {
    if (input.referralVisitId) {
      const visit = await prisma.referralVisit.findUnique({
        where: { id: input.referralVisitId },
      });
      if (visit) return visit;
    }

    const OR = [
      input.referralVisitorId ? { visitorId: input.referralVisitorId } : null,
      input.guestSessionId ? { guestSessionId: input.guestSessionId } : null,
      input.referralCode ? { referralCode: input.referralCode } : null,
    ].filter(Boolean) as Array<{
      visitorId?: string;
      guestSessionId?: string;
      referralCode?: string;
    }>;

    if (!OR.length) return null;

    return prisma.referralVisit.findFirst({
      where: {
        OR,
        convertedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async attachReferralVisitsToAttribution(
    referralAttributionId: string,
    referredUserId: string,
    referralLinkId: string,
    input: ReferralSignupInput,
    primaryVisitId?: string,
  ) {
    const OR = [
      primaryVisitId ? { id: primaryVisitId } : null,
      input.referralVisitorId ? { visitorId: input.referralVisitorId } : null,
      input.guestSessionId ? { guestSessionId: input.guestSessionId } : null,
      input.referralCode ? { referralCode: input.referralCode } : null,
    ].filter(Boolean) as Array<{
      id?: string;
      visitorId?: string;
      guestSessionId?: string;
      referralCode?: string;
    }>;

    if (!OR.length) return;

    await prisma.referralVisit.updateMany({
      where: {
        OR,
        referredUserId: null,
      },
      data: {
        referralAttributionId,
        referralLinkId,
        referredUserId,
        convertedAt: new Date(),
      },
    });
  }

  private rewardForMilestone(milestoneType: ReferralMilestoneType) {
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    
    // STRICT POLICY: No rewards for free activity (signup/onboarding/outreach).
    // Rewards are only granted when a user converts to a paid plan.
    if (milestoneType === ReferralMilestoneType.paid_conversion) {
      return {
        rewardType: RewardType.ai_usage_credit,
        featureKey: "ai_requests",
        quantity: 100, // High-value reward for real revenue
        expiresAt,
      };
    }

    return null;
  }

  private async uniqueReferralCode(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const prefix =
      (user?.email?.split("@")[0] ?? "user")
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 10)
        .toLowerCase() || "user";
    for (let index = 0; index < 5; index += 1) {
      const code = `${prefix}${Math.random().toString(36).slice(2, 8)}`;
      const existing = await prisma.referralLink.findUnique({
        where: { code },
      });
      if (!existing) return code;
    }
    return `${prefix}${Date.now().toString(36)}`;
  }

  private referralUrl(code: string) {
    const base = process.env["WEB_APP_URL"] || "http://localhost:5173";
    return this.withQuery(base, { ref: code });
  }

  private withQuery(url: string, params: Record<string, string>) {
    const next = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (value) next.searchParams.set(key, value);
    }
    return next.toString();
  }

  private async isBypassUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });
    if (!user) return false;
    const ids = (
      process.env["FOUNDER_USER_IDS"] ||
      process.env["DEV_BYPASS_USER_IDS"] ||
      ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const emails = (
      process.env["FOUNDER_EMAILS"] ||
      process.env["DEV_BYPASS_EMAILS"] ||
      ""
    )
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (ids.includes(userId)) return true;
    if (user.email && emails.includes(user.email.toLowerCase())) return true;
    return (
      process.env["DEV_BYPASS_ALL_USERS"] === "true" &&
      process.env["NODE_ENV"] !== "production"
    );
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private hashSensitiveValue(value?: string) {
    if (!value) return undefined;
    return createHash("sha256")
      .update(
        `${process.env["REFERRAL_ANALYTICS_SALT"] || "development-referral-salt"}:${value}`,
      )
      .digest("hex");
  }

  private blocked(
    featureKey: string,
    requestedQuantity: number,
    upgradeReason: UpgradeReason,
    upgradeHint: string,
    subscription: Awaited<
      ReturnType<CommercialService["resolveActiveSubscription"]>
    > = null,
    accessLevel: FeatureAccessLevel | "missing" = "missing",
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
