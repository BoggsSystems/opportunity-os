import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class OutreachRecipientDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsString()
  organization: string;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsString()
  role: string;
}

export class SendOutreachDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutreachRecipientDto)
  recipients: OutreachRecipientDto[];

  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;
}
