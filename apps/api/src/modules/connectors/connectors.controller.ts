import { Body, Controller, Get, Param, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';
import type { Response } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConnectorsService } from './connectors.service';
import { SetupEmailConnectorDto } from './dto/setup-email-connector.dto';
import { SetupStorageConnectorDto } from './dto/setup-storage-connector.dto';
import { SetupCalendarConnectorDto } from './dto/setup-calendar-connector.dto';

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

  @Post('storage/setup')
  async setupStorage(@Body() body: SetupStorageConnectorDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.setupStorageConnector(user.id, body);
  }

  @Post('calendar/setup')
  async setupCalendar(@Body() body: SetupCalendarConnectorDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.setupCalendarConnector(user.id, body);
  }

  @Post('social/setup')
  async setupSocial(@Body() body: any, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.setupSocialConnector(user.id, body);
  }

  @Post('commerce/setup')
  async setupCommerce(@Body() body: any, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.setupCommerceConnector(user.id, body);
  }

  @Get('email/oauth/start')
  async startEmailOAuth(
    @Query('provider') provider: 'outlook' | 'gmail',
    @Query('returnTo') returnTo: string | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.startEmailOAuth(user.id, provider, returnTo);
  }

  @Get('email/oauth/callback')
  async completeEmailOAuth(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const html = await this.connectorsService.completeEmailOAuth({
      state,
      code,
      error,
      errorDescription,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('social/oauth/start')
  async startSocialOAuth(
    @Query('provider') provider: 'linkedin' | 'hubspot' | 'shopify' | 'salesforce',
    @Query('returnTo') returnTo: string | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.startSocialOAuth(user.id, provider, returnTo);
  }

  @Get('callback/linkedin')
  async completeLinkedInOAuth(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    // We'll reuse the completeEmailOAuth logic style but for LinkedIn
    const html = await this.connectorsService.completeSocialOAuth({
      provider: 'linkedin',
      state,
      code,
      error,
      errorDescription,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
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

  @Get('storage/assets')
  async listStorageAssets(
    @Query('provider') provider: string | undefined,
    @Query('folderId') folderId: string | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const logPath = '/Users/jeffboggs/opportunity-os/apps/api/debug.log';
    fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] 📡 [Controller] listStorageAssets - Provider: ${provider}, Folder: ${folderId}, User: ${user?.id}\n`);
    console.log('📡 [ConnectorsController] GET storage/assets', { provider, folderId, userId: user?.id });
    if (!user?.id) {
      console.warn('📡 [ConnectorsController] 401 Unauthorized - No user');
      throw new UnauthorizedException('No authenticated user found');
    }
    return this.connectorsService.listStorageAssets(user.id, provider, folderId);
  }

  @Get('storage/files')
  async listStorageFiles(
    @Query('provider') provider: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.listStorageFiles(user.id, provider, q);
  }

  @Get('storage/search')
  async searchStorage(
    @Query('q') q: string,
    @Query('provider') provider: string | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.searchStorage(user.id, q, provider);
  }

  @Post('storage/sync')
  async syncStorage(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.syncStorage(user.id);
  }

  @Post('calendar/sync')
  async syncCalendar(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.syncCalendar(user.id);
  }

  @Get('email/opportunities/:opportunityId/thread-summary')
  async summarizeThread(@Param('opportunityId') opportunityId: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.connectorsService.summarizeThread(user.id, opportunityId);
  }
}
