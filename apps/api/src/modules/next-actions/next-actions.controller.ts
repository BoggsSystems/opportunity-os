import { Controller, Get, Req } from '@nestjs/common';
import { NextActionsService } from './next-actions.service';

@Controller('next-actions')
export class NextActionsController {
  constructor(private readonly nextActionsService: NextActionsService) {}

  @Get()
  async getNextActions(@Req() req: any) {
    // For development, use test user ID if no auth
    const userId = req.user?.id || '9902677d-c456-44f0-8312-efcdf4f55f69';
    return this.nextActionsService.getNextActions(userId);
  }
}
