import { IsString, IsOptional, IsEnum } from 'class-validator';
import { OfferingType } from '@opportunity-os/db';

export class CreateOfferingDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(OfferingType)
  offeringType: OfferingType;
}
