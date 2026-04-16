import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadContentDto {
  file: any;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
