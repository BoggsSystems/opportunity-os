import { Controller, Get, Req } from '@nestjs/common';
import { CommercialService } from './commercial.service';

@Controller('me')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('subscription')
  async getSubscription(@Req() req: any) {
    return this.commercialService.getSubscription(req.user.id);
  }

  @Get('entitlements')
  async getEntitlements(@Req() req: any): Promise<any> {
    return this.commercialService.getEntitlements(req.user.id);
  }

  @Get('usage')
  async getUsage(@Req() req: any) {
    return this.commercialService.getUsage(req.user.id);
  }
}
