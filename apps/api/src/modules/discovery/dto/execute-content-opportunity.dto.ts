import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ExecuteContentOpportunityDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxTargets?: number = 3;
}
