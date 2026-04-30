import { Body, Controller, Delete, Get, Param, Post, Put, Query, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CampaignOrchestrationService } from './campaign-orchestration.service';
import { 
  CaptureConversationMessageDto,
  ConfirmActionItemDto,
  ConversationFeedbackIntakeDto,
  CreateCampaignDto, 
  CreateConversationThreadDto,
  UpdateCampaignDto,
  CreateActionLaneDto,
  UpdateActionLaneDto,
  CreateActionCycleDto,
  UpdateActionCycleDto,
  CreateActionItemDto,
  FinalizeOnboardingPlanDto,
  SynthesizeConversationThreadDto,
  UpdateActionItemDto,
} from './dto/campaign.dto';

@ApiTags('campaign-orchestration')
@Controller('campaign-orchestration')
export class CampaignOrchestrationController {
  constructor(private readonly campaignOrchestrationService: CampaignOrchestrationService) {}

  @Post('onboarding/finalize')
  @ApiOperation({ summary: 'Persist an onboarding plan into campaigns, action lanes, and the first action cycle' })
  @ApiResponse({ status: 201, description: 'Onboarding plan persisted successfully' })
  async finalizeOnboardingPlan(
    @Body() finalizeDto: FinalizeOnboardingPlanDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.finalizeOnboardingPlan(user.id, finalizeDto);
  }

  // CAMPAIGN ENDPOINTS
  @Post('campaigns')
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created successfully' })
  async createCampaign(@Body() createCampaignDto: CreateCampaignDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.createCampaign(user.id, createCampaignDto);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'List user campaigns' })
  @ApiResponse({ status: 200, description: 'Campaigns retrieved successfully' })
  async listCampaigns(
    @Query('status') status?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.listCampaigns(user.id, status as any);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get campaign details' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved successfully' })
  async getCampaign(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getCampaign(user.id, id);
  }

  @Put('campaigns/:id')
  @ApiOperation({ summary: 'Update campaign' })
  @ApiResponse({ status: 200, description: 'Campaign updated successfully' })
  async updateCampaign(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.updateCampaign(user.id, id, updateCampaignDto);
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete campaign' })
  @ApiResponse({ status: 200, description: 'Campaign deleted successfully' })
  async deleteCampaign(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.deleteCampaign(user.id, id);
  }

  // ACTION LANE ENDPOINTS
  @Post('action-lanes')
  @ApiOperation({ summary: 'Create a new action lane' })
  @ApiResponse({ status: 201, description: 'Action lane created successfully' })
  async createActionLane(@Body() createActionLaneDto: CreateActionLaneDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.createActionLane(user.id, createActionLaneDto);
  }

  @Get('action-lanes')
  @ApiOperation({ summary: 'List action lanes' })
  @ApiResponse({ status: 200, description: 'Action lanes retrieved successfully' })
  async listActionLanes(
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.listActionLanes(
      user.id,
      campaignId,
      status as any
    );
  }

  @Get('action-lanes/:id')
  @ApiOperation({ summary: 'Get action lane details' })
  @ApiResponse({ status: 200, description: 'Action lane retrieved successfully' })
  async getActionLane(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getActionLane(user.id, id);
  }

  @Put('action-lanes/:id')
  @ApiOperation({ summary: 'Update action lane' })
  @ApiResponse({ status: 200, description: 'Action lane updated successfully' })
  async updateActionLane(
    @Param('id') id: string,
    @Body() updateActionLaneDto: UpdateActionLaneDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.updateActionLane(user.id, id, updateActionLaneDto);
  }

  @Delete('action-lanes/:id')
  @ApiOperation({ summary: 'Delete action lane' })
  @ApiResponse({ status: 200, description: 'Action lane deleted successfully' })
  async deleteActionLane(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.deleteActionLane(user.id, id);
  }

  // ACTION CYCLE ENDPOINTS
  @Post('action-cycles')
  @ApiOperation({ summary: 'Create a new action cycle' })
  @ApiResponse({ status: 201, description: 'Action cycle created successfully' })
  async createActionCycle(@Body() createActionCycleDto: CreateActionCycleDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.createActionCycle(user.id, createActionCycleDto);
  }

  @Get('action-cycles')
  @ApiOperation({ summary: 'List action cycles' })
  @ApiResponse({ status: 200, description: 'Action cycles retrieved successfully' })
  async listActionCycles(
    @Query('campaignId') campaignId?: string,
    @Query('actionLaneId') actionLaneId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.listActionCycles(
      user.id,
      campaignId,
      actionLaneId,
      status as any
    );
  }

  @Get('action-cycles/:id')
  @ApiOperation({ summary: 'Get action cycle details' })
  @ApiResponse({ status: 200, description: 'Action cycle retrieved successfully' })
  async getActionCycle(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getActionCycle(user.id, id);
  }

  @Put('action-cycles/:id')
  @ApiOperation({ summary: 'Update action cycle' })
  @ApiResponse({ status: 200, description: 'Action cycle updated successfully' })
  async updateActionCycle(
    @Param('id') id: string,
    @Body() updateActionCycleDto: UpdateActionCycleDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.updateActionCycle(user.id, id, updateActionCycleDto);
  }

  @Delete('action-cycles/:id')
  @ApiOperation({ summary: 'Delete action cycle' })
  @ApiResponse({ status: 200, description: 'Action cycle deleted successfully' })
  async deleteActionCycle(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.deleteActionCycle(user.id, id);
  }

  // ACTION ITEM ENDPOINTS
  @Post('action-items')
  @ApiOperation({ summary: 'Create a concrete action item' })
  @ApiResponse({ status: 201, description: 'Action item created successfully' })
  async createActionItem(@Body() createActionItemDto: CreateActionItemDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.createActionItem(user.id, createActionItemDto);
  }

  @Get('action-items')
  @ApiOperation({ summary: 'List concrete action items' })
  @ApiResponse({ status: 200, description: 'Action items retrieved successfully' })
  async listActionItems(
    @Query('campaignId') campaignId?: string,
    @Query('actionLaneId') actionLaneId?: string,
    @Query('actionCycleId') actionCycleId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.listActionItems(user.id, {
      campaignId,
      actionLaneId,
      actionCycleId,
      status: status as any,
    });
  }

  @Get('action-items/:id')
  @ApiOperation({ summary: 'Get action item details' })
  @ApiResponse({ status: 200, description: 'Action item retrieved successfully' })
  async getActionItem(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getActionItem(user.id, id);
  }

  @Get('action-items/:id/canvas')
  @ApiOperation({ summary: 'Get action-specific Canvas payload for an action item' })
  @ApiResponse({ status: 200, description: 'Action Canvas payload retrieved successfully' })
  async getActionItemCanvas(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getActionItemCanvas(user.id, id);
  }

  @Put('action-items/:id')
  @ApiOperation({ summary: 'Update action item' })
  @ApiResponse({ status: 200, description: 'Action item updated successfully' })
  async updateActionItem(
    @Param('id') id: string,
    @Body() updateActionItemDto: UpdateActionItemDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.updateActionItem(user.id, id, updateActionItemDto);
  }

  @Post('action-items/:id/confirm')
  @ApiOperation({ summary: 'Confirm a manually or externally completed action item and log an activity' })
  @ApiResponse({ status: 200, description: 'Action item confirmed successfully' })
  async confirmActionItem(
    @Param('id') id: string,
    @Body() confirmActionItemDto: ConfirmActionItemDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.confirmActionItem(user.id, id, confirmActionItemDto);
  }

  @Delete('action-items/:id')
  @ApiOperation({ summary: 'Delete action item' })
  @ApiResponse({ status: 200, description: 'Action item deleted successfully' })
  async deleteActionItem(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.deleteActionItem(user.id, id);
  }

  // CONVERSATION FEEDBACK LOOP ENDPOINTS
  @Post('conversation-threads')
  @ApiOperation({ summary: 'Create a durable conversation or engagement feedback thread' })
  @ApiResponse({ status: 201, description: 'Conversation thread created successfully' })
  async createConversationThread(
    @Body() createConversationThreadDto: CreateConversationThreadDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.createConversationThread(user.id, createConversationThreadDto);
  }

  @Get('conversation-threads/:id')
  @ApiOperation({ summary: 'Get a conversation feedback thread with messages and insights' })
  @ApiResponse({ status: 200, description: 'Conversation thread retrieved successfully' })
  async getConversationThread(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getConversationThread(user.id, id);
  }

  @Post('action-items/:id/conversation-thread')
  @ApiOperation({ summary: 'Get or create the feedback thread attached to an action item' })
  @ApiResponse({ status: 201, description: 'Conversation thread available' })
  async getOrCreateActionItemConversationThread(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getOrCreateActionItemConversationThread(user.id, id);
  }

  @Post('conversation-threads/:id/messages')
  @ApiOperation({ summary: 'Capture a pasted, uploaded, screenshot, or synced message into a feedback thread' })
  @ApiResponse({ status: 201, description: 'Conversation message captured successfully' })
  async captureConversationMessage(
    @Param('id') id: string,
    @Body() captureConversationMessageDto: CaptureConversationMessageDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.captureConversationMessage(user.id, id, captureConversationMessageDto);
  }

  @Post('conversation-threads/:id/synthesize')
  @ApiOperation({ summary: 'Synthesize conversation feedback into sentiment, insight, and optional next action' })
  @ApiResponse({ status: 201, description: 'Conversation synthesized successfully' })
  async synthesizeConversationThread(
    @Param('id') id: string,
    @Body() synthesizeConversationThreadDto: SynthesizeConversationThreadDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.synthesizeConversationThread(user.id, id, synthesizeConversationThreadDto);
  }

  @Post('conversation-feedback/intake')
  @ApiOperation({ summary: 'Conductor intake for pasted or screenshot conversation feedback with attribution candidates' })
  @ApiResponse({ status: 201, description: 'Conversation feedback captured or attribution candidates returned' })
  async intakeConversationFeedback(
    @Body() intakeDto: ConversationFeedbackIntakeDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.intakeConversationFeedback(user.id, intakeDto);
  }

  // AI DECISION SUPPORT ENDPOINTS
  @Get('campaigns/:id/next-action')
  @ApiOperation({ summary: 'Get AI-recommended next action for campaign' })
  @ApiResponse({ status: 200, description: 'Next action recommendation retrieved successfully' })
  async getNextBestAction(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getNextBestAction(user.id, id);
  }

  // METRICS ENDPOINTS
  @Post('campaigns/:id/metrics')
  @ApiOperation({ summary: 'Update campaign metrics' })
  @ApiResponse({ status: 201, description: 'Campaign metrics updated successfully' })
  async updateCampaignMetrics(
    @Param('id') id: string,
    @Body() body: { metricType: string; value: number },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.updateCampaignMetrics(
      user.id,
      id,
      body.metricType,
      body.value
    );
  }

  @Post('action-lanes/:id/metrics')
  @ApiOperation({ summary: 'Update action lane metrics' })
  @ApiResponse({ status: 201, description: 'Action lane metrics updated successfully' })
  async updateLaneMetrics(
    @Param('id') id: string,
    @Body() body: { metricType: string; value: number },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.updateLaneMetrics(
      user.id,
      id,
      body.metricType,
      body.value
    );
  }

  @Get('campaigns/:id/metrics')
  @ApiOperation({ summary: 'Get campaign metrics' })
  @ApiResponse({ status: 200, description: 'Campaign metrics retrieved successfully' })
  async getCampaignMetrics(
    @Param('id') id: string,
    @Query('metricType') metricType?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.campaignOrchestrationService.getCampaignMetrics(user.id, id, metricType);
  }
}
