import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { DiscoveryService } from './discovery.service';
import { CreateDiscoveryScanDto } from './dto/create-discovery-scan.dto';
import { ExecuteContentOpportunityDto } from './dto/execute-content-opportunity.dto';
import { RejectDiscoveryTargetDto } from './dto/reject-discovery-target.dto';
import { UploadContentDto } from './dto/upload-content.dto';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('test')
  async test(): Promise<any> {
    return { message: 'Discovery module is working!' };
  }

  @Get('content')
  async listContent(@CurrentUser() user?: AuthenticatedUser) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery listing');
    }

    return this.discoveryService.listContent(userId);
  }

  @Get('scans')
  async listScans(@CurrentUser() user?: AuthenticatedUser) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery scans');
    }

    return this.discoveryService.listScans(userId);
  }

  @Post('scans')
  async createScan(
    @Body() body: CreateDiscoveryScanDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery scan');
    }

    return this.discoveryService.createScan(userId, body);
  }

  @Get('scans/:id')
  async getScan(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery scan');
    }

    return this.discoveryService.getScan(userId, id);
  }

  @Get('scans/:id/targets')
  async listTargets(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery targets');
    }

    return this.discoveryService.listTargets(userId, id);
  }

  @Post('scans/:id/promote-accepted')
  async promoteAccepted(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery promotion');
    }

    return this.discoveryService.promoteAcceptedTargets(userId, id);
  }

  @Post('targets/:id/accept')
  async acceptTarget(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery target acceptance');
    }

    return this.discoveryService.acceptTarget(userId, id);
  }

  @Post('targets/:id/reject')
  async rejectTarget(
    @Param('id') id: string,
    @Body() body: RejectDiscoveryTargetDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery target rejection');
    }

    return this.discoveryService.rejectTarget(userId, id, body.reason);
  }

  @Post('content/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContent(
    @UploadedFile() file: any,
    @Body() body: UploadContentDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery ingestion');
    }

    return this.discoveryService.uploadContent(userId, file, body);
  }

  @Post('content/:id/execute')
  async executeContentOpportunity(
    @Param('id') id: string,
    @Body() body: ExecuteContentOpportunityDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const userId = user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery execution');
    }

    return this.discoveryService.executeContentOpportunity(userId, id, body);
  }
}
