import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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
  'activate_campaign',
  'set_workspace_mode',
  'build_recipient_queue',
  'select_recipient',
  'clear_recipient',
  'draft_discovery_target',
] as const;

console.log('✅ [COMMAND_INIT] WorkspaceCommandDto allowed types:', Array.from(WORKSPACE_COMMAND_TYPES));

export type WorkspaceCommandType = (typeof WORKSPACE_COMMAND_TYPES)[number];

export class WorkspaceCommandDto {
  @IsIn([
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
    'activate_campaign',
    'set_workspace_mode',
    'build_recipient_queue',
    'select_recipient',
    'clear_recipient',
    'draft_discovery_target',
  ])
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
