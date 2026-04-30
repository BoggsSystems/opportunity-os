import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { ReferralMilestoneType } from "@opportunity-os/db";
import { CurrentUser } from "../auth/current-user.decorator";
import { Public } from "../auth/public.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { CommercialService } from "./commercial.service";

@Controller("me")
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get("subscription")
  async getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.commercialService.getSubscription(user.id);
  }

  @Get("commercial-state")
  async getCommercialState(@CurrentUser() user: AuthenticatedUser) {
    return this.commercialService.getAccountState(user.id);
  }

  @Get("plans")
  async listPlans() {
    return this.commercialService.listPlans();
  }

  @Get("entitlements")
  async getEntitlements(@CurrentUser() user: AuthenticatedUser): Promise<any> {
    return this.commercialService.getEntitlements(user.id);
  }

  @Get("usage")
  async getUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.commercialService.getUsage(user.id);
  }

  @Get("capabilities/:featureKey/check")
  async checkCapability(
    @CurrentUser() user: AuthenticatedUser,
    @Param("featureKey") featureKey: string,
    @Query("quantity") quantity?: string,
    @Query("connectorCapability") connectorCapability?: string,
  ) {
    return this.commercialService.checkCapability(user.id, {
      featureKey,
      quantity: quantity ? Number(quantity) : undefined,
      connectorCapability,
    });
  }

  @Post("usage/:featureKey/increment")
  async incrementUsage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("featureKey") featureKey: string,
    @Body() body: { quantity?: number },
  ) {
    return this.commercialService.incrementUsage(
      user.id,
      featureKey,
      body.quantity,
    );
  }

  @Post("billing/checkout")
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { planCode: string; interval?: "monthly" | "annual" },
  ) {
    return this.commercialService.createCheckoutSession(
      user.id,
      body.planCode,
      body.interval,
    );
  }

  @Public()
  @Post("referrals/visits")
  async recordReferralVisit(
    @Body()
    body: {
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
      metadata?: unknown;
    },
    @Req() request: Request,
  ) {
    return this.commercialService.recordReferralVisit({
      ...body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post("billing/dev-activate")
  async activatePlanForDev(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { planCode: string },
  ) {
    return this.commercialService.activatePlanForDev(user.id, body.planCode);
  }

  @Get("referral-link")
  async getReferralLink(@CurrentUser() user: AuthenticatedUser) {
    return this.commercialService.getOrCreateReferralLink(user.id);
  }

  @Post("referrals/apply")
  async applyReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { code: string },
  ) {
    return this.commercialService.applyReferralCode(user.id, body.code);
  }

  @Post("referrals/milestones")
  async recordReferralMilestone(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      milestoneType: ReferralMilestoneType;
      sourceEntityType?: string;
      sourceEntityId?: string;
    },
  ) {
    return this.commercialService.recordReferralMilestone(
      user.id,
      body.milestoneType,
      {
        entityType: body.sourceEntityType,
        entityId: body.sourceEntityId,
      },
    );
  }

  @Get("dev-bypass")
  async getDevBypass(@CurrentUser() user: AuthenticatedUser) {
    return this.commercialService.getBypassState(user.id);
  }
}
