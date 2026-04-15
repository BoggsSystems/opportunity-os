import { IsString, IsOptional, IsEnum } from 'class-validator';
import { OfferingType, OfferingStatus } from '@opportunity-os/db';

export class UpdateOfferingDto {
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
  @IsEnum(OfferingStatus)
  status?: OfferingStatus;
}
