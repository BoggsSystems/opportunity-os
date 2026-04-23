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

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  session: { id: string };
  subscription?: SubscriptionSummary;
  entitlements?: EntitlementSummary[];
}

export interface SubscriptionSummary {
  id: string;
  status: string;
  plan: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    monthlyPriceCents?: number | null;
    annualPriceCents?: number | null;
    currency?: string | null;
  };
}

export interface EntitlementSummary {
  featureKey: string;
  enabled: boolean;
  limit: number | null;
  used?: number;
  remaining?: number | null;
  resetAt?: string | null;
}

export interface UsageSummary {
  planCode?: string;
  planName?: string;
  usage?: EntitlementSummary[];
  growthCredits?: Array<{
    id: string;
    featureKey: string;
    remainingQuantity: number;
    expiresAt?: string | null;
  }>;
}

export interface CapabilityCheckResult {
  allowed: boolean;
  featureKey: string;
  used?: number;
  remaining?: number | null;
  upgradeReason?: string;
  upgradeHint?: string;
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
  createdAt: string;
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

export interface NextActionRecommendation {
  title: string;
  type: string;
  reason?: string;
  recommendedAction?: string;
  priorityScore?: number;
  opportunityId?: string;
  taskId?: string;
  aiExplanation?: string;
  offeringRelevance?: string;
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
  recommendation: NextActionRecommendation | null;
  velocity: WorkspaceVelocitySummary;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export interface DraftRecipient {
  id?: string;
  name: string;
  organization: string;
  email?: string | null;
  role: string;
}

export interface OutreachDraft {
  id?: string;
  subject: string;
  body: string;
  recipients: DraftRecipient[];
  opportunityId?: string;
  companyId?: string;
  personId?: string;
}

export interface StrategicPlanResult {
  success: boolean;
  goal: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    offeringId?: string | null;
  };
  campaign: {
    id: string;
    title: string;
    strategicAngle: string | null;
    targetSegment: string | null;
    status: string;
    offeringId?: string | null;
  };
  extractedIntent: {
    focusArea: string;
    opportunityType: string;
    targetAudience: string;
    firstCycleTitle: string;
    firstCycleSteps: string[];
    firstDraftPrompt: string;
  };
}
