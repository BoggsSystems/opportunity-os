import type {
  AuthResponse,
  AdminBillingReferralAnalytics,
  AdminCampaignAnalytics,
  AdminConnectorAnalytics,
  AdminFunnel,
  AdminMetricSnapshots,
  AdminOperationalIssues,
  AdminOverview,
  AdminUsersResult,
  CapabilityCheckResult,
  CampaignWorkspace,
  CampaignSummary,
  CommandQueueState,
  CommandQueueItemStatus,
  CheckoutSession,
  CommercialState,
  ContentUploadResult,
  DiscoveryContentSummary,
  DiscoveryScanSummary,
  DiscoveryTargetSummary,
  EmailReadiness,
  OAuthStartResult,
  OfferingAssetSummary,
  OfferingPositioningSummary,
  OfferingSummary,
  OfferingType,
  OutreachDraft,
  PlanSummary,
  ReferralLinkSummary,
  StrategicPlanResult,
  SubscriptionSummary,
  UsageSummary,
  WorkspaceState,
} from '../types';

const API_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3002';
const EMAIL_STUB_KEY = 'opportunity-os-email-stub';

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(readableMessage(payload) ?? `Request failed with status ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

export class ApiClient {
  private accessToken: string | null;

  constructor(accessToken: string | null) {
    console.log('🔍 API DEBUG: ApiClient constructor called', {
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
      accessTokenPrefix: accessToken?.substring(0, 20) + '...'
    });
    this.accessToken = accessToken;
  }

  setAccessToken(accessToken: string | null) {
    this.accessToken = accessToken;
  }

  get baseUrl() {
    return API_URL;
  }

  async signup(input: {
    email: string;
    password: string;
    fullName?: string | undefined;
    timezone?: string | undefined;
    initialStrategy?: any;
    guestSessionId?: string | undefined;
    referralCode?: string | undefined;
    referralVisitId?: string | undefined;
    referralVisitorId?: string | undefined;
  }) {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: input,
      authenticated: false,
    });
  }

  async login(input: { email: string; password: string }) {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      authenticated: false,
    });
  }

  async getCurrentUser() {
    return this.request<Pick<AuthResponse, 'user' | 'subscription' | 'entitlements'>>('/auth/me');
  }

  async getWorkspace() {
    return this.request<WorkspaceState>('/workspace');
  }

  async getCurrentCampaignWorkspace() {
    return this.request<CampaignWorkspace | null>('/campaigns/current/workspace');
  }

  async getCampaignWorkspace(campaignId: string) {
    return this.request<CampaignWorkspace>(`/campaigns/${encodeURIComponent(campaignId)}/workspace`);
  }

  async getTodayCommandQueue(input: { date?: string; refresh?: boolean; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (input.date) query.set('date', input.date);
    if (input.refresh) query.set('refresh', 'true');
    if (input.limit) query.set('limit', String(input.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<CommandQueueState>(`/command-queue/today${suffix}`);
  }

  async updateCommandQueueItem(itemId: string, input: {
    status?: CommandQueueItemStatus;
    deferredUntil?: string;
    reason?: string;
    completeActionItem?: boolean;
    metadataJson?: Record<string, unknown>;
  }) {
    return this.request<CommandQueueState>(`/command-queue/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      body: input,
    });
  }

  async presentCommandQueueItem(itemId: string) {
    return this.request<CommandQueueState>(`/command-queue/items/${encodeURIComponent(itemId)}/present`, {
      method: 'POST',
      body: {},
    });
  }

  async listOfferings() {
    return this.request<OfferingSummary[]>('/offerings');
  }

  async createOffering(input: { title: string; description?: string; offeringType: OfferingType }) {
    const body: { title: string; description?: string; offeringType: OfferingType } = {
      title: input.title,
      offeringType: input.offeringType,
    };
    if (input.description) body.description = input.description;
    return this.request<OfferingSummary>('/offerings', {
      method: 'POST',
      body,
    });
  }

  async updateOffering(id: string, input: Partial<Pick<OfferingSummary, 'title' | 'description' | 'offeringType' | 'status'>>) {
    return this.request<OfferingSummary>(`/offerings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    });
  }

  async listCampaigns(input: { status?: string } = {}) {
    const query = new URLSearchParams();
    if (input.status) query.set('status', input.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<CampaignSummary[]>(`/campaign-orchestration/campaigns${suffix}`);
  }

  async createCampaign(input: {
    title: string;
    description?: string;
    objective?: string;
    successDefinition?: string;
    strategicAngle?: string;
    targetSegment?: string;
    offeringId?: string;
    goalId?: string;
    priorityScore?: number;
  }) {
    return this.request<CampaignSummary>('/campaign-orchestration/campaigns', {
      method: 'POST',
      body: input,
    });
  }

  async updateCampaign(id: string, input: Partial<Pick<CampaignSummary, 'title' | 'description' | 'objective' | 'successDefinition' | 'strategicAngle' | 'targetSegment' | 'status' | 'priorityScore'>>) {
    return this.request<CampaignSummary>(`/campaign-orchestration/campaigns/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    });
  }

  async listOfferingPositioning(offeringId: string) {
    return this.request<OfferingPositioningSummary[]>(`/offerings/${encodeURIComponent(offeringId)}/positioning`);
  }

  async listOfferingAssets(offeringId: string) {
    return this.request<OfferingAssetSummary[]>(`/offerings/${encodeURIComponent(offeringId)}/assets`);
  }

  async listDiscoveryContent() {
    return this.request<DiscoveryContentSummary[]>('/discovery/content');
  }

  async createDiscoveryScan(input: {
    query: string;
    scanType?: string;
    providerKeys?: string[];
    campaignId?: string;
    offeringId?: string;
    goalId?: string;
    targetSegment?: string;
    maxTargets?: number;
  }) {
    return this.request<{ scan: DiscoveryScanSummary; targets: DiscoveryTargetSummary[] }>('/discovery/scans', {
      method: 'POST',
      body: input,
    });
  }

  async acceptDiscoveryTarget(targetId: string) {
    return this.request<{ target: DiscoveryTargetSummary }>(`/discovery/targets/${encodeURIComponent(targetId)}/accept`, {
      method: 'POST',
      body: {},
    });
  }

  async rejectDiscoveryTarget(targetId: string, reason?: string) {
    return this.request<{ target: DiscoveryTargetSummary }>(`/discovery/targets/${encodeURIComponent(targetId)}/reject`, {
      method: 'POST',
      body: reason ? { reason } : {},
    });
  }

  async promoteDiscoveryTargets(scanId: string) {
    return this.request<{ promoted: number; targets: DiscoveryTargetSummary[] }>(
      `/discovery/scans/${encodeURIComponent(scanId)}/promote-accepted`,
      {
        method: 'POST',
        body: {},
      },
    );
  }

  async uploadContent(input: { file: File; offeringId?: string; title?: string; source?: string; notes?: string }) {
    const formData = new FormData();
    formData.append('file', input.file);
    if (input.offeringId) formData.append('offeringId', input.offeringId);
    if (input.title) formData.append('title', input.title);
    if (input.source) formData.append('source', input.source);
    if (input.notes) formData.append('notes', input.notes);
    return this.requestForm<ContentUploadResult>('/discovery/content/upload', formData);
  }

  async executeWorkspaceCommand(payload: {
    type: 'confirm_offering' | 'adjust_offering' | 'reject_offering' | 'start_discovery_scan' | 'accept_discovery_target' | 'reject_discovery_target' | 'promote_discovery_targets' | 'activate_signal' | 'dismiss_signal' | 'dismiss_cycle' | 'complete_cycle' | 'create_task' | 'advance_opportunity' | 'activate_campaign' | 'set_workspace_mode' | 'build_recipient_queue' | 'select_recipient' | 'clear_recipient';
    signalId?: string;
    cycleId?: string;
    campaignId?: string;
    input?: Record<string, unknown>;
    reason?: string;
  }) {
    return this.request('/workspace/command', {
      method: 'POST',
      body: payload,
    });
  }

  async converse(body: { sessionId?: string; guestSessionId?: string; message: string; context?: Record<string, unknown> }) {
    return this.request<{
      success: boolean;
      sessionId: string;
      reply: string;
      suggestedAction?: string;
      onboardingPlan?: StrategicPlanResult;
      proposedOfferings?: any[];
      proposedCampaigns?: any[];
      blocked?: boolean;
      upgradeReason?: string;
      upgradeHint?: string;
    }>('/ai/converse', {
      method: 'POST',
      body,
    });
  }

  async previewStrategicPlan(sessionId: string) {
    return this.request<StrategicPlanResult>('/ai/preview-strategic-plan', {
      method: 'POST',
      body: { sessionId },
    });
  }

  async finalizeStrategicGoal(sessionId: string) {
    return this.request<StrategicPlanResult>('/ai/finalize-strategic-goal', {
      method: 'POST',
      body: { sessionId },
    });
  }

  async proposeOfferings(context: { networkCount: number; networkPosture: string; frameworks: string[]; interpretation: string }) {
    return this.request<{ success: boolean; offerings: any[] }>('/onboarding/offerings/propose', {
      method: 'POST',
      body: context,
    });
  }

  async refineOfferings(body: { currentLanes: any[]; feedback: string; networkCount: number; networkPosture: string; frameworks: string[]; interpretation: string }) {
    return this.request<{ success: boolean; offerings: any[] }>('/onboarding/offerings/refine', {
      method: 'POST',
      body,
    });
  }

  async proposeCampaigns(context: { selectedLanes: any[]; networkCount: number; frameworks: string[]; interpretation: string }) {
    return this.request<{ success: boolean; campaigns: any[] }>('/onboarding/campaigns/propose', {
      method: 'POST',
      body: context,
    });
  }

  async proposeCampaignDimensions(context: {
    offering: any;
    networkCount?: number;
    frameworks?: string[];
    interpretation?: string;
    strategicDraft?: any;
    uploadedAssets?: any[];
    comprehensiveSynthesis?: string | null;
    existingDimensions?: any;
  }) {
    return this.request<{
      success: boolean;
      source?: 'ai_synthesized' | 'ai_failed';
      dimensions?: Record<string, any>;
      error?: string;
      message?: string;
    }>('/onboarding/campaign-dimensions/propose', {
      method: 'POST',
      body: context,
    });
  }

  async refineCampaignDimension(context: {
    offering: any;
    targetDimension: string;
    userFeedback: string;
    currentDimensions: Record<string, any>;
    currentDimensionMeta?: Record<string, any>;
    lockedDimensions?: string[];
    networkCount?: number;
    frameworks?: string[];
    interpretation?: string;
    strategicDraft?: any;
    uploadedAssets?: any[];
    comprehensiveSynthesis?: string | null;
  }) {
    return this.request<{
      success: boolean;
      source?: 'ai_synthesized' | 'ai_failed';
      targetDimension?: string;
      dimension?: Record<string, any>;
      preservedDimensions?: string[];
      error?: string;
      message?: string;
    }>('/onboarding/campaign-dimensions/refine', {
      method: 'POST',
      body: context,
    });
  }

  async refineCampaigns(body: { currentCampaigns: any[]; feedback: string; selectedLanes: any[]; networkCount: number; frameworks: string[]; interpretation: string }) {
    return this.request<{ success: boolean; campaigns: any[] }>('/onboarding/campaigns/refine', {
      method: 'POST',
      body,
    });
  }

  async proposeActionLanes(context: { selectedCampaigns: any[]; comprehensiveSynthesis: string }) {
    return this.request<{ success: boolean; actionLanes: any[] }>('/onboarding/action-lanes/propose', {
      method: 'POST',
      body: context,
    });
  }

  async refineActionLanes(body: { currentActionLanes: any[]; feedback: string; selectedCampaigns: any[]; comprehensiveSynthesis: string }) {
    return this.request<{ success: boolean; actionLanes: any[] }>('/onboarding/action-lanes/refine', {
      method: 'POST',
      body,
    });
  }

  async finalizeOnboardingPlan(body: {
    campaigns: any[];
    actionLanes: any[];
    selectedCampaignIds: string[];
    selectedActionLaneIds: string[];
    activationSelection?: { campaignId: string; laneId: string } | null;
    comprehensiveSynthesis?: string | null;
  }) {
    return this.request<{
      campaigns: any[];
      actionLanes: any[];
      firstActionCycle: any | null;
      firstActionItem: any | null;
    }>('/campaign-orchestration/onboarding/finalize', {
      method: 'POST',
      body,
    });
  }

  async getOrCreateActionItemConversationThread(actionItemId: string) {
    return this.request<any>(`/campaign-orchestration/action-items/${actionItemId}/conversation-thread`, {
      method: 'POST',
      body: {},
    });
  }

  async getActionItemCanvas(actionItemId: string) {
    return this.request<any>(`/campaign-orchestration/action-items/${actionItemId}/canvas`);
  }

  async confirmActionItem(actionItemId: string, body: {
    finalContent?: string;
    confirmationSource?: 'user_confirmed' | 'provider_verified' | 'system';
    outcome?: string;
    occurredAt?: string;
  } = {}) {
    return this.request<any>(`/campaign-orchestration/action-items/${actionItemId}/confirm`, {
      method: 'POST',
      body,
    });
  }

  async updateActionItem(actionItemId: string, body: {
    title?: string;
    instructions?: string;
    draftContent?: string;
    finalContent?: string;
    externalUrl?: string;
    status?: string;
    priorityScore?: number;
    dueAt?: string;
    metadataJson?: Record<string, any>;
  }) {
    return this.request<any>(`/campaign-orchestration/action-items/${actionItemId}`, {
      method: 'PUT',
      body,
    });
  }

  async captureConversationMessage(threadId: string, body: {
    direction?: 'outbound' | 'inbound' | 'internal';
    source?: 'manual_paste' | 'screenshot' | 'upload' | 'provider_sync' | 'system';
    bodyText?: string;
    attachmentUrls?: string[];
    attachmentMimeTypes?: string[];
    occurredAt?: string;
    metadataJson?: Record<string, any>;
  }) {
    return this.request<any>(`/campaign-orchestration/conversation-threads/${threadId}/messages`, {
      method: 'POST',
      body,
    });
  }

  async synthesizeConversationThread(threadId: string, body: { createSuggestedAction?: boolean } = {}) {
    return this.request<any>(`/campaign-orchestration/conversation-threads/${threadId}/synthesize`, {
      method: 'POST',
      body,
    });
  }

  async intakeConversationFeedback(body: {
    message?: string;
    bodyText?: string;
    attachmentUrls?: string[];
    attachmentMimeTypes?: string[];
    channelHint?: string;
    campaignIdHint?: string;
    actionItemIdHint?: string;
    threadIdHint?: string;
    personHint?: string;
    companyHint?: string;
    createSuggestedAction?: boolean;
  }) {
    return this.request<any>('/campaign-orchestration/conversation-feedback/intake', {
      method: 'POST',
      body,
    });
  }

  async getSubscription() {
    return this.request<SubscriptionSummary>('/me/subscription');
  }

  async getUsage() {
    return this.request<UsageSummary>('/me/usage');
  }

  async getCommercialState() {
    return this.request<CommercialState>('/me/commercial-state');
  }

  async listPlans() {
    return this.request<PlanSummary[]>('/me/plans');
  }

  async createCheckout(planCode: string, interval: 'monthly' | 'annual' = 'monthly') {
    return this.request<CheckoutSession>('/me/billing/checkout', {
      method: 'POST',
      body: { planCode, interval },
    });
  }

  async getReferralLink() {
    return this.request<ReferralLinkSummary>('/me/referral-link');
  }

  async applyReferral(code: string) {
    return this.request<unknown>('/me/referrals/apply', {
      method: 'POST',
      body: { code },
    });
  }

  async recordReferralVisit(input: {
    referralCode: string;
    visitorId?: string | undefined;
    guestSessionId?: string | undefined;
    landingPath?: string | undefined;
    landingUrl?: string | undefined;
    referrerUrl?: string | undefined;
  }) {
    return this.request<{ id: string; referralCode: string }>('/me/referrals/visits', {
      method: 'POST',
      body: input,
      authenticated: false,
    });
  }

  async getBillingState() {
    return this.request<any>('/billing/me');
  }

  async getAdminOverview() {
    return this.request<AdminOverview>('/admin/overview');
  }

  async getAdminFunnel() {
    return this.request<AdminFunnel>('/admin/funnel');
  }

  async listAdminUsers(input: { query?: string; stage?: string; limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    if (input.query) query.set('query', input.query);
    if (input.stage) query.set('stage', input.stage);
    if (input.limit) query.set('limit', String(input.limit));
    if (input.cursor) query.set('cursor', input.cursor);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<AdminUsersResult>(`/admin/users${suffix}`);
  }

  async getAdminUser(userId: string) {
    return this.request<any>(`/admin/users/${encodeURIComponent(userId)}`);
  }

  async getAdminCampaigns() {
    return this.request<AdminCampaignAnalytics>('/admin/campaigns');
  }

  async getAdminConnectors() {
    return this.request<AdminConnectorAnalytics>('/admin/connectors');
  }

  async getAdminBillingReferrals() {
    return this.request<AdminBillingReferralAnalytics>('/admin/billing-referrals');
  }

  async getAdminMetricSnapshots(input: { metricKey?: string; periodStart?: string; periodEnd?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (input.metricKey) query.set('metricKey', input.metricKey);
    if (input.periodStart) query.set('periodStart', input.periodStart);
    if (input.periodEnd) query.set('periodEnd', input.periodEnd);
    if (input.limit) query.set('limit', String(input.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<AdminMetricSnapshots>(`/admin/metrics/snapshots${suffix}`);
  }

  async createAdminMonthlySnapshot(input: { month?: string; periodStart?: string; periodEnd?: string } = {}) {
    return this.request<any>('/admin/metrics/snapshots/monthly', {
      method: 'POST',
      body: input,
    });
  }

  async getAdminOperationalIssues(input: { status?: string; severity?: string; source?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (input.status) query.set('status', input.status);
    if (input.severity) query.set('severity', input.severity);
    if (input.source) query.set('source', input.source);
    if (input.limit) query.set('limit', String(input.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<AdminOperationalIssues>(`/admin/operations/issues${suffix}`);
  }

  async getEmailReadiness() {
    return this.request<EmailReadiness>('/connectors/email/readiness');
  }

  async listStorageFiles(input: { provider?: string; query?: string } = {}) {
    const params = new URLSearchParams();
    if (input.provider) params.set('provider', input.provider);
    if (input.query) params.set('q', input.query);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request<any[]>(`/connectors/storage/files${suffix}`);
  }

  async listStorageAssets(provider?: string, folderId?: string) {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);
    if (folderId) params.append('folderId', folderId);
    return this.request<any[]>(`/connectors/storage/assets?${params.toString()}`);
  }

  async searchStorage(query: string, provider?: string) {
    const params = new URLSearchParams({ q: query });
    if (provider) params.set('provider', provider);
    return this.request<any[]>(`/connectors/storage/search?${params.toString()}`);
  }

  async setupEmailConnector(input: {
    providerName: 'gmail' | 'outlook';
    connectorName?: string;
    emailAddress?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
  }) {
    return this.request<any>('/connectors/email/setup', {
      method: 'POST',
      body: input,
    });
  }

  async setupSocialConnector(input: {
    providerName: 'linkedin' | 'hubspot' | 'salesforce';
    accessToken: string;
    refreshToken?: string;
  }) {
    return this.request<{ success: boolean }>('/connections/social/setup', {
      method: 'POST',
      body: input,
    });
  }

  async setupCommerceConnector(input: {
    providerName: 'shopify' | 'stripe';
    storeName?: string;
    accessToken: string;
  }) {
    return this.request<{ success: boolean }>('/connections/commerce/setup', {
      method: 'POST',
      body: input,
    });
  }

  async syncEmail() {
    return this.request<{ success: true; synced: number; linkedReplies: number; replies: unknown[] }>('/connectors/email/sync', {
      method: 'POST',
      body: {},
    });
  }

  async startEmailOAuth(providerName: 'outlook' | 'gmail', returnTo?: string) {
    const query = new URLSearchParams({ provider: providerName });
    if (returnTo) query.set('returnTo', returnTo);
    return this.request<OAuthStartResult>(`/connectors/email/oauth/start?${query.toString()}`);
  }

  async checkCapability(featureKey: string) {
    return this.request<CapabilityCheckResult>(`/me/capabilities/${encodeURIComponent(featureKey)}/check`);
  }

  async generateDraft(opportunityId: string) {
    return this.request<OutreachDraft>(`/outreach/draft/${encodeURIComponent(opportunityId)}`);
  }

  async generateFollowUpDraft(opportunityId: string) {
    return this.request<OutreachDraft>(`/outreach/follow-up/${encodeURIComponent(opportunityId)}`);
  }

  async refineDraft(input: {
    actionItemId: string;
    currentContent: string;
    instructions: string;
    campaignTitle?: string;
    targetName?: string;
    targetTitle?: string;
    targetCompany?: string;
  }) {
    return this.request('/ai/refine-outreach', {
      method: 'POST',
      body: input,
    });
  }

  async sendDraft(draft: OutreachDraft) {
    const body: OutreachDraft = {
      subject: draft.subject,
      body: draft.body,
      recipients: draft.recipients,
    };
    if (draft.id) body.id = draft.id;
    if (draft.opportunityId) body.opportunityId = draft.opportunityId;
    if (draft.companyId) body.companyId = draft.companyId;
    if (draft.personId) body.personId = draft.personId;

    if (emailStubEnabled()) {
      return buildStubbedSendResponse(body);
    }

    return this.request<
      | { success: true; activity: unknown; opportunity?: unknown; stubbed?: boolean; sentAt?: string; usage?: unknown }
      | ({ success: false; blocked: true } & CapabilityCheckResult)
    >('/outreach/send', {
      method: 'POST',
      body,
    });
  }

  // Connection Import API Methods
  async importConnections(file: File, importData: { name: string; description?: string; source: string; tags?: string[] }) {
    console.log('🔍 DEBUG: importConnections called with:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      importData
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', importData.source);
    formData.append('name', importData.name);
    if (importData.description) formData.append('description', importData.description);
    if (importData.tags) formData.append('tags', JSON.stringify(importData.tags));

    console.log('🔍 DEBUG: FormData prepared, calling requestForm');
    console.log('🔍 DEBUG: Access token exists:', !!this.accessToken);
    console.log('🔍 DEBUG: API URL:', import.meta.env['VITE_API_URL'] ?? 'http://localhost:3002');

    return this.requestForm<{
      success: boolean;
      data: {
        id: string;
        name: string;
        description?: string;
        status: string;
        totalRecords: number;
        successfulImports: number;
        duplicateRecords: number;
        failedRecords: number;
      };
      message: string;
    }>('/connections/import', formData);
  }

  async ingestZip(file: File, importData: { name: string; source: string }) {
    console.log('🔍 API DEBUG: ingestZip called', { fileName: file.name, fileSize: file.size, importData });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', importData.source);
    formData.append('name', importData.name);

    console.log('🔍 API DEBUG: ingestZip FormData prepared, calling requestForm');
    return this.requestForm<{
      success: boolean;
      data: {
        importId: string;
        strategicDraft: any;
      };
      message: string;
    }>('/connections/ingest-zip', formData);
  }

  async auditLinkedInZip(file: File) {
    console.log('🔍 API DEBUG: auditLinkedInZip called', { fileName: file.name, fileSize: file.size });
    const formData = new FormData();
    formData.append('file', file);

    return this.requestForm<{
      success: boolean;
      data: {
        connectionCount: number;
        posture: any;
        offerings: any[];
        theses: any[];
      };
      message: string;
    }>('/onboarding/audit', formData);
  }

  async auditKnowledge(file: File, previousContext?: any[]) {
    console.log('📚 API DEBUG: auditKnowledge called', { fileName: file.name, fileSize: file.size, contextLength: previousContext?.length });
    const formData = new FormData();
    formData.append('file', file);
    
    if (previousContext && previousContext.length > 0) {
      formData.append('previousContext', JSON.stringify(previousContext));
    }

    return this.requestForm<{
      success: boolean;
      data: {
        title: string;
        interpretation: string;
        summary: string;
        frameworks: string[];
        comprehensiveSynthesis?: string;
      };
      message: string;
    }>('/onboarding/knowledge', formData);
  }

  async getConnectionImports(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        description?: string;
        source: string;
        status: string;
        totalRecords: number;
        successfulImports: number;
        duplicateRecords: number;
        failedRecords: number;
        tags?: string[];
        createdAt: string;
        updatedAt: string;
        startedAt?: string;
        completedAt?: string;
      }>;
    }>(`/connections/imports${query}`);
  }

  async getConnectionImport(importId: string) {
    return this.request<{
      success: boolean;
      data: {
        id: string;
        name: string;
        description?: string;
        source: string;
        status: string;
        totalRecords: number;
        successfulImports: number;
        duplicateRecords: number;
        failedRecords: number;
        tags?: string[];
        createdAt: string;
        updatedAt: string;
        startedAt?: string;
        completedAt?: string;
      };
    }>(`/connections/imports/${encodeURIComponent(importId)}`);
  }

  async getConnectionImportConnections(importId: string) {
    return this.request<{
      success: boolean;
      data: Array<{
        id: string;
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        linkedinUrl?: string;
        company?: string;
        position?: string;
        industry?: string;
        location?: string;
        connectionLevel?: string;
        notes?: string;
        tags?: string[];
        isDuplicate: boolean;
        originalRow: number;
        createdAt: string;
      }>;
    }>(`/connections/imports/${encodeURIComponent(importId)}/connections`);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body: any = {}): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      authenticated?: boolean;
      headers?: Record<string, string> | undefined;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };

    if (options.authenticated !== false && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const requestInit: RequestInit = {
      method: options.method ?? 'GET',
      headers,
    };
    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    const url = `${API_URL}${path}`;
    console.log(`🌐 [ApiClient] Requesting: ${requestInit.method} ${url}`, {
      authenticated: options.authenticated !== false,
      hasToken: !!this.accessToken,
      headers: headers
    });

    const response = await fetch(url, requestInit);

    const text = await response.text();
    const payload = text ? parseJson(text) : null;

    if (!response.ok) {
      throw new ApiError(response.status, payload);
    }

    return payload as T;
  }

  private async requestForm<T>(path: string, body: FormData): Promise<T> {
    console.log('🔍 DEBUG: requestForm called with:', {
      path,
      hasAccessToken: !!this.accessToken,
      accessTokenLength: this.accessToken?.length,
      bodyEntries: Array.from(body.entries())
    });

    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      console.log('🔍 API DEBUG: Authorization header set', {
        headerLength: headers['Authorization']?.length,
        headerPrefix: headers['Authorization']?.substring(0, 30) + '...'
      });
    } else {
      console.log('🔍 API DEBUG: No access token available, no Authorization header');
    }

    const fullUrl = `${API_URL}${path}`;
    console.log('🔍 API DEBUG: Making fetch request to:', fullUrl);
    console.log('🔍 API DEBUG: Request headers:', {
      headerKeys: Object.keys(headers),
      hasAuth: !!headers['Authorization'],
      authLength: headers['Authorization']?.length || 0
    });

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body,
    });

    console.log('🔍 DEBUG: Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    const text = await response.text();
    console.log('🔍 DEBUG: Response text length:', text.length);
    console.log('🔍 DEBUG: Response text preview:', text.substring(0, 200));
    
    const payload = text ? parseJson(text) : null;
    console.log('🔍 DEBUG: Parsed payload:', payload);

    if (!response.ok) {
      console.log('🔍 DEBUG: Response not OK, throwing ApiError');
      throw new ApiError(response.status, payload);
    }

    console.log('🔍 DEBUG: Request successful, returning payload');
    return payload as T;
  }
}

function emailStubEnabled() {
  return typeof localStorage !== 'undefined' && localStorage.getItem(EMAIL_STUB_KEY) === 'true';
}

function buildStubbedSendResponse(draft: OutreachDraft) {
  const now = new Date().toISOString();
  return Promise.resolve({
    success: true as const,
    stubbed: true,
    sentAt: now,
    activity: {
      id: `stubbed-email-${Date.now()}`,
      activityType: 'email',
      subject: draft.subject,
      bodySummary: draft.body.slice(0, 500),
      opportunityId: draft.opportunityId ?? null,
      companyId: draft.companyId ?? null,
      personId: draft.personId ?? null,
      occurredAt: now,
    },
    usage: null,
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readableMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object') {
    const value = payload as { message?: unknown; error?: unknown; upgradeHint?: unknown };
    if (typeof value.upgradeHint === 'string') return value.upgradeHint;
    if (typeof value.message === 'string') return value.message;
    if (Array.isArray(value.message)) return value.message.join(', ');
    if (typeof value.error === 'string') return value.error;
  }
  if (typeof payload === 'string') return payload;
  return null;
}
