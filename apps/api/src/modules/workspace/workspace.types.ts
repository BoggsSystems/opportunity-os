import { NextActionItem } from '../next-actions/interfaces/next-action.interface';

export type WorkspaceMode =
  | 'empty'
  | 'signal_review'
  | 'goal_planning'
  | 'campaign_review'
  | 'opportunity_review'
  | 'draft_edit'
  | 'asset_review'
  | 'execution_confirm'
  | 'progress_summary';

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
  signals: WorkspaceSignalSummary[];
  recommendation: NextActionItem | null;
  velocity: WorkspaceVelocitySummary;
}
