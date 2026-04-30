import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export const STORAGE_PROVIDER_NAMES = ['google_drive', 'onedrive', 'dropbox'] as const;

export class SetupStorageConnectorDto {
  @IsIn(STORAGE_PROVIDER_NAMES)
  providerName: (typeof STORAGE_PROVIDER_NAMES)[number];

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
