import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export const EMAIL_PROVIDER_NAMES = ['gmail', 'outlook'] as const;

export class SetupEmailConnectorDto {
  @IsIn(EMAIL_PROVIDER_NAMES)
  providerName: (typeof EMAIL_PROVIDER_NAMES)[number];

  @IsOptional()
  @IsString()
  connectorName?: string;

  @IsOptional()
  @IsString()
  emailAddress?: string;

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
