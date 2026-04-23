import { Body, Controller, Get, Param, Post, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConnectorsService } from './connectors.service';
import { SetupEmailConnectorDto } from './dto/setup-email-connector.dto';

@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Get()
  async list(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.listConnectors(user.id);
  }

  @Get('email/readiness')
  async emailReadiness(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.getEmailReadiness(user.id);
  }

  @Post('email/setup')
  async setupEmail(@Body() body: SetupEmailConnectorDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.setupEmailConnector(user.id, body);
  }

  @Post(':id/test')
  async test(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.testConnector(user.id, id);
  }

  @Post('email/sync')
  async syncEmail(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.syncEmail(user.id);
  }

  @Get('email/opportunities/:opportunityId/thread-summary')
  async summarizeThread(@Param('opportunityId') opportunityId: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.summarizeThread(user.id, opportunityId);
  }
}
