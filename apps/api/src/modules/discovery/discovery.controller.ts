import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post('content/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContent(
    @UploadedFile() file: any,
    @Body() body: UploadContentDto,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery ingestion');
    }

    return this.discoveryService.uploadContent(userId, file, body);
  }

  @Post('content/:id/execute')
  async executeContentOpportunity(
    @Param('id') id: string,
    @Body() body: ExecuteContentOpportunityDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('No user context available for discovery execution');
    }

    return this.discoveryService.executeContentOpportunity(userId, id, body);
  }
}
