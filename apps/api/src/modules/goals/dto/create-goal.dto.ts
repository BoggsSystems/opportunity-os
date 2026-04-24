import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { GoalStatus } from '@opportunity-os/db';

export class CreateGoalDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  offeringId?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
