import { IsOptional, IsString } from 'class-validator';

export class RejectDiscoveryTargetDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
