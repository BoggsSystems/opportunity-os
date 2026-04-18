import { Controller, Get } from '@nestjs/common';
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
}
