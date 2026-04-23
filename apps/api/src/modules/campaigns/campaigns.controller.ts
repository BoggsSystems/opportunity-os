import { Body, Controller, Get, Param, Post, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('current/workspace')
  async getCurrentWorkspace(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignsService.getCurrentCampaignWorkspace(user.id);
  }

  @Get(':id/workspace')
  async getWorkspace(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignsService.getCampaignWorkspace(user.id, id);
  }

  @Get(':id/opportunities/:opportunityId')
  async getOpportunityDetail(
    @Param('id') id: string,
    @Param('opportunityId') opportunityId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignsService.getOpportunityDetail(user.id, id, opportunityId);
  }

  @Post(':id/follow-ups')
  async createFollowUps(
    @Param('id') id: string,
    @Body() body: { opportunityIds?: string[] },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignsService.createFollowUpTasks(user.id, id, body.opportunityIds);
  }

  @Post(':id/next-cycle')
  async createNextCycle(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignsService.createNextCampaignCycle(user.id, id);
  }
}
