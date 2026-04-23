import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { OfferingType } from '@opportunity-os/db';

export class UpdateOfferingProposalDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(OfferingType)
  offeringType?: OfferingType;

  @IsOptional()
  @IsArray()
  targetAudiences?: string[];

  @IsOptional()
  @IsString()
  problemSolved?: string;

  @IsOptional()
  @IsString()
  outcomeCreated?: string;

  @IsOptional()
  @IsString()
  credibility?: string;

  @IsOptional()
  @IsString()
  bestOutreachAngle?: string;

  @IsOptional()
  @IsArray()
  suggestedAssets?: string[];

  @IsOptional()
  @IsObject()
  positioning?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
