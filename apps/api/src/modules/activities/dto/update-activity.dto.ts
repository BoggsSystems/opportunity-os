import { IsString, IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';

enum ActivityType {
  LINKEDIN_MESSAGE = 'linkedin_message',
  EMAIL = 'email',
  CALL = 'call',
  INTERVIEW = 'interview',
  APPLICATION_SUBMITTED = 'application_submitted',
  MEETING = 'meeting',
  FOLLOW_UP = 'follow_up',
  NOTE_EVENT = 'note_event',
  OTHER = 'other',
}

export class UpdateActivityDto {
  @IsOptional()
  @IsEnum(ActivityType)
  activityType?: ActivityType;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  bodySummary?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  metadataJson?: any;

  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;
}
