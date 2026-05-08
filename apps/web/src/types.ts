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
    actionLaneId?: string;
    actionCycleId?: string;
    actionItemId?: string;
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

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  monthlyPriceCents: number;
  annualPriceCents: number;
  currency: string;
  features: Array<{
    key: string;
    accessLevel: string;
    limit?: number | null;
  }>;
}

export interface ReferralLinkSummary {
  id: string;
  code: string;
  label?: string | null;
  url: string;
  campaignSource?: string | null;
}

export interface CommercialState {
  subscription: SubscriptionSummary;
  entitlements: {
    planCode: string;
    planName: string;
    entitlements: Array<{
      key: string;
      accessLevel: string;
      usage: {
        used: number;
        credited: number;
        limit: number | null;
        remaining: number | null;
      };
    }>;
  };
  usage: UsageSummary;
  referral: ReferralLinkSummary;
  billing: {
    provider: string;
    checkoutConfigured: boolean;
  };
  bypass: {
    enabled: boolean;
    source?: string | null;
  };
}

export interface CheckoutSession {
  provider: string;
  plan: {
    code: string;
    name: string;
    monthlyPriceCents: number;
    annualPriceCents: number;
  };
  interval: string;
  checkoutUrl: string;
  mode: string;
}

export interface AdminOverview {
  users: {
    total: number;
    activated: number;
    firstActionCompleted: number;
    paid: number;
  };
  activation: {
    activationRate: number;
    firstActionCompletionRate: number;
  };
  connectors: {
    usersWithConnectedConnectors: number;
    adoptionRate: number;
  };
  campaigns: {
    total: number;
    completedActions: number;
  };
  operations: {
    openIssues: number;
  };
}

export interface AdminFunnel {
  totalUsers: number;
  stages: Array<{
    stage: string;
    current: number;
    reached: number;
    dropoffFromPrevious: number;
    conversionFromPrevious: number;
  }>;
  currentStageCounts: Record<string, number>;
  furthestStageCounts: Record<string, number>;
}

export interface AdminUsersResult {
  users: Array<any>;
  nextCursor: string | null;
}

export interface AdminCampaignAnalytics {
  totals: {
    campaigns: number;
    actionItems: number;
  };
  campaignStatus: Array<any>;
  laneStatus: Array<any>;
  cycleStatus: Array<any>;
  actionStatus: Array<any>;
}

export interface AdminConnectorAnalytics {
  statusCounts: Array<any>;
  providerStatusCounts: Array<any>;
  recentFailures: Array<any>;
}

export interface AdminBillingReferralAnalytics {
  planDistribution: Array<any>;
  referrals: {
    visits: number;
    attributions: number;
    paidConversions: number;
    milestones: Array<any>;
    rewards: Array<any>;
  };
}

export interface AdminMetricSnapshots {
  scope: string;
  snapshots: Array<any>;
  count: number;
  metricKeys: readonly string[];
}

export interface AdminOperationalIssues {
  issues: Array<any>;
}

export type OfferingType =
  | 'product'
  | 'service'
  | 'consulting'
  | 'advisory_program'
  | 'book'
  | 'content_series'
  | 'software'
  | 'platform'
  | 'event'
  | 'job_profile'
  | 'role_candidacy'
  | 'other';
export type OfferingStatus = 'draft' | 'active' | 'inactive' | 'archived';

export interface OfferingSummary {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  offeringType: OfferingType;
  status: OfferingStatus;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' | string;

export interface CampaignSummary {
  id: string;
  userId?: string;
  title: string;
  description?: string | null;
  objective?: string | null;
  successDefinition?: string | null;
  strategicAngle?: string | null;
  targetSegment?: string | null;
  status: CampaignStatus;
  offeringId?: string | null;
  goalId?: string | null;
  priorityScore?: number | null;
  createdAt?: string;
  updatedAt?: string;
  offering?: Pick<OfferingSummary, 'id' | 'title' | 'offeringType'> | null;
  goal?: { id: string; title: string } | null;
  _count?: {
    actionLanes?: number;
    actionCycles?: number;
    actionItems?: number;
  };
  actionLanes?: Array<any>;
}

export interface OfferingPositioningSummary {
  id: string;
  offeringId: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferingAssetSummary {
  id: string;
  offeringId: string;
  offeringPositioningId: string | null;
  title: string;
  description: string | null;
  assetType: string;
  contentUrl: string | null;
  contentText: string | null;
  isPublic: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryContentSummary {
  id: string;
  displayName: string;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentUploadResult {
  discoveredItemId: string;
  title: string;
  source: string;
  offeringId?: string;
  summary: string;
  whyItMatters: string;
  leverageInterpretation: string;
  aiInterpretationSucceeded: boolean;
  processingStatus: string;
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
    actionLaneId?: string;
    actionCycleId?: string;
    actionItemId?: string;
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
  canvas?: CanvasState;
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

export interface CampaignProspectSummary {
  id: string;
  title: string;
  stage: string;
  status?: string | null;
  companyId: string;
  companyName: string;
  primaryPersonId?: string | null;
  primaryPersonName?: string | null;
  primaryPersonTitle?: string | null;
  primaryPersonEmail?: string | null;
  fitScore?: number | null;
  qualificationScore?: number | null;
  summary?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
  lastActivityAt?: string | null;
  lastEmailAt?: string | null;
  openTaskCount: number;
  openFollowUpTask?: { id: string; title: string; dueAt?: string | null } | null;
}

export interface CampaignWorkspace {
  campaign: {
    id: string;
    title: string;
    strategicAngle?: string | null;
    targetSegment?: string | null;
    status: string;
    offeringId?: string | null;
    goalId: string;
    offering?: Record<string, unknown> | null;
    goal?: Record<string, unknown> | null;
  };
  prospects: CampaignProspectSummary[];
  targetQueue: CampaignTargetQueueItemSummary[];
  queues: {
    draft: CampaignProspectSummary[];
    followUp: CampaignProspectSummary[];
    tasks: CampaignProspectSummary[];
  };
  metrics: {
    prospectCount: number;
    draftQueueCount: number;
    followUpQueueCount: number;
    contactedCount: number;
    advancedCount: number;
  };
  nextRecommendedOpportunity: CampaignProspectSummary | null;
  discovery?: {
    scans: DiscoveryScanSummary[];
  };
}

export interface CampaignTargetQueueItemSummary {
  id: string;
  queueItemId: string;
  campaignId: string;
  actionLaneId?: string | null;
  personId?: string | null;
  connectionRecordId?: string | null;
  source: 'person' | 'connection';
  name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  score: number;
  reason?: string | null;
  criteria?: string | null;
  status: string;
  actionLane?: { id: string; title: string } | null;
}

export type CommandQueueItemStatus =
  | 'queued'
  | 'presented'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'deferred'
  | 'blocked'
  | 'failed';

export interface CommandQueueItem {
  id: string;
  commandQueueId: string;
  userId: string;
  offeringId?: string | null;
  campaignId?: string | null;
  actionLaneId?: string | null;
  actionCycleId?: string | null;
  actionItemId?: string | null;
  position: number;
  priorityScore: number;
  status: CommandQueueItemStatus;
  title: string;
  reason?: string | null;
  estimatedMinutes?: number | null;
  scheduledFor?: string | null;
  presentedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  skippedAt?: string | null;
  deferredUntil?: string | null;
  metadataJson?: Record<string, unknown> | null;
  actionItem?: any | null;
  ancestry?: {
    offering?: any | null;
    campaign?: any | null;
    actionLane?: any | null;
    actionCycle?: any | null;
  };
}

export interface CommandQueueState {
  id: string;
  userId: string;
  queueDate: string;
  status: string;
  title?: string | null;
  summary?: string | null;
  targetActionCount?: number | null;
  completedActionCount: number;
  generatedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  items: CommandQueueItem[];
}

export interface DiscoveryEvidenceSummary {
  id: string;
  evidenceType: string;
  title: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  snippet?: string | null;
  confidenceScore: number;
}

export interface DiscoveryTargetSummary {
  id: string;
  scanId: string;
  targetType: string;
  status: string;
  title: string;
  companyName?: string | null;
  personName?: string | null;
  roleTitle?: string | null;
  email?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  location?: string | null;
  sourceUrl?: string | null;
  confidenceScore: number;
  relevanceScore: number;
  qualificationScore?: number | null;
  whyThisTarget?: string | null;
  recommendedAction?: string | null;
  companyId?: string | null;
  personId?: string | null;
  opportunityId?: string | null;
  metadata?: Record<string, unknown> | null;
  evidence?: DiscoveryEvidenceSummary[];
}

export interface DiscoveryScanSummary {
  id: string;
  query: string;
  scanType: string;
  status: string;
  providerKey: string;
  providerKeys?: string[];
  targetSegment?: string | null;
  maxTargets: number;
  acceptedCount: number;
  rejectedCount: number;
  promotedCount: number;
  targetCount: number;
  offeringId?: string | null;
  campaignId?: string | null;
  goalId?: string | null;
  providerRuns?: Array<Record<string, unknown>>;
  targets?: DiscoveryTargetSummary[];
}

export interface ConnectorSummary {
  id: string;
  connectorName?: string | null;
  capabilityType: string;
  providerName: string;
  providerDisplayName: string;
  status: string;
  enabledFeatures: unknown[];
  lastSyncAt?: string | null;
  lastSuccessAt?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  credential?: {
    expiresAt?: string | null;
    lastRefreshedAt?: string | null;
    refreshStatus?: string | null;
  } | null;
}

export interface EmailReadiness {
  ready: boolean;
  blocked: boolean;
  reason?: string | null;
  upgradeHint?: string | null;
  providers?: string[];
  connector?: ConnectorSummary;
}

export interface OAuthStartResult {
  providerName: 'gmail' | 'outlook';
  authUrl: string;
  state: string;
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
