import { CommandQueueItemStatus } from "@opportunity-os/db";
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export class GetTodayCommandQueueQueryDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  refresh?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class UpdateCommandQueueItemDto {
  @IsOptional()
  @IsEnum(CommandQueueItemStatus)
  status?: CommandQueueItemStatus;

  @IsOptional()
  @IsString()
  deferredUntil?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  completeActionItem?: boolean;

  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown>;
}
