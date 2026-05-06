import { IsArray, IsBoolean, IsDate, IsEnum, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActionCycleStatus,
  ActionItemConfirmationSource,
  ActionItemStatus,
  ActionLaneStatus,
  ActionLaneType,
  CampaignStatus,
  ConversationMessageDirection,
  ConversationMessageSource,
} from '@opportunity-os/db';

// CAMPAIGN DTOs
export class CreateCampaignDto {
  @ApiProperty({ description: 'Campaign title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Campaign description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Campaign objective' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Success definition' })
  @IsOptional()
  @IsString()
  successDefinition?: string;

  @ApiPropertyOptional({ description: 'Campaign strategic angle' })
  @IsOptional()
  @IsString()
  strategicAngle?: string;

  @ApiPropertyOptional({ description: 'Campaign target segment' })
  @IsOptional()
  @IsString()
  targetSegment?: string;

  @ApiPropertyOptional({ description: 'Campaign timeframe start' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timeframeStart?: Date;

  @ApiPropertyOptional({ description: 'Campaign timeframe end' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timeframeEnd?: Date;

  @ApiPropertyOptional({ description: 'Associated offering ID' })
  @IsOptional()
  @IsString()
  offeringId?: string;

  @ApiPropertyOptional({ description: 'Associated goal ID' })
  @IsOptional()
  @IsString()
  goalId?: string;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional({ description: 'Campaign title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Campaign description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Campaign objective' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Success definition' })
  @IsOptional()
  @IsString()
  successDefinition?: string;

  @ApiPropertyOptional({ description: 'Campaign strategic angle' })
  @IsOptional()
  @IsString()
  strategicAngle?: string;

  @ApiPropertyOptional({ description: 'Campaign target segment' })
  @IsOptional()
  @IsString()
  targetSegment?: string;

  @ApiPropertyOptional({ description: 'Campaign timeframe start' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timeframeStart?: Date;

  @ApiPropertyOptional({ description: 'Campaign timeframe end' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timeframeEnd?: Date;

  @ApiPropertyOptional({ description: 'Campaign status', enum: CampaignStatus })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;

  @ApiPropertyOptional({ description: 'Campaign metrics as JSON' })
  @IsOptional()
  @IsObject()
  metricsJson?: Record<string, any>;
}

// ACTION LANE DTOs
export class CreateActionLaneDto {
  @ApiProperty({ description: 'Campaign ID' })
  @IsString()
  campaignId?: string;

  @ApiProperty({ description: 'Lane type', enum: ActionLaneType })
  @IsEnum(ActionLaneType)
  laneType: ActionLaneType;

  @ApiProperty({ description: 'Lane title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Lane description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Lane strategy' })
  @IsOptional()
  @IsString()
  strategy?: string;

  @ApiPropertyOptional({ description: 'Cadence configuration as JSON' })
  @IsOptional()
  @IsObject()
  cadenceJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Target criteria as JSON' })
  @IsOptional()
  @IsObject()
  targetCriteriaJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;
}

export class UpdateActionLaneDto {
  @ApiPropertyOptional({ description: 'Lane title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Lane description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Lane strategy' })
  @IsOptional()
  @IsString()
  strategy?: string;

  @ApiPropertyOptional({ description: 'Cadence configuration as JSON' })
  @IsOptional()
  @IsObject()
  cadenceJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Target criteria as JSON' })
  @IsOptional()
  @IsObject()
  targetCriteriaJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Lane status', enum: ActionLaneStatus })
  @IsOptional()
  @IsEnum(ActionLaneStatus)
  status?: ActionLaneStatus;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;

  @ApiPropertyOptional({ description: 'Lane metrics as JSON' })
  @IsOptional()
  @IsObject()
  metricsJson?: Record<string, any>;
}

// ACTION CYCLE DTOs
export class CreateActionCycleDto {
  @ApiPropertyOptional({ description: 'Campaign ID. Optional compatibility field; the canonical campaign is derived from the action lane.' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiProperty({ description: 'Action lane ID' })
  @IsString()
  actionLaneId: string;

  @ApiPropertyOptional({ description: 'Cycle number within this campaign/lane' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cycleNumber?: number;

  @ApiPropertyOptional({ description: 'Cycle title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Cycle objective' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Legacy/context target type' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'Legacy/context target ID' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Legacy/context execution action type' })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional({ description: 'Cycle status', enum: ActionCycleStatus })
  @IsOptional()
  @IsEnum(ActionCycleStatus)
  status?: ActionCycleStatus;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;

  @ApiPropertyOptional({ description: 'Execution data as JSON' })
  @IsOptional()
  @IsObject()
  executionDataJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'AI-generated reasoning as JSON' })
  @IsOptional()
  @IsObject()
  generatedReasoningJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Cycle start time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startsAt?: Date;

  @ApiPropertyOptional({ description: 'Cycle end time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endsAt?: Date;
}

export class UpdateActionCycleDto {
  @ApiPropertyOptional({ description: 'Cycle number within this campaign/lane' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cycleNumber?: number;

  @ApiPropertyOptional({ description: 'Cycle title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Cycle objective' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Execution record status', enum: ActionCycleStatus })
  @IsOptional()
  @IsEnum(ActionCycleStatus)
  status?: ActionCycleStatus;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;

  @ApiPropertyOptional({ description: 'Execution data as JSON' })
  @IsOptional()
  @IsObject()
  executionDataJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Outcome data as JSON' })
  @IsOptional()
  @IsObject()
  outcomeDataJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'AI-generated reasoning as JSON' })
  @IsOptional()
  @IsObject()
  generatedReasoningJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Metadata as JSON' })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Cycle start time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startsAt?: Date;

  @ApiPropertyOptional({ description: 'Cycle end time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endsAt?: Date;
}

// ACTION ITEM DTOs
export class CreateActionItemDto {
  @ApiProperty({ description: 'Action lane ID' })
  @IsString()
  actionLaneId: string;

  @ApiPropertyOptional({ description: 'Action cycle ID' })
  @IsOptional()
  @IsString()
  actionCycleId?: string;

  @ApiPropertyOptional({ description: 'Generic target type' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'Generic target ID' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Target person ID' })
  @IsOptional()
  @IsString()
  targetPersonId?: string;

  @ApiPropertyOptional({ description: 'Target company ID' })
  @IsOptional()
  @IsString()
  targetCompanyId?: string;

  @ApiProperty({ description: 'Concrete action type, e.g. linkedin_dm, send_email, publish_post' })
  @IsString()
  actionType: string;

  @ApiProperty({ description: 'Action item title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'User-facing execution instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Generated draft content' })
  @IsOptional()
  @IsString()
  draftContent?: string;

  @ApiPropertyOptional({ description: 'Final edited content' })
  @IsOptional()
  @IsString()
  finalContent?: string;

  @ApiPropertyOptional({ description: 'External URL to open, such as LinkedIn profile/search' })
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional({ description: 'External provider key, such as linkedin, gmail, outlook' })
  @IsOptional()
  @IsString()
  externalProvider?: string;

  @ApiPropertyOptional({ description: 'Action item status', enum: ActionItemStatus })
  @IsOptional()
  @IsEnum(ActionItemStatus)
  status?: ActionItemStatus;

  @ApiPropertyOptional({ description: 'Whether user/provider confirmation is required' })
  @IsOptional()
  @IsBoolean()
  confirmationRequired?: boolean;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;

  @ApiPropertyOptional({ description: 'Due date/time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueAt?: Date;

  @ApiPropertyOptional({ description: 'Metadata as JSON' })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;
}

export class UpdateActionItemDto {
  @ApiPropertyOptional({ description: 'Action item title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'User-facing execution instructions' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Generated draft content' })
  @IsOptional()
  @IsString()
  draftContent?: string;

  @ApiPropertyOptional({ description: 'Final edited content' })
  @IsOptional()
  @IsString()
  finalContent?: string;

  @ApiPropertyOptional({ description: 'External URL to open' })
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional({ description: 'Action item status', enum: ActionItemStatus })
  @IsOptional()
  @IsEnum(ActionItemStatus)
  status?: ActionItemStatus;

  @ApiPropertyOptional({ description: 'Confirmation source', enum: ActionItemConfirmationSource })
  @IsOptional()
  @IsEnum(ActionItemConfirmationSource)
  confirmationSource?: ActionItemConfirmationSource;

  @ApiPropertyOptional({ description: 'Priority score (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priorityScore?: number;

  @ApiPropertyOptional({ description: 'Due date/time' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueAt?: Date;

  @ApiPropertyOptional({ description: 'Metadata as JSON' })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;
}

class OnboardingCampaignInputDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  laneTitle?: string;

  @IsOptional()
  @IsString()
  targetSegment?: string;

  @IsOptional()
  @IsString()
  goalMetric?: string;

  @IsOptional()
  @IsString()
  messagingHook?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString({ each: true })
  channels?: string[];
}

class OnboardingActionLaneInputDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsArray()
  campaignIds?: string[];

  @IsOptional()
  @IsArray()
  tactics?: string[];

  @IsOptional()
  @IsArray()
  requiredConnectors?: string[];
}

class OnboardingActivationSelectionDto {
  @IsString()
  campaignId: string;

  @IsString()
  laneId: string;
}

export class FinalizeOnboardingPlanDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingCampaignInputDto)
  campaigns: OnboardingCampaignInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingActionLaneInputDto)
  actionLanes: OnboardingActionLaneInputDto[];

  @IsArray()
  selectedCampaignIds: string[];

  @IsArray()
  selectedActionLaneIds: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingActivationSelectionDto)
  activationSelection?: OnboardingActivationSelectionDto;

  @IsOptional()
  @IsString()
  comprehensiveSynthesis?: string;
}

export class ConfirmActionItemDto {
  @ApiPropertyOptional({ description: 'Final content actually sent/published' })
  @IsOptional()
  @IsString()
  finalContent?: string;

  @ApiPropertyOptional({ description: 'Confirmation source', enum: ActionItemConfirmationSource })
  @IsOptional()
  @IsEnum(ActionItemConfirmationSource)
  confirmationSource?: ActionItemConfirmationSource;

  @ApiPropertyOptional({ description: 'Outcome text' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional({ description: 'When the action occurred' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  occurredAt?: Date;
}

export class CreateConversationThreadDto {
  @ApiPropertyOptional({ description: 'Campaign ID' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Action lane ID' })
  @IsOptional()
  @IsString()
  actionLaneId?: string;

  @ApiPropertyOptional({ description: 'Action cycle ID' })
  @IsOptional()
  @IsString()
  actionCycleId?: string;

  @ApiPropertyOptional({ description: 'Action item ID' })
  @IsOptional()
  @IsString()
  actionItemId?: string;

  @ApiPropertyOptional({ description: 'Target person ID' })
  @IsOptional()
  @IsString()
  targetPersonId?: string;

  @ApiPropertyOptional({ description: 'Target company ID' })
  @IsOptional()
  @IsString()
  targetCompanyId?: string;

  @ApiProperty({ description: 'Conversation channel, such as linkedin_dm, linkedin_post, youtube_comment, email' })
  @IsString()
  channel: string;

  @ApiPropertyOptional({ description: 'External provider key, such as linkedin, outlook, youtube' })
  @IsOptional()
  @IsString()
  externalProvider?: string;

  @ApiPropertyOptional({ description: 'External conversation URL' })
  @IsOptional()
  @IsString()
  externalThreadUrl?: string;

  @ApiPropertyOptional({ description: 'Metadata as JSON' })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;
}

export class CaptureConversationMessageDto {
  @ApiPropertyOptional({ description: 'Message direction', enum: ConversationMessageDirection })
  @IsOptional()
  @IsEnum(ConversationMessageDirection)
  direction?: ConversationMessageDirection;

  @ApiPropertyOptional({ description: 'Capture source', enum: ConversationMessageSource })
  @IsOptional()
  @IsEnum(ConversationMessageSource)
  source?: ConversationMessageSource;

  @ApiPropertyOptional({ description: 'Pasted or extracted message text' })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({ description: 'Image/file URLs captured for this message' })
  @IsOptional()
  @IsArray()
  attachmentUrls?: string[];

  @ApiPropertyOptional({ description: 'Attachment MIME types aligned with attachmentUrls' })
  @IsOptional()
  @IsArray()
  attachmentMimeTypes?: string[];

  @ApiPropertyOptional({ description: 'When the message occurred' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  occurredAt?: Date;

  @ApiPropertyOptional({ description: 'Metadata as JSON' })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;
}

export class SynthesizeConversationThreadDto {
  @ApiPropertyOptional({ description: 'Whether to create a suggested follow-up action item' })
  @IsOptional()
  @IsBoolean()
  createSuggestedAction?: boolean;
}

export class ConversationFeedbackIntakeDto {
  @ApiPropertyOptional({ description: 'Natural language user instruction, e.g. "I got this response"' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Pasted reply/comment text' })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({ description: 'Captured screenshot/image/file URLs' })
  @IsOptional()
  @IsArray()
  attachmentUrls?: string[];

  @ApiPropertyOptional({ description: 'Attachment MIME types aligned with attachmentUrls' })
  @IsOptional()
  @IsArray()
  attachmentMimeTypes?: string[];

  @ApiPropertyOptional({ description: 'Channel hint, such as linkedin_dm, linkedin_post, email, youtube_comment' })
  @IsOptional()
  @IsString()
  channelHint?: string;

  @ApiPropertyOptional({ description: 'Campaign ID hint' })
  @IsOptional()
  @IsString()
  campaignIdHint?: string;

  @ApiPropertyOptional({ description: 'Action item ID hint' })
  @IsOptional()
  @IsString()
  actionItemIdHint?: string;

  @ApiPropertyOptional({ description: 'Conversation thread ID hint' })
  @IsOptional()
  @IsString()
  threadIdHint?: string;

  @ApiPropertyOptional({ description: 'Person/contact name hint' })
  @IsOptional()
  @IsString()
  personHint?: string;

  @ApiPropertyOptional({ description: 'Company/account name hint' })
  @IsOptional()
  @IsString()
  companyHint?: string;

  @ApiPropertyOptional({ description: 'Whether to create a suggested follow-up action item after synthesis' })
  @IsOptional()
  @IsBoolean()
  createSuggestedAction?: boolean;
}

// METRICS DTOs
export class UpdateMetricsDto {
  @ApiProperty({ description: 'Metric type' })
  @IsString()
  metricType: string;

  @ApiProperty({ description: 'Metric value' })
  @IsNumber()
  value: number;
}

// RESPONSE DTOs
export class NextActionResponseDto {
  @ApiProperty({ description: 'AI recommendation' })
  recommendation: string;

  @ApiPropertyOptional({ description: 'Next action details' })
  nextAction?: {
    campaign: any;
    actionLane: any;
    actionCycle: any;
    confidence: number;
    alternativeLanes: Array<{
      lane: any;
      score: number;
      recommendation: string;
    }>;
  };
}
