import { IsString, IsOptional, IsNumber, IsEnum, IsDate, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignStatus, ActionLaneType, ActionLaneStatus, ActionCycleStatus } from '@opportunity-os/db';

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
  campaignId: string;

  @ApiProperty({ description: 'Action lane ID' })
  @IsString()
  actionLaneId: string;

  @ApiProperty({ description: 'Target type' })
  @IsString()
  targetType: string;

  @ApiProperty({ description: 'Target ID' })
  @IsString()
  targetId: string;

  @ApiProperty({ description: 'Execution action type' })
  @IsString()
  actionType: string;

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
}

export class UpdateActionCycleDto {
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

  @ApiPropertyOptional({ description: 'Metadata as JSON' })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, any>;
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
