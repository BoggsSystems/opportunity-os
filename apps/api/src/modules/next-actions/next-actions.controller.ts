import { Controller, Get, Req } from '@nestjs/common';
import { NextActionsService } from './next-actions.service';

@Controller('next-actions')
export class NextActionsController {
  constructor(private readonly nextActionsService: NextActionsService) {}

  @Get()
  async getNextActions(@Req() req: any) {
    return this.nextActionsService.getNextActions(req.user.id);
  }
}
