import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  UseGuards,
  Request 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignOrchestrationService } from './campaign-orchestration.service';
import { 
  CreateCampaignDto, 
  UpdateCampaignDto,
  CreateActionLaneDto,
  UpdateActionLaneDto,
  CreateActionCycleDto,
  UpdateActionCycleDto,
  UpdateMetricsDto
} from './dto/campaign.dto';

@ApiTags('campaign-orchestration')
@UseGuards(JwtAuthGuard)
@Controller('campaign-orchestration')
export class CampaignOrchestrationController {
  constructor(private readonly campaignOrchestrationService: CampaignOrchestrationService) {}

  // CAMPAIGN ENDPOINTS
  @Post('campaigns')
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  async createCampaign(@Request() req, @Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignOrchestrationService.createCampaign(req.user.userId, createCampaignDto);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List user campaigns' })
  @ApiResponse({ status: 200, description: 'Campaigns retrieved successfully' })
  async listCampaigns(
    @Request() req,
    @Query('status') status?: string
  ) {
    return this.campaignOrchestrationService.listCampaigns(req.user.userId, status as any);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get campaign details' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved successfully' })
  async getCampaign(@Request() req, @Param('id') id: string) {
    return this.campaignOrchestrationService.getCampaign(req.user.userId, id);
  }

  @Put('campaigns/:id')
  @ApiOperation({ summary: 'Update campaign' })
  @ApiResponse({ status: 200, description: 'Campaign updated successfully' })
  async updateCampaign(
    @Request() req,
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto
  ) {
    return this.campaignOrchestrationService.updateCampaign(req.user.userId, id, updateCampaignDto);
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete campaign' })
  @ApiResponse({ status: 200, description: 'Campaign deleted successfully' })
  async deleteCampaign(@Request() req, @Param('id') id: string) {
    return this.campaignOrchestrationService.deleteCampaign(req.user.userId, id);
  }

  // ACTION LANE ENDPOINTS
  @Post('action-lanes')
  @ApiOperation({ summary: 'Create a new action lane' })
  @ApiResponse({ status: 201, description: 'Action lane created successfully' })
  async createActionLane(@Request() req, @Body() createActionLaneDto: CreateActionLaneDto) {
    return this.campaignOrchestrationService.createActionLane(req.user.userId, createActionLaneDto);
  }

  @Get('action-lanes')
  @ApiOperation({ summary: 'List action lanes' })
  @ApiResponse({ status: 200, description: 'Action lanes retrieved successfully' })
  async listActionLanes(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string
  ) {
    return this.campaignOrchestrationService.listActionLanes(
      req.user.userId, 
      campaignId, 
      status as any
    );
  }

  @Get('action-lanes/:id')
  @ApiOperation({ summary: 'Get action lane details' })
  @ApiResponse({ status: 200, description: 'Action lane retrieved successfully' })
  async getActionLane(@Request() req, @Param('id') id: string) {
    return this.campaignOrchestrationService.getActionLane(req.user.userId, id);
  }

  @Put('action-lanes/:id')
  @ApiOperation({ summary: 'Update action lane' })
  @ApiResponse({ status: 200, description: 'Action lane updated successfully' })
  async updateActionLane(
    @Request() req,
    @Param('id') id: string,
    @Body() updateActionLaneDto: UpdateActionLaneDto
  ) {
    return this.campaignOrchestrationService.updateActionLane(req.user.userId, id, updateActionLaneDto);
  }

  @Delete('action-lanes/:id')
  @ApiOperation({ summary: 'Delete action lane' })
  @ApiResponse({ status: 200, description: 'Action lane deleted successfully' })
  async deleteActionLane(@Request() req, @Param('id') id: string) {
    return this.campaignOrchestrationService.deleteActionLane(req.user.userId, id);
  }

  // ACTION CYCLE ENDPOINTS
  @Post('action-cycles')
  @ApiOperation({ summary: 'Create a new action cycle' })
  @ApiResponse({ status: 201, description: 'Action cycle created successfully' })
  async createActionCycle(@Request() req, @Body() createActionCycleDto: CreateActionCycleDto) {
    return this.campaignOrchestrationService.createActionCycle(req.user.userId, createActionCycleDto);
  }

  @Get('action-cycles')
  @ApiOperation({ summary: 'List action cycles' })
  @ApiResponse({ status: 200, description: 'Action cycles retrieved successfully' })
  async listActionCycles(
    @Request() req,
    @Query('campaignId') campaignId?: string,
    @Query('actionLaneId') actionLaneId?: string,
    @Query('status') status?: string
  ) {
    return this.campaignOrchestrationService.listActionCycles(
      req.user.userId,
      campaignId,
      actionLaneId,
      status as any
    );
  }

  @Get('action-cycles/:id')
  @ApiOperation({ summary: 'Get action cycle details' })
  @ApiResponse({ status: 200, description: 'Action cycle retrieved successfully' })
  async getActionCycle(@Request() req, @Param('id') id: string) {
    return this.campaignOrchestrationService.getActionCycle(req.user.userId, id);
  }

  @Put('action-cycles/:id')
  @ApiOperation({ summary: 'Update action cycle' })
  @ApiResponse({ status: 200, description: 'Action cycle updated successfully' })
  async updateActionCycle(
    @Request() req,
    @Param('id') id: string,
    @Body() updateActionCycleDto: UpdateActionCycleDto
  ) {
    return this.campaignOrchestrationService.updateActionCycle(req.user.userId, id, updateActionCycleDto);
  }

  @Delete('action-cycles/:id')
  @ApiOperation({ summary: 'Delete action cycle' })
  @ApiResponse({ status: 200, description: 'Action cycle deleted successfully' })
  async deleteActionCycle(@Request() req, @Param('id') id: string) {
    return this.campaignOrchestrationService.deleteActionCycle(req.user.userId, id);
  }

  // AI DECISION SUPPORT ENDPOINTS
  @Get('campaigns/:id/next-action')
  @ApiOperation({ summary: 'Get AI-recommended next action for campaign' })
  @ApiResponse({ status: 200, description: 'Next action recommendation retrieved successfully' })
  async getNextBestAction(@Request() req, @Param('id') id: string) {
    return this.campaignOrchestrationService.getNextBestAction(req.user.userId, id);
  }

  // METRICS ENDPOINTS
  @Post('campaigns/:id/metrics')
  @ApiOperation({ summary: 'Update campaign metrics' })
  @ApiResponse({ status: 201, description: 'Campaign metrics updated successfully' })
  async updateCampaignMetrics(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { metricType: string; value: number }
  ) {
    return this.campaignOrchestrationService.updateCampaignMetrics(
      req.user.userId,
      id,
      body.metricType,
      body.value
    );
  }

  @Post('action-lanes/:id/metrics')
  @ApiOperation({ summary: 'Update action lane metrics' })
  @ApiResponse({ status: 201, description: 'Action lane metrics updated successfully' })
  async updateLaneMetrics(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { metricType: string; value: number }
  ) {
    return this.campaignOrchestrationService.updateLaneMetrics(
      req.user.userId,
      id,
      body.metricType,
      body.value
    );
  }

  @Get('campaigns/:id/metrics')
  @ApiOperation({ summary: 'Get campaign metrics' })
  @ApiResponse({ status: 200, description: 'Campaign metrics retrieved successfully' })
  async getCampaignMetrics(
    @Request() req,
    @Param('id') id: string,
    @Query('metricType') metricType?: string
  ) {
    return this.campaignOrchestrationService.getCampaignMetrics(req.user.userId, id, metricType);
  }
}
