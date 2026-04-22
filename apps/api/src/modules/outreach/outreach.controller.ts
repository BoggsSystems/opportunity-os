import { Body, Controller, Get, Param, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SendOutreachDto } from './dto/send-outreach.dto';
import { OutreachService } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Get('draft/:opportunityId')
  async generateDraft(
    @Param('opportunityId') opportunityId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('No authenticated user found');
    }

    return this.outreachService.generateDraft(user.id, opportunityId);
  }

  @Post('send')
  async send(
    @Body() body: SendOutreachDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('No authenticated user found');
    }

    return this.outreachService.sendDraft(user.id, body);
  }
}
