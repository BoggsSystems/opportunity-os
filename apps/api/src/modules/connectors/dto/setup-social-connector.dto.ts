import { IsIn, IsOptional, IsString } from 'class-validator';

export const SOCIAL_PROVIDER_NAMES = ['github'] as const;

export class SetupSocialConnectorDto {
  @IsIn(SOCIAL_PROVIDER_NAMES)
  providerName: (typeof SOCIAL_PROVIDER_NAMES)[number];

  @IsOptional()
  @IsString()
  connectorName?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;
}
