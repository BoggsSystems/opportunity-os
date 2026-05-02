import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import {
  BillingEventStatus,
  AdminOperationalIssueSeverity,
  AdminOperationalIssueSource,
  Prisma,
  ReferralMilestoneType,
  SubscriptionStatus,
  UserLifecycleStage,
  prisma,
} from "@opportunity-os/db";
import { AdminLifecycleService } from "../admin/admin-lifecycle.service";
import { AdminOperationsService } from "../admin/admin-operations.service";
import { CommercialService } from "../commercial/commercial.service";

type CheckoutInput = {
  planCode: string;
  interval?: "monthly" | "annual";
  successUrl?: string;
  cancelUrl?: string;
};

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

type StripeSubscriptionPayload = {
  id?: string;
  customer?: string | Record<string, unknown>;
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  trial_end?: number | null;
  ended_at?: number | null;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
};

import { SystemDateService } from "../../common/system-date.service";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripeApiBase = "https://api.stripe.com/v1";
  private readonly defaultSuccessUrl =
    process.env["BILLING_SUCCESS_URL"] ||
    "http://localhost:5173/?billing=success";
  private readonly defaultCancelUrl =
    process.env["BILLING_CANCEL_URL"] ||
    "http://localhost:5173/?billing=cancelled";
  private readonly defaultPortalReturnUrl =
    process.env["BILLING_PORTAL_RETURN_URL"] ||
    "http://localhost:5173/?billing=portal";

  constructor(
    private readonly commercialService: CommercialService,
    private readonly adminLifecycleService: AdminLifecycleService,
    private readonly adminOperationsService: AdminOperationsService,
    private readonly systemDateService: SystemDateService,
  ) {}

  async getBillingState(userId: string) {
    const [commercialState, billingCustomer, subscription, plans, overrides] =
      await Promise.all([
        this.commercialService.getAccountState(userId),
        prisma.billingCustomer.findFirst({
          where: { userId, provider: "stripe", status: "active" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.subscription.findFirst({
          where: {
            userId,
            status: {
              in: [
                SubscriptionStatus.incomplete,
                SubscriptionStatus.trialing,
                SubscriptionStatus.active,
                SubscriptionStatus.past_due,
                SubscriptionStatus.unpaid,
              ],
            },
          },
          include: { plan: true, billingCustomer: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.plan.findMany({
          where: { isActive: true },
          include: { planFeatures: true },
          orderBy: { monthlyPriceCents: "asc" },
        }),
        prisma.entitlementOverride.findMany({
          where: {
            userId,
            status: "active",
            OR: [{ expiresAt: null }, { expiresAt: { gt: this.systemDateService.now() } }],
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    return {
      provider: "stripe",
      configured: this.isStripeConfigured(),
      billingCustomer: billingCustomer
        ? {
            id: billingCustomer.id,
            providerCustomerId: billingCustomer.providerCustomerId,
            email: billingCustomer.email,
            status: billingCustomer.status,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            providerSubscriptionId: subscription.providerSubscriptionId,
            providerPriceId: subscription.providerPriceId,
            status: subscription.status,
            billingInterval: subscription.billingInterval,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            trialEndsAt: subscription.trialEndsAt,
            endedAt: subscription.endedAt,
            plan: {
              code: subscription.plan.code,
              name: subscription.plan.name,
              monthlyPriceCents: subscription.plan.monthlyPriceCents,
              annualPriceCents: subscription.plan.annualPriceCents,
              currency: subscription.plan.currency,
            },
          }
        : commercialState.subscription,
      entitlements: commercialState.entitlements,
      usage: commercialState.usage,
      overrides: overrides.map((override) => ({
        id: override.id,
        featureKey: override.featureKey,
        accessLevel: override.accessLevel,
        config: override.configJson,
        reason: override.reason,
        expiresAt: override.expiresAt,
      })),
      plans: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        annualPriceCents: plan.annualPriceCents,
        currency: plan.currency,
        stripeConfigured: Boolean(
          plan.stripeMonthlyPriceId || plan.stripeAnnualPriceId,
        ),
        features: plan.planFeatures.map((feature) => ({
          key: feature.featureKey,
          accessLevel: feature.accessLevel,
          config: feature.configJson,
        })),
      })),
    };
  }

  async createCheckoutSession(userId: string, input: CheckoutInput) {
    const interval = input.interval ?? "monthly";
    const plan = await prisma.plan.findUnique({
      where: { code: input.planCode },
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundException("Plan not found");
    }
    if (plan.monthlyPriceCents <= 0 && plan.annualPriceCents <= 0) {
      throw new BadRequestException("Free plan does not require checkout.");
    }

    const priceId =
      interval === "annual"
        ? plan.stripeAnnualPriceId
        : plan.stripeMonthlyPriceId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const billingCustomer = await this.getOrCreateBillingCustomer(
      userId,
      user.email,
    );
    if (!this.isStripeConfigured() || !priceId) {
      return {
        provider: "stripe",
        mode: "local_pending",
        configured: this.isStripeConfigured(),
        reason: !priceId
          ? "missing_stripe_price_id"
          : "missing_stripe_secret_key",
        checkoutUrl: this.withQuery(
          process.env["BILLING_LOCAL_CHECKOUT_URL"] ||
            "http://localhost:5173/billing/local-checkout",
          {
            plan: plan.code,
            interval,
            email: user.email,
          },
        ),
        plan: this.planSummary(plan),
        billingCustomer: this.billingCustomerSummary(billingCustomer),
      };
    }

    const session = await this.stripeRequest<Record<string, unknown>>(
      "checkout/sessions",
      {
        mode: "subscription",
        customer: billingCustomer.providerCustomerId,
        client_reference_id: userId,
        success_url: input.successUrl || this.defaultSuccessUrl,
        cancel_url: input.cancelUrl || this.defaultCancelUrl,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "metadata[userId]": userId,
        "metadata[planCode]": plan.code,
        "metadata[interval]": interval,
        "subscription_data[metadata][userId]": userId,
        "subscription_data[metadata][planCode]": plan.code,
        "subscription_data[metadata][interval]": interval,
      },
    );

    return {
      provider: "stripe",
      mode: "provider_redirect",
      checkoutSessionId: session["id"],
      checkoutUrl: session["url"],
      plan: this.planSummary(plan),
      billingCustomer: this.billingCustomerSummary(billingCustomer),
    };
  }

  async createPortalSession(userId: string, returnUrl?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const billingCustomer = await this.getOrCreateBillingCustomer(
      userId,
      user.email,
    );
    if (!this.isStripeConfigured()) {
      return {
        provider: "stripe",
        mode: "local_pending",
        configured: false,
        reason: "missing_stripe_secret_key",
        portalUrl: this.withQuery(
          process.env["BILLING_LOCAL_PORTAL_URL"] ||
            "http://localhost:5173/billing/local-portal",
          {
            customer: billingCustomer.providerCustomerId,
          },
        ),
        billingCustomer: this.billingCustomerSummary(billingCustomer),
      };
    }

    const session = await this.stripeRequest<Record<string, unknown>>(
      "billing_portal/sessions",
      {
        customer: billingCustomer.providerCustomerId,
        return_url: returnUrl || this.defaultPortalReturnUrl,
      },
    );

    return {
      provider: "stripe",
      mode: "provider_redirect",
      portalSessionId: session["id"],
      portalUrl: session["url"],
      billingCustomer: this.billingCustomerSummary(billingCustomer),
    };
  }

  async handleStripeWebhook(input: {
    signature?: string;
    rawBody?: Buffer;
    body: unknown;
    isSimulated?: boolean;
  }) {
    const event = this.parseAndVerifyWebhook(input);
    const billingEvent = await prisma.billingEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: "stripe",
          providerEventId: event.id,
        },
      },
      create: {
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
        status: BillingEventStatus.received,
        payloadJson: this.toJson(event),
      },
      update: {},
    });

    if (billingEvent.status === BillingEventStatus.processed) {
      return { received: true, duplicate: true, eventId: event.id };
    }

    try {
      const result = await this.processStripeEvent(event);
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          userId: result.userId,
          status: BillingEventStatus.processed,
          processedAt: this.systemDateService.now(),
          errorMessage: null,
        },
      });
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        ...result,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Webhook processing failed";
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          status: BillingEventStatus.failed,
          errorMessage: message,
        },
      });
      await this.adminOperationsService.createIssue({
        source: AdminOperationalIssueSource.webhook,
        sourceId: billingEvent.id,
        providerName: "stripe",
        severity: AdminOperationalIssueSeverity.error,
        title: `Stripe webhook failed: ${event.type}`,
        details: message,
        metadata: {
          providerEventId: event.id,
          eventType: event.type,
        },
      });
      throw error;
    }
  }

  async recordUsage(input: {
    userId: string;
    featureKey: string;
    metricCode?: string;
    quantity?: number;
    idempotencyKey?: string;
    sourceType?: string;
    sourceId?: string;
    metadata?: unknown;
  }) {
    const quantity = Math.max(input.quantity ?? 1, 1);
    const { start, end } = this.currentMonthlyWindow();
    if (input.idempotencyKey) {
      const existing = await prisma.usageRecord.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    const record = await prisma.$transaction(async (tx) => {
      const usageRecord = await tx.usageRecord.create({
        data: {
          userId: input.userId,
          featureKey: input.featureKey,
          metricCode: input.metricCode || input.featureKey,
          quantity,
          idempotencyKey: input.idempotencyKey,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          windowStart: start,
          windowEnd: end,
          metadataJson: this.toJson(input.metadata),
        },
      });

      await tx.usageCounter.upsert({
        where: {
          userId_featureKey_usagePeriodStart_usagePeriodEnd: {
            userId: input.userId,
            featureKey: input.featureKey,
            usagePeriodStart: start,
            usagePeriodEnd: end,
          },
        },
        create: {
          userId: input.userId,
          featureKey: input.featureKey,
          usagePeriodStart: start,
          usagePeriodEnd: end,
          usedCount: quantity,
        },
        update: {
          usedCount: {
            increment: quantity,
          },
        },
      });

      return usageRecord;
    });

    return record;
  }

  /**
   * Applies a financial credit (discount/balance top-up) to a user's billing account.
   */
  async applyFinancialCredit(userId: string, amountCents: number, description: string) {
    const customer = await prisma.billingCustomer.findFirst({
      where: { userId, provider: "stripe", status: "active" },
    });

    if (!customer) {
      this.logger.warn(`Cannot apply financial credit to user ${userId}: No active billing customer found.`);
      return;
    }

    // In a real scenario, we'd call Stripe:
    // https://stripe.com/docs/api/customer_balance_transactions/create
    if (this.isStripeConfigured()) {
      try {
        await this.stripeRequest(`customers/${customer.providerCustomerId}/balance_transactions`, {
          amount: -amountCents, // Negative means credit to the customer
          currency: "usd",
          description,
        });
      } catch (err: any) {
        this.logger.error(`Failed to apply Stripe balance credit for user ${userId}: ${err.message}`);
      }
    }

    // Record the event locally
    await prisma.billingEvent.create({
      data: {
        userId,
        provider: "stripe",
        providerEventId: `local_credit_${Date.now()}`,
        eventType: "customer.balance_adjustment",
        status: BillingEventStatus.processed,
        processedAt: this.systemDateService.now(),
        payloadJson: this.toJson({ amountCents, description }),
      },
    });

    this.logger.log(`Applied $${(amountCents / 100).toFixed(2)} credit to user ${userId}: ${description}`);
  }

  private async processStripeEvent(
    event: StripeEvent,
  ): Promise<{ ignored?: boolean; userId?: string; subscriptionId?: string }> {
    const object = event.data?.object ?? {};
    if (event.type === "checkout.session.completed") {
      return this.processCheckoutCompleted(object);
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      return this.syncSubscription(object as StripeSubscriptionPayload);
    }
    if (event.type === "customer.subscription.deleted") {
      return this.syncSubscription({
        ...(object as StripeSubscriptionPayload),
        status: "canceled",
      });
    }
    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      return this.processInvoiceEvent(object, event.type);
    }
    return { ignored: true };
  }

  private async processCheckoutCompleted(object: Record<string, unknown>) {
    const userId =
      this.stringFrom(object["client_reference_id"]) ||
      this.metadataValue(object, "userId");
    const customerId = this.stringFrom(object["customer"]);
    const subscriptionId = this.stringFrom(object["subscription"]);
    const customerEmail = this.stringFrom(object["customer_email"]);
    if (!userId || !customerId) {
      return { ignored: true };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      return { ignored: true };
    }

    await prisma.billingCustomer.upsert({
      where: {
        provider_providerCustomerId: {
          provider: "stripe",
          providerCustomerId: customerId,
        },
      },
      create: {
        userId,
        provider: "stripe",
        providerCustomerId: customerId,
        email: customerEmail || user.email,
      },
      update: {
        userId,
        email: customerEmail || user.email,
        status: "active",
      },
    });

    if (subscriptionId && this.isStripeConfigured()) {
      const subscription = await this.stripeGet<StripeSubscriptionPayload>(
        `subscriptions/${subscriptionId}`,
      );
      return this.syncSubscription(subscription);
    }

    return { userId, subscriptionId };
  }

  private async processInvoiceEvent(
    object: Record<string, unknown>,
    eventType: string,
  ) {
    const subscriptionId = this.stringFrom(object["subscription"]);
    if (!subscriptionId) {
      return { ignored: true };
    }
    const status =
      eventType === "invoice.paid"
        ? SubscriptionStatus.active
        : SubscriptionStatus.past_due;
    const subscription = await prisma.subscription
      .update({
        where: { providerSubscriptionId: subscriptionId },
        data: { status },
      })
      .catch(() => null);

    if (subscription && eventType === "invoice.paid") {
      await this.commercialService.recordReferralMilestone(
        subscription.userId,
        ReferralMilestoneType.paid_conversion,
        {
          entityType: "subscription",
          entityId: subscription.id,
        },
      );
      await this.adminLifecycleService.recordEvent({
        userId: subscription.userId,
        stage: UserLifecycleStage.paid,
        eventType: "paid_conversion",
        sourceType: "subscription",
        sourceId: subscription.id,
      });
    }

    return {
      ignored: !subscription,
      userId: subscription?.userId,
      subscriptionId,
    };
  }

  private async syncSubscription(payload: StripeSubscriptionPayload) {
    const providerSubscriptionId = payload.id;
    const providerCustomerId = this.customerIdFrom(payload.customer);
    if (!providerSubscriptionId || !providerCustomerId) {
      return { ignored: true };
    }

    const billingCustomer = await prisma.billingCustomer.findUnique({
      where: {
        provider_providerCustomerId: {
          provider: "stripe",
          providerCustomerId,
        },
      },
    });
    const metadataUserId = payload.metadata?.["userId"];
    const userId = billingCustomer?.userId || metadataUserId;
    if (!userId) {
      return { ignored: true, subscriptionId: providerSubscriptionId };
    }

    const priceId = payload.items?.data?.[0]?.price?.id;
    const plan = await this.resolvePlanForSubscription(
      priceId,
      payload.metadata?.["planCode"],
    );
    if (!plan) {
      return { ignored: true, userId, subscriptionId: providerSubscriptionId };
    }

    const activeBillingCustomer =
      billingCustomer ??
      (await this.getOrCreateBillingCustomerForProvider(
        userId,
        providerCustomerId,
      ));
    const status = this.mapStripeSubscriptionStatus(payload.status);
    const periodStart = this.dateFromUnix(payload.current_period_start);
    const periodEnd = this.dateFromUnix(payload.current_period_end);

    const subscription = await prisma.subscription.upsert({
      where: { providerSubscriptionId },
      create: {
        userId,
        planId: plan.id,
        billingCustomerId: activeBillingCustomer.id,
        provider: "stripe",
        providerCustomerId,
        providerSubscriptionId,
        providerPriceId: priceId,
        status,
        billingInterval: payload.metadata?.["interval"] || null,
        startedAt: periodStart || this.systemDateService.now(),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end),
        trialEndsAt: this.dateFromUnix(payload.trial_end ?? undefined),
        endedAt: this.dateFromUnix(payload.ended_at ?? undefined),
        metadataJson: this.toJson(payload.metadata ?? {}),
      },
      update: {
        userId,
        planId: plan.id,
        billingCustomerId: activeBillingCustomer.id,
        providerCustomerId,
        providerPriceId: priceId,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end),
        trialEndsAt: this.dateFromUnix(payload.trial_end ?? undefined),
        endedAt: this.dateFromUnix(payload.ended_at ?? undefined),
        metadataJson: this.toJson(payload.metadata ?? {}),
      },
    });

    if (
      status === SubscriptionStatus.active ||
      status === SubscriptionStatus.trialing
    ) {
      await prisma.subscription.updateMany({
        where: {
          userId,
          id: { not: subscription.id },
          status: {
            in: [SubscriptionStatus.active, SubscriptionStatus.trialing],
          },
        },
        data: { status: SubscriptionStatus.canceled, endedAt: this.systemDateService.now() },
      });
    }

    return { userId, subscriptionId: providerSubscriptionId };
  }

  private async getOrCreateBillingCustomer(userId: string, email: string) {
    let billingCustomer = await prisma.billingCustomer.findFirst({
      where: { userId, provider: "stripe", status: "active" },
      orderBy: { createdAt: "desc" },
    });
    if (billingCustomer) {
      return billingCustomer;
    }

    let providerCustomerId = `local_${userId}`;
    if (this.isStripeConfigured()) {
      const customer = await this.stripeRequest<Record<string, unknown>>(
        "customers",
        {
          email,
          "metadata[userId]": userId,
        },
      );
      providerCustomerId =
        this.stringFrom(customer["id"]) || providerCustomerId;
    }

    billingCustomer = await prisma.billingCustomer.create({
      data: {
        userId,
        provider: "stripe",
        providerCustomerId,
        email,
      },
    });
    return billingCustomer;
  }

  private async getOrCreateBillingCustomerForProvider(
    userId: string,
    providerCustomerId: string,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return prisma.billingCustomer.upsert({
      where: {
        provider_providerCustomerId: {
          provider: "stripe",
          providerCustomerId,
        },
      },
      create: {
        userId,
        provider: "stripe",
        providerCustomerId,
        email: user.email,
      },
      update: {
        userId,
        email: user.email,
        status: "active",
      },
    });
  }

  private async resolvePlanForSubscription(
    priceId?: string,
    planCode?: string,
  ) {
    if (priceId) {
      const plan = await prisma.plan.findFirst({
        where: {
          OR: [
            { stripeMonthlyPriceId: priceId },
            { stripeAnnualPriceId: priceId },
          ],
        },
      });
      if (plan) return plan;
    }
    if (planCode) {
      return prisma.plan.findUnique({ where: { code: planCode } });
    }
    return null;
  }

  private parseAndVerifyWebhook(input: {
    signature?: string;
    rawBody?: Buffer;
    body: unknown;
    isSimulated?: boolean;
  }): StripeEvent {
    const secret = this.usableStripeSecret(
      process.env["STRIPE_WEBHOOK_SECRET"],
    );
    const rawPayload =
      input.rawBody?.toString("utf8") || JSON.stringify(input.body ?? {});
    if (secret && !input.isSimulated) {
      if (!input.signature) {
        throw new BadRequestException("Missing Stripe signature.");
      }
      this.verifyStripeSignature(rawPayload, input.signature, secret);
    }
    const parsed =
      typeof input.body === "object" && input.body
        ? input.body
        : JSON.parse(rawPayload);
    if (!this.isStripeEvent(parsed)) {
      throw new BadRequestException("Invalid Stripe event payload.");
    }
    return parsed;
  }

  private verifyStripeSignature(
    payload: string,
    signatureHeader: string,
    secret: string,
  ) {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((part) => {
        const [key, value] = part.split("=");
        return [key, value];
      }),
    );
    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) {
      throw new BadRequestException("Invalid Stripe signature header.");
    }

    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signature, "hex");
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new BadRequestException("Invalid Stripe signature.");
    }
  }

  private async stripeRequest<T>(
    path: string,
    params: Record<string, string | number | boolean | null | undefined>,
  ): Promise<T> {
    return this.stripeFetch<T>(path, {
      method: "POST",
      body: this.formBody(params),
    });
  }

  private async stripeGet<T>(path: string): Promise<T> {
    return this.stripeFetch<T>(path, { method: "GET" });
  }

  private async stripeFetch<T>(path: string, init: RequestInit): Promise<T> {
    const secretKey = process.env["STRIPE_SECRET_KEY"];
    if (!secretKey) {
      throw new InternalServerErrorException("Stripe is not configured.");
    }
    const response = await fetch(`${this.stripeApiBase}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(init.body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
    });
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok) {
      const message =
        this.stringFrom(
          (payload?.["error"] as Record<string, unknown> | undefined)?.[
            "message"
          ],
        ) || `Stripe request failed with ${response.status}`;
      throw new BadRequestException(message);
    }
    return payload as T;
  }

  private formBody(
    params: Record<string, string | number | boolean | null | undefined>,
  ) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        body.set(key, String(value));
      }
    }
    return body;
  }

  private mapStripeSubscriptionStatus(status?: string): SubscriptionStatus {
    if (status === "trialing") return SubscriptionStatus.trialing;
    if (status === "active") return SubscriptionStatus.active;
    if (status === "past_due") return SubscriptionStatus.past_due;
    if (status === "canceled") return SubscriptionStatus.canceled;
    if (status === "unpaid") return SubscriptionStatus.unpaid;
    if (status === "incomplete" || status === "incomplete_expired")
      return SubscriptionStatus.incomplete;
    return SubscriptionStatus.expired;
  }

  private planSummary(plan: {
    code: string;
    name: string;
    monthlyPriceCents: number;
    annualPriceCents: number;
    currency: string;
  }) {
    return {
      code: plan.code,
      name: plan.name,
      monthlyPriceCents: plan.monthlyPriceCents,
      annualPriceCents: plan.annualPriceCents,
      currency: plan.currency,
    };
  }

  private billingCustomerSummary(customer: {
    id: string;
    providerCustomerId: string;
    email: string;
    status: string;
  }) {
    return {
      id: customer.id,
      providerCustomerId: customer.providerCustomerId,
      email: customer.email,
      status: customer.status,
    };
  }

  private isStripeConfigured() {
    const key = this.usableStripeSecret(process.env["STRIPE_SECRET_KEY"]);
    return Boolean(key && key.startsWith("sk_"));
  }

  private usableStripeSecret(value?: string) {
    const key = value?.trim();
    if (
      !key ||
      key.includes("...") ||
      key.toLowerCase().includes("placeholder") ||
      key.toLowerCase().includes("changeme")
    ) {
      return undefined;
    }
    return key;
  }

  private isStripeEvent(value: unknown): value is StripeEvent {
    return Boolean(
      value &&
      typeof value === "object" &&
      this.stringFrom((value as Record<string, unknown>)["id"]) &&
      this.stringFrom((value as Record<string, unknown>)["type"]),
    );
  }

  private metadataValue(object: Record<string, unknown>, key: string) {
    const metadata = object["metadata"];
    if (!metadata || typeof metadata !== "object") return undefined;
    return this.stringFrom((metadata as Record<string, unknown>)[key]);
  }

  private customerIdFrom(value: string | Record<string, unknown> | undefined) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") return this.stringFrom(value["id"]);
    return undefined;
  }

  private stringFrom(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private dateFromUnix(value?: number | null) {
    return typeof value === "number" && Number.isFinite(value)
      ? new Date(value * 1000)
      : null;
  }

  private currentMonthlyWindow() {
    const now = this.systemDateService.now();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    return { start, end };
  }

  private withQuery(url: string, params: Record<string, string>) {
    const next = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (value) next.searchParams.set(key, value);
    }
    return next.toString();
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }
}
