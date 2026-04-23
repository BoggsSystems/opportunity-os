import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const DISCOVERY_SCAN_TYPES = [
  'companies',
  'people',
  'university_professors',
  'content_signals',
  'mixed',
] as const;

export class CreateDiscoveryScanDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsIn(DISCOVERY_SCAN_TYPES)
  scanType?: (typeof DISCOVERY_SCAN_TYPES)[number];

  @IsOptional()
  @IsString()
  providerKey?: string;

  @IsOptional()
  @IsString()
  targetSegment?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  maxTargets?: number;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
