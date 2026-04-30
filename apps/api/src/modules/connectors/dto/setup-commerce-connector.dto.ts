import { IsIn, IsOptional, IsString } from 'class-validator';

export const COMMERCE_PROVIDER_NAMES = ['shopify'] as const;

export class SetupCommerceConnectorDto {
  @IsIn(COMMERCE_PROVIDER_NAMES)
  providerName: (typeof COMMERCE_PROVIDER_NAMES)[number];

  @IsOptional()
  @IsString()
  connectorName?: string;

  @IsString()
  storeName: string;

  @IsString()
  accessToken: string;
}
