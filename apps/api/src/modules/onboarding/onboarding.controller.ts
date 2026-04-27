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

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly linkedInIngestService: LinkedInIngestService,
  ) {}

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
