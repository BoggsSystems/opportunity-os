import { Body, Controller, Get, Headers, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { Public } from "../auth/public.decorator";
import { AuthenticatedUser } from "../auth/auth.types";
import { BillingService } from "./billing.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("me")
  async getBillingState(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getBillingState(user.id);
  }

  @Post("checkout-session")
  async createCheckoutSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      planCode: string;
      interval?: "monthly" | "annual";
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    return this.billingService.createCheckoutSession(user.id, {
      planCode: body.planCode,
      interval: body.interval,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @Post("portal-session")
  async createPortalSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { returnUrl?: string },
  ) {
    return this.billingService.createPortalSession(user.id, body.returnUrl);
  }

  @Public()
  @Post("webhook")
  async handleWebhook(
    @Req() request: RawBodyRequest,
    @Headers("stripe-signature") stripeSignature?: string,
  ) {
    return this.billingService.handleStripeWebhook({
      signature: stripeSignature,
      rawBody: request.rawBody,
      body: request.body,
    });
  }
}
