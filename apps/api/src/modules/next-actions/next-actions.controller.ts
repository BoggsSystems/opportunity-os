import { Controller, Get, Req } from '@nestjs/common';
import { NextActionsService } from './next-actions.service';
import { NextActionItem } from './interfaces/next-action.interface';

@Controller('next-actions')
export class NextActionsController {
  constructor(private readonly nextActionsService: NextActionsService) {}

  @Get()
  async getNextActions(@Req() req: any): Promise<NextActionItem[]> {
    return this.nextActionsService.getNextActions(req.user.id);
  }
}
