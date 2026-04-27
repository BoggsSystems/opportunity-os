import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { LinkedInIngestService } from '../connections/services/linkedin-ingest.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { Public } from '../auth/public.decorator';

console.log('🚀 OnboardingController.ts LOADED');

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly linkedInIngestService: LinkedInIngestService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  @Public()
  @Post('knowledge')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Pre-auth analysis of strategic assets (PDF)' })
  @ApiResponse({ status: 201, description: 'Analysis completed successfully' })
  async preAuthKnowledge(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      this.logger.warn('❌ No file received in preAuthKnowledge');
      return {
        success: false,
        message: 'No file uploaded',
        error: 'Please select a strategic asset to upload.',
      };
    }
    this.logger.log(`Performing anonymous Knowledge analysis for file: ${file.originalname} (Size: ${file.size}, Buffer: ${file.buffer ? 'PRESENT' : 'MISSING'})`);

    if (!file || !file.originalname.toLowerCase().endsWith('.pdf')) {
      return {
        success: false,
        message: 'Invalid file',
        error: 'A PDF asset is required',
      };
    }

    try {
      this.logger.log(`🤖 CALLING DISCOVERY: preAuthInterpret for ${file.originalname}`);
      const analysis = await this.discoveryService.preAuthInterpret(file);
      this.logger.log(`✅ DISCOVERY SUCCESS for ${file.originalname}`);

      return {
        success: true,
        message: 'Strategic asset interpreted.',
        data: analysis
      };
    } catch (error: any) {
      this.logger.error(`❌ ULTIMATE FAILURE in preAuthKnowledge for ${file.originalname}:`, error?.stack);
      return {
        success: false,
        message: 'Internal processing error',
        error: error?.message || 'Unknown error',
      };
    }
  }

  @Public()
  @Post('audit')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Pre-auth audit of LinkedIn data export' })
  @ApiResponse({ status: 201, description: 'Audit completed successfully, strategic insights returned' })
  async preAuthAudit(
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.logger.log(`Performing anonymous LinkedIn audit for file: ${file?.originalname}`);

    if (!file || !file.originalname.endsWith('.zip')) {
      return {
        success: false,
        message: 'Invalid file',
        error: 'A LinkedIn data export ZIP file is required',
      };
    }

    // Process the ZIP without a userId
    const analysis = await this.linkedInIngestService.processFullZip(file.buffer);

    return {
      success: true,
      message: 'Audit complete. Strategic insights generated.',
      data: analysis
    };
  }
}
