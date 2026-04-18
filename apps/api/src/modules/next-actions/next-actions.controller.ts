import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { NextActionsService } from './next-actions.service';

@Controller('next-actions')
export class NextActionsController {
  constructor(private readonly nextActionsService: NextActionsService) {}

  @Get()
  async getNextActions(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) {
      throw new UnauthorizedException('No authenticated user found');
    }
    return this.nextActionsService.getNextActions(user.id);
  }
}
