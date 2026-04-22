import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CommercialService } from './commercial.service';

@Controller('me')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('subscription')
  async getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.commercialService.getSubscription(user.id);
  }

  @Get('entitlements')
  async getEntitlements(@CurrentUser() user: AuthenticatedUser): Promise<any> {
    return this.commercialService.getEntitlements(user.id);
  }

  @Get('usage')
  async getUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.commercialService.getUsage(user.id);
  }

  @Get('capabilities/:featureKey/check')
  async checkCapability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('featureKey') featureKey: string,
    @Query('quantity') quantity?: string,
    @Query('connectorCapability') connectorCapability?: string,
  ) {
    return this.commercialService.checkCapability(user.id, {
      featureKey,
      quantity: quantity ? Number(quantity) : undefined,
      connectorCapability,
    });
  }

  @Post('usage/:featureKey/increment')
  async incrementUsage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('featureKey') featureKey: string,
    @Body() body: { quantity?: number },
  ) {
    return this.commercialService.incrementUsage(user.id, featureKey, body.quantity);
  }
}
