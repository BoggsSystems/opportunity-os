import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

console.log('[DEBUG] WorkspaceCommandDto module loaded. Allowed types:', [
  'confirm_offering',
  'adjust_offering',
  'reject_offering',
  'start_discovery_scan',
  'accept_discovery_target',
  'reject_discovery_target',
  'promote_discovery_targets',
  'activate_signal',
  'dismiss_signal',
  'dismiss_cycle',
  'complete_cycle',
  'create_task',
  'advance_opportunity',
  'set_workspace_mode',
]);

export const WORKSPACE_COMMAND_TYPES = [
  'confirm_offering',
  'adjust_offering',
  'reject_offering',
  'start_discovery_scan',
  'accept_discovery_target',
  'reject_discovery_target',
  'promote_discovery_targets',
  'activate_signal',
  'dismiss_signal',
  'dismiss_cycle',
  'complete_cycle',
  'create_task',
  'advance_opportunity',
  'set_workspace_mode',
] as const;

export type WorkspaceCommandType = (typeof WORKSPACE_COMMAND_TYPES)[number];

export class WorkspaceCommandDto {
  @IsIn(WORKSPACE_COMMAND_TYPES)
  type: WorkspaceCommandType;

  @IsOptional()
  @IsUUID()
  signalId?: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  reason?: string;
}
