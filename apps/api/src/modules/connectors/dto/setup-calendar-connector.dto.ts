import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export const CALENDAR_PROVIDER_NAMES = ['google_calendar', 'outlook'] as const;

export class SetupCalendarConnectorDto {
  @IsIn(CALENDAR_PROVIDER_NAMES)
  providerName: (typeof CALENDAR_PROVIDER_NAMES)[number];

  @IsOptional()
  @IsString()
  connectorName?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
