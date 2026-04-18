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
import { ExecuteContentOpportunityDto } from './dto/execute-content-opportunity.dto';
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
