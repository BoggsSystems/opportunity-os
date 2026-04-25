import { PartialType } from '@nestjs/swagger';
import { CreateBrowserSessionDto } from './create-browser-session.dto';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum BrowserSessionStatus {
  CREATED = 'created',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export class UpdateBrowserSessionDto extends PartialType(CreateBrowserSessionDto) {
  @IsOptional()
  @IsEnum(BrowserSessionStatus)
  status?: BrowserSessionStatus;

  @IsOptional()
  @IsString()
  currentUrl?: string;

  @IsOptional()
  @IsString()
  currentPageTitle?: string;

  @IsOptional()
  stepIndex?: number;

  @IsOptional()
  aiAnalysis?: Record<string, any>;
}
