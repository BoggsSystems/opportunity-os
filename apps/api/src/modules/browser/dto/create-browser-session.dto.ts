import { IsEnum, IsOptional, IsUUID, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BrowserSessionMode {
  OBSERVE = 'observe',
  GUIDE = 'guide',
  ASSIST = 'assist',
  AUTOMATE_PARTIAL = 'automate_partial',
}

export enum BrowserTargetType {
  LINKEDIN_PROFILE = 'linkedin_profile',
  JOB_APPLICATION = 'job_application',
  WEBSITE_FORM = 'website_form',
  COMPANY_PORTAL = 'company_portal',
  RECRUITING_PORTAL = 'recruiting_portal',
  EVENT_SIGNUP = 'event_signup',
  GENERIC_WEB = 'generic_web',
  OTHER = 'other',
}

export class CreateBrowserSessionDto {
  @ApiProperty({
    description: 'User ID creating the session',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Initial mode of the browser session',
    enum: BrowserSessionMode,
    default: BrowserSessionMode.OBSERVE,
  })
  @IsEnum(BrowserSessionMode)
  mode: BrowserSessionMode = BrowserSessionMode.OBSERVE;

  @ApiProperty({
    description: 'Type of target the browser will interact with',
    enum: BrowserTargetType,
    example: BrowserTargetType.JOB_APPLICATION,
  })
  @IsEnum(BrowserTargetType)
  targetType: BrowserTargetType;

  @ApiProperty({
    description: 'Target URL to navigate to',
    example: 'https://www.linkedin.com/jobs/view/123456789',
  })
  @IsUrl()
  targetUrl: string;

  @ApiPropertyOptional({
    description: 'Associated opportunity ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional({
    description: 'Associated task ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    description: 'Session configuration options',
    example: {
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
      headless: false,
    },
  })
  @IsOptional()
  sessionConfig?: Record<string, any>;
}
