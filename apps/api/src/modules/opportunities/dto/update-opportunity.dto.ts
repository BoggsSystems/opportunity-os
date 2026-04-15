import { IsString, IsOptional, IsEnum, IsNumber, IsUUID } from 'class-validator';

enum OpportunityStage {
  NEW = 'new',
  TARGETED = 'targeted',
  OUTREACH_SENT = 'outreach_sent',
  APPLIED = 'applied',
  CONVERSATION_STARTED = 'conversation_started',
  INTERVIEWING = 'interviewing',
  AWAITING_DECISION = 'awaiting_decision',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost',
}

enum OpportunityType {
  JOB = 'job',
  CONTRACT = 'contract',
  CONSULTING = 'consulting',
  NETWORKING = 'networking',
  OTHER = 'other',
}

export class UpdateOpportunityDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  primaryPersonId?: string;

  @IsOptional()
  @IsEnum(OpportunityType)
  opportunityType?: OpportunityType;

  @IsOptional()
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsNumber()
  fitScore?: number;

  @IsOptional()
  @IsNumber()
  qualificationScore?: number;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  nextAction?: string;

  @IsOptional()
  nextActionDate?: Date;

  @IsOptional()
  @IsNumber()
  estimatedValueCents?: number;

  @IsOptional()
  @IsNumber()
  closeProbability?: number;
}
