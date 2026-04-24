import { NextActionItem } from '../next-actions/interfaces/next-action.interface';

export type WorkspaceMode =
  | 'empty'
  | 'signal_review'
  | 'goal_planning'
  | 'campaign_review'
  | 'discovery_review'
  | 'opportunity_review'
  | 'draft_edit'
  | 'asset_review'
  | 'execution_confirm'
  | 'discovery_scan'
  | 'progress_summary';

export type CanvasAction =
  | 'idle'
  | 'confirm_offering'
  | 'upload_asset'
  | 'review_asset'
  | 'confirm_goal'
  | 'confirm_campaign'
  | 'run_discovery'
  | 'review_discovery_targets'
  | 'review_opportunity'
  | 'draft_email'
  | 'confirm_send'
  | 'complete_cycle';

export type CanvasCommand =
  | 'confirm'
  | 'adjust'
  | 'continue'
  | 'skip'
  | 'upload_asset'
  | 'activate_signal'
  | 'dismiss_signal'
  | 'generate_draft'
  | 'start_discovery_scan'
  | 'accept_discovery_target'
  | 'reject_discovery_target'
  | 'promote_discovery_targets'
  | 'send_email'
  | 'complete_cycle'
  | 'create_task'
  | 'advance_opportunity';

export interface CanvasState {
  action: CanvasAction;
  title: string;
  explanation: string;
  phase: string;
  refs: {
    signalId?: string;
    offeringProposalId?: string;
    offeringId?: string;
    goalId?: string;
    campaignId?: string;
    opportunityId?: string;
    taskId?: string;
    discoveredOpportunityId?: string;
    discoveryScanId?: string;
    discoveryTargetId?: string;
    conversationId?: string;
    draftId?: string;
    assetId?: string;
  };
  allowedActions: CanvasCommand[];
  primaryAction: CanvasCommand | null;
  context: Record<string, unknown> | null;
}

export interface WorkspaceSignalSummary {
  id: string;
  title: string;
  summary: string | null;
  importance: string;
  status: string;
  priorityScore: number;
  reason: string | null;
  recommendedAction: string | null;
  recommendedWorkspaceMode: WorkspaceMode;
  sourceType: string;
  sourceId: string | null;
  createdAt: Date;
}

export interface WorkspaceCycleSummary {
  id: string;
  title: string;
  phase: string;
  status: string;
  workspaceMode: WorkspaceMode;
  whyItMatters: string | null;
  recommendedAction: string | null;
  priorityScore: number;
  confidence: number | null;
  allowedActions: string[];
  refs: {
    signalId?: string;
    offeringId?: string;
    goalId?: string;
    campaignId?: string;
    opportunityId?: string;
    taskId?: string;
    discoveredOpportunityId?: string;
    conversationId?: string;
  };
}

export interface WorkspaceVelocitySummary {
  activeGoalCount: number;
  activeCampaignCount: number;
  activeOpportunityCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  outreachSentThisWeek: number;
  opportunitiesAdvancedThisWeek: number;
  pendingSignalCount: number;
  activeCycleCount: number;
}

export interface WorkspaceState {
  conductor: {
    activeConversationId: string | null;
    suggestedPrompts: string[];
    currentReasoningSummary: string | null;
  };
  activeCycle: WorkspaceCycleSummary | null;
  activeWorkspace: {
    mode: WorkspaceMode;
    allowedActions: string[];
    entity: Record<string, unknown> | null;
  };
  canvas: CanvasState;
  signals: WorkspaceSignalSummary[];
  recommendation: NextActionItem | null;
  velocity: WorkspaceVelocitySummary;
}
