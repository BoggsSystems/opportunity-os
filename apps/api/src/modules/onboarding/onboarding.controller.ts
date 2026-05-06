import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Logger,
  Body,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { LinkedInIngestService } from '../connections/services/linkedin-ingest.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { AiService } from '../ai/ai.service';
import { Public } from '../auth/public.decorator';

console.log('🚀 OnboardingController.ts LOADED');

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly linkedInIngestService: LinkedInIngestService,
    private readonly discoveryService: DiscoveryService,
    private readonly aiService: AiService,
  ) {}

  @Post('offerings/propose')
  @ApiOperation({ summary: 'Propose revenue lanes based on context' })
  async proposeOfferings(@Body() body: { networkCount: number; networkPosture: string; frameworks: string[]; interpretation: string }) {
    this.logger.log(`Proposing offerings for networkCount=${body.networkCount}`);
    const offerings = await this.aiService.proposeRevenueLanes(body);
    return { success: true, offerings };
  }

  @Post('offerings/refine')
  @ApiOperation({ summary: 'Refine revenue lanes based on feedback' })
  async refineOfferings(@Body() body: { currentLanes: any[]; feedback: string; networkCount: number; networkPosture: string; frameworks: string[]; interpretation: string }) {
    this.logger.log(`Refining offerings with feedback: ${body.feedback}`);
    const offerings = await this.aiService.refineRevenueLanes(body.currentLanes, body.feedback, body);
    return { success: true, offerings };
  }

  @Post('campaigns/propose')
  @ApiOperation({ summary: 'Propose campaigns for confirmed revenue lanes' })
  async proposeCampaigns(@Body() body: { selectedLanes: any[]; networkCount: number; frameworks: string[]; interpretation: string }) {
    this.logger.log(`Proposing campaigns for ${body.selectedLanes.length} lanes`);
    const campaigns = await this.aiService.proposeCampaigns(body);
    return { success: true, campaigns };
  }

  @Post('campaign-dimensions/propose')
  @ApiOperation({ summary: 'Propose configurable campaign dimensions for one revenue lane' })
  async proposeCampaignDimensions(
    @Req() req: any,
    @Body() body: {
      offering: any;
      networkCount?: number;
      frameworks?: string[];
      interpretation?: string;
      strategicDraft?: any;
      uploadedAssets?: any[];
      comprehensiveSynthesis?: string | null;
      existingDimensions?: any;
    },
  ) {
    this.logger.log(`Proposing campaign dimensions for offering=${body.offering?.title || body.offering?.name || 'unknown'}`);
    try {
      const result = await this.aiService.proposeCampaignDimensions({
        ...body,
        userId: req?.user?.id,
      });
      return { success: true, ...result };
    } catch (error: any) {
      this.logger.error('Campaign dimension synthesis failed', error?.stack || error);
      return {
        success: false,
        source: 'ai_failed',
        error: 'CAMPAIGN_DIMENSION_SYNTHESIS_FAILED',
        message: 'I could not synthesize campaign dimensions from your intelligence yet.',
      };
    }
  }

  @Post('campaigns/refine')
  @ApiOperation({ summary: 'Refine campaigns based on feedback' })
  async refineCampaigns(@Body() body: { currentCampaigns: any[]; feedback: string; selectedLanes: any[]; networkCount: number; frameworks: string[]; interpretation: string }) {
    this.logger.log(`Refining campaigns with feedback: ${body.feedback}`);
    const campaigns = await this.aiService.refineCampaigns(body.currentCampaigns, body.feedback, body);
    return { success: true, campaigns };
  }
  
  @Post('action-lanes/propose')
  @ApiOperation({ summary: 'Propose tactical action lanes for confirmed campaigns' })
  async proposeActionLanes(@Body() body: { selectedCampaigns: any[]; comprehensiveSynthesis: string }) {
    this.logger.log(`Proposing action lanes for ${body.selectedCampaigns.length} campaigns`);
    const actionLanes = await this.aiService.proposeActionLanes(body.selectedCampaigns, body.comprehensiveSynthesis);
    return { success: true, actionLanes };
  }

  @Post('action-lanes/refine')
  @ApiOperation({ summary: 'Refine tactical action lanes based on feedback' })
  async refineActionLanes(@Body() body: { currentActionLanes: any[]; feedback: string; selectedCampaigns: any[]; comprehensiveSynthesis: string }) {
    this.logger.log(`Refining action lanes with feedback: ${body.feedback}`);
    const actionLanes = await this.aiService.refineActionLanes(body.currentActionLanes, body.feedback, body.selectedCampaigns, body.comprehensiveSynthesis);
    return { success: true, actionLanes };
  }

  @Public()
  @Post('knowledge')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Pre-auth analysis of strategic assets (PDF)' })
  @ApiResponse({ status: 201, description: 'Analysis completed successfully' })
  async preAuthKnowledge(
    @UploadedFile() file: Express.Multer.File,
    @Body('previousContext') previousContext?: string
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
      const parsedContext = previousContext ? JSON.parse(previousContext) : undefined;
      const analysis = await this.discoveryService.preAuthInterpret(file, parsedContext);
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
