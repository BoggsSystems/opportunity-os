import { IsString, IsOptional, IsUrl, IsEnum } from 'class-validator';
import { CompanyType } from '@opportunity-os/db';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  sizeBand?: string;

  @IsOptional()
  @IsString()
  geography?: string;

  @IsOptional()
  @IsEnum(CompanyType)
  companyType?: CompanyType;

  @IsOptional()
  @IsString()
  description?: string;
}
