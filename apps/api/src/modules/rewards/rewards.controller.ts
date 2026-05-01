import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('gallery')
  async getGallery(@Request() req) {
    return this.rewardsService.getRewardsGallery(req.user.id);
  }

  @Get('streak')
  async getStreak(@Request() req) {
    const streak = await this.rewardsService.evaluateStreak(req.user.id);
    return { streak };
  }
}
