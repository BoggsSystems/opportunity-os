import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Info, Send, FileText, User, Layout, ArrowRight, ChevronRight, MessageSquare, Target, Search, SlidersHorizontal, Zap, Globe, ChevronUp, ChevronDown } from 'lucide-react';
import type {
  WorkspaceState,
  CampaignWorkspace,
  CampaignSummary,
  CommandQueueItem,
  CommandQueueItemStatus,
  CommandQueueState,
  EmailReadiness,
  OfferingSummary,
  OfferingType,
  OutreachDraft,
  StrategicPlanResult
} from '../../types';
import type { WorkspaceCommandPayload } from '../../lib/api';

// Define missing types locally
type WorkspaceViewState = {
  action: string;
  title: string;
  explanation: string;
  phase: string;
  cycleId: string | null;
  refs: any;
  allowedActions: Set<string>;
  primaryAction: string | null;
};

type OutreachExecutionState = 'idle' | 'blocked' | 'sent';

interface WorkspaceActivationPayload {
  campaign: {
    id: string;
    title: string;
    description?: string;
    targetSegment?: string;
    goalMetric?: string;
  };
  lane: {
    id: string;
    title: string;
    description?: string;
    tactics?: string[];
    requiredConnectors?: string[];
  };
  selectedCampaignCount: number;
  selectedActionLaneCount: number;
  connectorReady: boolean;
  createdAt: string;
  persisted?: {
    campaignId?: string;
    actionLaneId?: string;
    actionCycleId?: string;
    actionItemId?: string;
  } | null;
}

interface ActiveWorkspaceProps {
  workspace: WorkspaceState | null;
  campaignWorkspace: CampaignWorkspace | null;
  offerings: OfferingSummary[];
  campaigns: CampaignSummary[];
  emailReadiness: EmailReadiness | null;
  commandQueue: CommandQueueState | null;
  intelligenceArtifacts: any[];
  intelligenceJobs: any[];
  intelligenceChunks: any[];
  userAssets: any[];
  mode: 'command' | 'map';
  view: WorkspaceViewState;
  draft: OutreachDraft | null;
  outreachExecutionState: OutreachExecutionState;
  pendingStrategicSessionId: string | null;
  strategicPreview: StrategicPlanResult | null;
  campaignFeedback: StrategicPlanResult | null;
  activationPayload: WorkspaceActivationPayload | null;
  actionCanvasPayload: any | null;
  showWorkspaceTour: boolean;
  isWorking: boolean;
  onCommand: (body: WorkspaceCommandPayload, success: string) => Promise<void>;
  onCreateOffering: (input: { title: string; description?: string; offeringType: OfferingType }) => Promise<OfferingSummary | null>;
  onUpdateOffering: (id: string, input: Partial<Pick<OfferingSummary, 'title' | 'description' | 'offeringType' | 'status'>>) => Promise<OfferingSummary | null>;
  onCreateCampaign: (input: {
    title: string;
    description?: string;
    objective?: string;
    successDefinition?: string;
    strategicAngle?: string;
    targetSegment?: string;
    offeringId?: string;
  }) => Promise<CampaignSummary | null>;
  onUpdateCampaign: (id: string, input: Partial<Pick<CampaignSummary, 'title' | 'description' | 'objective' | 'successDefinition' | 'strategicAngle' | 'targetSegment' | 'status'>>) => Promise<CampaignSummary | null>;
  onCaptureActionFeedback: (input: {
    actionItemId: string;
    bodyText: string;
    attachmentUrls?: string[];
    attachmentMimeTypes?: string[];
  }) => Promise<any>;
  onConfirmCanvasAction: (input: { actionItemId: string; finalContent?: string; outcome?: string }) => Promise<any>;
  onSaveActionDraft: (input: { actionItemId: string; draftContent: string }) => Promise<any>;
  onSelectCommandQueueItem: (item: CommandQueueItem) => Promise<void>;
  onChangeMode: (mode: 'command' | 'map') => void;
  onExtendedLogoutAndPurge: () => void | Promise<void>;
  onUpdateCommandQueueItem: (item: CommandQueueItem, status: CommandQueueItemStatus) => Promise<void>;
  onRefreshCommandQueue: () => Promise<void>;
  onGenerateDraft: () => Promise<void>;
  onGenerateDraftForOpportunity: (opportunityId: string, kind?: 'initial' | 'follow_up') => Promise<void>;
  onRefineDraft: (input: {
    actionItemId: string;
    currentContent: string;
    instructions: string;
    campaignTitle?: string;
    targetName?: string;
    targetTitle?: string;
    targetCompany?: string;
  }) => Promise<string>;
  onClearRecipient: (actionItemId: string) => Promise<void>;
  onStartDiscoveryScan: (input: {
    query: string;
    providerKeys?: string[];
    context?: Record<string, any>;
  }) => Promise<any>;
  onAcceptDiscoveryTarget: (targetId: string) => Promise<void>;
  onRejectDiscoveryTarget: (targetId: string) => Promise<void>;
  onPromoteDiscoveryTargets: (scanId: string) => Promise<void>;
  onConnectEmail: (providerName: 'gmail' | 'outlook', accessToken: string, emailAddress?: string) => Promise<void>;
  onStartOutlookOAuth: () => Promise<void>;
  onSyncEmail: () => Promise<void>;
  onBuildRecipientQueue: (input: { campaignId: string; actionLaneId?: string; limit?: number; refinement?: string; forceRefresh?: boolean }) => Promise<any>;
  onSelectRecipient: (input: { actionItemId: string; personId?: string; connectionRecordId?: string; targetQueueItemId?: string }) => Promise<void>;
  onDraftChange: (draft: OutreachDraft) => void;
  onSendDraft: () => Promise<void>;
  onCompleteCycle: () => Promise<void>;
  onPreviewStrategicPlan: () => Promise<void>;
  onFinalizeStrategicGoal: () => Promise<void>;
  onContinueFromCampaignFeedback: () => void;
}

// Temporary components - these should be moved to their respective component files
const StatusBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="status-badge">{label}</span>
);

const actionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    idle: 'Idle',
    review_opportunity: 'Review Opportunity',
    confirm_goal: 'Confirm Goal',
    confirm_campaign: 'Confirm Campaign',
    confirm_send: 'Review Action',
    discovery_scan: 'Discovery Scan',
    outreach: 'Outreach',
  };
  return labels[action] || action;
};

const CanvasActionSummary: React.FC<{ view: WorkspaceViewState }> = ({ view }) => (
  <div className="canvas-action-summary">
    <p>{view.explanation}</p>
  </div>
);

const CycleTimeline: React.FC<{ phase: string }> = ({ phase }) => (
  <div className="cycle-timeline">
    <div className="timeline-phase">{phase}</div>
  </div>
);

const EmptyWorkspace: React.FC = () => (
  <div className="empty-workspace">
    <p>No active cycle. Start by creating a new opportunity cycle.</p>
  </div>
);

const TodayCommandQueue: React.FC<{
  queue: CommandQueueState | null;
  isWorking: boolean;
  onSelect: (item: CommandQueueItem) => Promise<void>;
  onUpdate: (item: CommandQueueItem, status: CommandQueueItemStatus) => Promise<void>;
  onRefresh: () => Promise<void>;
}> = ({ queue, isWorking, onSelect, onUpdate, onRefresh }) => {
  const actionableItems = queue?.items.filter((item) => !['completed', 'skipped', 'deferred'].includes(item.status)) ?? [];
  const nextItem = actionableItems[0] ?? null;

  return (
    <section className="command-queue-panel">
      <header className="command-queue-header">
        <div>
          <p className="eyebrow">Today&apos;s Command Queue</p>
          <h3>{queue?.title || 'Prioritized action queue'}</h3>
          <p>{queue?.summary || 'The Conductor will walk you through the next highest-leverage action.'}</p>
        </div>
        <div className="command-queue-actions">
          <StatusBadge label={`${queue?.completedActionCount ?? 0}/${queue?.targetActionCount ?? actionableItems.length} done`} />
          <button type="button" className="secondary-button compact" onClick={onRefresh} disabled={isWorking}>
            Refresh
          </button>
        </div>
      </header>

      {nextItem ? (
        <div className="command-queue-next">
          <div>
            <span>Next action</span>
            <strong>{nextItem.title}</strong>
            <p>{nextItem.reason}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => onSelect(nextItem)} disabled={isWorking}>
            Start next action
          </button>
        </div>
      ) : (
        <div className="command-queue-empty">
          <strong>No queued actions</strong>
          <p>Refresh the queue after the engine generates more open action items.</p>
        </div>
      )}

      {queue?.items.length ? (
        <div className="command-queue-list">
          {queue.items.slice(0, 12).map((item) => (
            <article className={`command-queue-item status-${item.status}`} key={item.id}>
              <div className="command-queue-position">{item.position}</div>
              <div className="command-queue-main">
                <div className="command-queue-title-row">
                  <strong>{item.title}</strong>
                  <StatusBadge label={item.status.replace(/_/g, ' ')} />
                </div>
                <p>{item.reason || item.ancestry?.campaign?.title || 'Queued campaign action'}</p>
                <div className="command-queue-meta">
                  <span>{item.ancestry?.campaign?.title || 'Campaign'}</span>
                  <span>{item.ancestry?.actionLane?.title || String(item.metadataJson?.['channel'] || 'Lane')}</span>
                  <span>{item.estimatedMinutes ?? 8} min</span>
                  <span>Score {item.priorityScore}</span>
                </div>
              </div>
              <div className="command-queue-row-actions">
                <button type="button" onClick={() => onSelect(item)} disabled={isWorking || !item.actionItemId}>
                  Open
                </button>
                <button type="button" onClick={() => onUpdate(item, 'deferred')} disabled={isWorking || item.status === 'completed'}>
                  Defer
                </button>
                <button type="button" onClick={() => onUpdate(item, 'skipped')} disabled={isWorking || item.status === 'completed'}>
                  Skip
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const ActionCanvasShell: React.FC<{
  payload: any;
  isWorking: boolean;
  onCaptureActionFeedback: ActiveWorkspaceProps['onCaptureActionFeedback'];
  onConfirmCanvasAction: ActiveWorkspaceProps['onConfirmCanvasAction'];
  onSaveActionDraft: ActiveWorkspaceProps['onSaveActionDraft'];
  onBuildRecipientQueue: ActiveWorkspaceProps['onBuildRecipientQueue'];
  onSelectRecipient: ActiveWorkspaceProps['onSelectRecipient'];
  onClearRecipient: ActiveWorkspaceProps['onClearRecipient'];
  onRefineDraft: ActiveWorkspaceProps['onRefineDraft'];
  onStartDiscoveryScan: ActiveWorkspaceProps['onStartDiscoveryScan'];
  onAcceptDiscoveryTarget: ActiveWorkspaceProps['onAcceptDiscoveryTarget'];
  onRejectDiscoveryTarget: ActiveWorkspaceProps['onRejectDiscoveryTarget'];
  campaignWorkspace: CampaignWorkspace | null;
}> = ({ payload, isWorking, onCaptureActionFeedback, onConfirmCanvasAction, onSaveActionDraft, onBuildRecipientQueue, onSelectRecipient, onClearRecipient, onRefineDraft, onStartDiscoveryScan, onAcceptDiscoveryTarget, onRejectDiscoveryTarget, campaignWorkspace }) => {
  const [contextCollapsed, setContextCollapsed] = useState(true);
  const actionItem = payload.actionItem;
  const shouldPrepareRecipientQueue = needsRecipientQueue(payload);
  const Panel = shouldPrepareRecipientQueue ? RecipientQueuePreparation : actionPanelFor(payload.panelType);

  return (
    <div className="action-canvas-shell tour-region-action">
      <header className="action-canvas-header">
        <div className="header-main">
          <div className="title-row">
            <h3>{actionItem?.title || 'Action item'}</h3>
            <button 
              type="button" 
              className="context-toggle-btn"
              onClick={() => setContextCollapsed(!contextCollapsed)}
              title={contextCollapsed ? "Show context" : "Hide context"}
            >
              {contextCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
          <p className="campaign-context-line">{payload.campaign?.title || 'Campaign'}</p>
        </div>
        <StatusBadge label={actionItem?.status || 'ready'} />
      </header>

      {!contextCollapsed && (
        <div className="action-context-collapsible">
          {payload.explanation && (
            <section className="action-explanation-compact">
              <p>{payload.explanation}</p>
            </section>
          )}

          <section className="action-canvas-context-grid">
            <div><span>Lane</span><strong>{payload.actionLane?.title || 'Action lane'}</strong></div>
            <div>
              <span>Target</span>
              <strong>
                {payload.context?.targetLabel || 'Campaign audience'}
                {!shouldPrepareRecipientQueue && (payload.actionItem?.targetPersonId || payload.actionItem?.targetCompanyId) && (
                  <button 
                    type="button"
                    className="change-target-btn" 
                    onClick={() => onClearRecipient(payload.actionItem.id)} 
                    disabled={isWorking}
                  >
                    <RefreshCw size={10} />
                    Change Target
                  </button>
                )}
              </strong>
            </div>
            <div><span>Provider</span><strong>{payload.context?.externalProvider || 'Manual'}</strong></div>
          </section>
        </div>
      )}

      <Panel
        payload={payload}
        isWorking={isWorking}
        onConfirmCanvasAction={onConfirmCanvasAction}
        onSaveActionDraft={onSaveActionDraft}
        onBuild={onBuildRecipientQueue}
        onSelect={onSelectRecipient}
        onStartDiscoveryScan={onStartDiscoveryScan}
        onAcceptDiscoveryTarget={onAcceptDiscoveryTarget}
        onRejectDiscoveryTarget={onRejectDiscoveryTarget}
        onRefineDraft={onRefineDraft}
        campaignWorkspace={campaignWorkspace}
      />
    </div>
  );
};

const EmailActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction, onSaveActionDraft, onRefineDraft, onStartDiscoveryScan, onAcceptDiscoveryTarget, onRejectDiscoveryTarget }) => {
  const [draft, setDraft] = useState(payload.actionItem?.draftContent || '');

  React.useEffect(() => {
    setDraft(payload.actionItem?.draftContent || '');
  }, [payload.actionItem?.id, payload.actionItem?.draftContent]);

  return (
    <section className="action-canvas-card">
      <h4>Email action</h4>
      <div className="action-draft-editor">
        <label>
          <span>Draft / instructions</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Draft the email for this recipient and campaign angle..."
          />
        </label>
        {onRefineDraft && (
          <DraftRefiner
            isWorking={isWorking}
            onRefine={async (instructions) => {
              const result = await onRefineDraft({
                actionItemId: payload.actionItem.id,
                currentContent: draft,
                instructions,
                campaignTitle: payload.campaign?.title,
                targetName: payload.context?.targetPersonName,
              });
              setDraft(result);
            }}
          />
        )}
      </div>
      <div className="action-command-row">
        <button type="button" onClick={() => onSaveActionDraft({ actionItemId: payload.actionItem.id, draftContent: draft })} disabled={isWorking || !draft.trim()}>
          Save draft
        </button>
        <button type="button" onClick={() => onConfirmCanvasAction({ actionItemId: payload.actionItem.id, finalContent: draft })} disabled={isWorking || !draft.trim()}>
          Confirm sent
        </button>
      </div>
    </section>
  );
};

const RecipientQueuePreparation: React.FC<ActionPanelProps & { 
  onBuild: ActiveWorkspaceProps['onBuildRecipientQueue'], 
  onSelect: ActiveWorkspaceProps['onSelectRecipient']
}> = (props) => {
  const { payload, isWorking, onBuild, onSelect, onStartDiscoveryScan, onAcceptDiscoveryTarget, onRejectDiscoveryTarget, campaignWorkspace } = props;
  const [queue, setQueue] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [targetSearch, setTargetSearch] = React.useState('');
  const [refinement, setRefinement] = React.useState('');
  const [activeRefinement, setActiveRefinement] = React.useState('');
  const channelLabel = payload.actionLane?.title || payload.panelType || 'Channel';
  const campaignTitle = payload.campaign?.title || 'this campaign';
  const actionItemId = payload.actionItem?.id;
  const persistedQueue = React.useMemo(() => {
    const laneId = payload.actionLane?.id;
    return (campaignWorkspace?.targetQueue ?? [])
      .filter((item) => !laneId || !item.actionLaneId || item.actionLaneId === laneId)
      .map((item) => ({
        ...item,
        id: item.id,
        queueItemId: item.queueItemId,
        source: item.source,
        score: item.score,
        reason: item.reason || 'Ranked from the durable campaign target queue.',
      }));
  }, [campaignWorkspace?.targetQueue, payload.actionLane?.id]);
  const refinementPresets = React.useMemo(() => [
    'Prioritize CTOs, CIOs, and VP Engineering leaders.',
    'Find warmest relationship paths first.',
    'Focus on financial services and capital markets.',
    'Show AI-native software engineering buyers.',
    'Prefer people with recent senior leadership roles.',
  ], []);

  const fetchQueue = React.useCallback(async (nextRefinement?: string) => {
    if (!payload.campaign?.id) return;
    const normalizedRefinement = (nextRefinement ?? activeRefinement).trim();
    setAttempted(true);
    setError(null);
    setLoading(true);
    try {
      const buildInput: { campaignId: string; actionLaneId?: string; limit?: number; refinement?: string; forceRefresh?: boolean } = {
        campaignId: payload.campaign.id, 
        actionLaneId: payload.actionLane?.id,
        limit: 12,
      };
      if (normalizedRefinement) {
        buildInput.refinement = normalizedRefinement;
        buildInput.forceRefresh = true;
      }
      const result = await onBuild(buildInput);
      if (result.error) {
        setError(result.error);
      }
      if (result.queue) {
        setQueue(result.queue);
        setActiveRefinement(normalizedRefinement);
      }
    } catch (e) {
      console.error('Failed to build recipient queue', e);
      setError(e instanceof Error ? e.message : 'The recipient queue could not be built.');
    } finally {
      setLoading(false);
    }
  }, [activeRefinement, onBuild, payload.campaign?.id, payload.actionLane?.id]);

  React.useEffect(() => {
    if (!attempted && queue.length === 0 && persistedQueue.length > 0) {
      setQueue(persistedQueue);
      setAttempted(true);
      return;
    }
    if (!attempted && queue.length === 0 && persistedQueue.length === 0 && !loading) {
      void fetchQueue();
    }
  }, [attempted, fetchQueue, persistedQueue, queue.length, loading]);

  const displayedQueue = React.useMemo(() => {
    const query = targetSearch.trim().toLowerCase();
    if (!query) return queue;
    return queue.filter((item) => [
      item.name,
      item.title,
      item.company,
      item.reason,
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [queue, targetSearch]);

  const [isDiscoveryMode, setIsDiscoveryMode] = React.useState(false);
  const [selectedSignals, setSelectedSignals] = React.useState<string[]>([]);
  const signalPresets = ['Hiring Engineers', 'Recent Funding', 'AI Product Launch', 'New Executive'];

  const toggleSignal = (signal: string) => {
    setSelectedSignals(prev => 
      prev.includes(signal) ? prev.filter(s => s !== signal) : [...prev, signal]
    );
  };

  const [reviewTargets, setReviewTargets] = React.useState<any[]>([]);
  const [reviewIndex, setReviewIndex] = React.useState(0);

  const startReview = React.useCallback(async (scanResult: any) => {
    if (scanResult.targets && scanResult.targets.length > 0) {
      setReviewTargets(scanResult.targets);
      setReviewIndex(0);
    }
  }, []);

  const handleTriage = React.useCallback(async (action: 'accept' | 'reject') => {
    const target = reviewTargets[reviewIndex];
    if (!target) return;

    try {
      if (action === 'accept') {
        // Backend promotion logic would go here
        await onAcceptDiscoveryTarget(target.id);
      } else {
        await onRejectDiscoveryTarget(target.id);
      }
    } catch (e) {
      console.error('Triage failed', e);
    }

    if (reviewIndex < reviewTargets.length - 1) {
      setReviewIndex(reviewIndex + 1);
    } else {
      // Finished review
      setReviewTargets([]);
      void fetchQueue(); // Refresh the main queue to show new additions
    }
  }, [reviewTargets, reviewIndex, onAcceptDiscoveryTarget, onRejectDiscoveryTarget, fetchQueue]);

  const isUrl = refinement.trim().startsWith('http');

  const submitRefinement = React.useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    try {
      const scanInput = {
        query: refinement,
        providerKeys: isUrl ? ['web_crawler'] : ['tavily_search'],
        context: {
          targetUrls: isUrl ? [refinement.trim()] : [],
          signals: selectedSignals
        }
      };
      const result = await onStartDiscoveryScan(scanInput as any);
      if (result && result.targets) {
        startReview(result);
      }
    } catch (e) {
      setError('Scan failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [refinement, isDiscoveryMode, isUrl, onStartDiscoveryScan, selectedSignals, startReview]);

  const applyPreset = React.useCallback((preset: string) => {
    setRefinement(preset);
    if (isDiscoveryMode) return;
    void fetchQueue(preset);
  }, [fetchQueue, isDiscoveryMode]);

  return (
    <section className="recipient-prep-panel-compact">
      {reviewTargets.length > 0 && (
        <div className="discovery-triage-overlay">
          <div className="triage-card">
            <header className="triage-header">
              <div className="triage-count">Reviewing Lead {reviewIndex + 1} of {reviewTargets.length}</div>
              <button className="close-triage" onClick={() => setReviewTargets([])}>×</button>
            </header>
            
            <div className="triage-body">
              <div className="triage-main-info">
                <h2>{reviewTargets[reviewIndex].personName || reviewTargets[reviewIndex].companyName}</h2>
                <p className="triage-role">{reviewTargets[reviewIndex].roleTitle} @ {reviewTargets[reviewIndex].companyName}</p>
                
                {reviewTargets[reviewIndex].linkedinUrl && (
                  <a 
                    href={reviewTargets[reviewIndex].linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="triage-linkedin-link"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    View LinkedIn Profile
                  </a>
                )}

                <div className="triage-signals">
                  {reviewTargets[reviewIndex].metadata?.signals?.map((s: string) => (
                    <span key={s} className="signal-pill-active"><Zap size={10} /> {s}</span>
                  ))}
                  <span className="relevance-score">{reviewTargets[reviewIndex].relevanceScore}% Match</span>
                </div>
              </div>

              <div className="triage-justification">
                <label>Why this target?</label>
                <p>{reviewTargets[reviewIndex].whyThisTarget}</p>
              </div>

              {reviewTargets[reviewIndex].evidence && reviewTargets[reviewIndex].evidence.length > 0 && (
                <div className="triage-evidence">
                  <label>Evidence</label>
                  <div className="evidence-snippet">
                    {reviewTargets[reviewIndex].evidence[0].snippet}
                  </div>
                </div>
              )}
            </div>

            <footer className="triage-footer">
              <button className="triage-btn reject" onClick={() => handleTriage('reject')}>
                <AlertCircle size={18} />
                Skip Target
              </button>
              <button className="triage-btn accept" onClick={() => handleTriage('accept')}>
                <CheckCircle size={18} />
                Promote to Queue
              </button>
            </footer>
          </div>
        </div>
      )}

      <div className="target-workbench-header">
        <div>
          <h4>Build the target queue</h4>
          <p>Search ranked targets or ask the Conductor to refine criteria for <strong>{campaignTitle}</strong>.</p>
        </div>
        <StatusBadge label={loading ? 'Ranking...' : `${displayedQueue.length}/${queue.length} targets`} />
      </div>

      <div className="target-workbench-compact">
        <label className="target-search-box-minimal">
          <Search size={16} />
          <input
            value={targetSearch}
            onChange={(event) => setTargetSearch(event.target.value)}
            placeholder="Search targets..."
          />
        </label>
        <form className={`target-refinement-box-compact ${isDiscoveryMode ? 'discovery-active' : ''}`} onSubmit={submitRefinement}>
          <div className="target-refinement-heading-compact">
            <div className="heading-left-compact">
              <SlidersHorizontal size={16} />
              <strong>Criteria</strong>
            </div>
            <div className="discovery-toggle-group-compact">
              <button 
                type="button" 
                className={`discovery-toggle-compact ${isDiscoveryMode ? 'active' : ''}`}
                onClick={() => setIsDiscoveryMode(!isDiscoveryMode)}
              >
                <Globe size={12} />
                Deep Scan
              </button>
            </div>
          </div>

          {isDiscoveryMode && (
            <div className="discovery-signals-row-compact">
              <div className="signal-badges-compact">
                {signalPresets.map(signal => (
                  <button
                    key={signal}
                    type="button"
                    className={`signal-badge-compact ${selectedSignals.includes(signal) ? 'active' : ''}`}
                    onClick={() => toggleSignal(signal)}
                  >
                    {signal}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="target-refinement-input-row-compact">
            <input
              value={refinement}
              onChange={(event) => setRefinement(event.target.value)}
              placeholder={isDiscoveryMode ? "URL or Market (e.g. 'CTOs in Toronto')..." : "Criteria (e.g. 'CTOs in banks')..."}
            />
            <button type="submit" className={isDiscoveryMode || isUrl ? 'discovery-button-compact' : ''} disabled={loading || isWorking || !refinement.trim()}>
              {isUrl ? 'Scan' : (isDiscoveryMode ? 'Scan' : 'Apply')}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="recipient-scan-list loading">
          <div className="recipient-scan-row active">
            <div className="report-icon"><RefreshCw size={20} className="spin" /></div>
            <div>
              <strong>Ranking high-signal targets</strong>
              <p>Applying role, company, industry, relationship, and campaign-fit scoring rules...</p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="recipient-empty">
          <div className="recipient-empty-icon">
            <AlertCircle size={20} />
          </div>
          <h5>Recipient ranking did not complete</h5>
          <p>{error}</p>
          <button className="recipient-retry-button" onClick={() => void fetchQueue()} disabled={isWorking}>
            <RefreshCw size={16} />
            Retry ranking
          </button>
        </div>
      ) : queue.length > 0 ? (
        <div className="recipient-ranked-list">
          {displayedQueue.length === 0 ? (
            <div className="recipient-empty compact">
              <div className="recipient-empty-icon">
                <Search size={20} />
              </div>
              <h5>No targets match this search</h5>
              <p>Clear the search field or refine the ranking criteria to explore a different slice of the relationship graph.</p>
            </div>
          ) : displayedQueue.map((item) => {
            const linkedInUrl = externalProfileUrl(item.linkedinUrl ?? item.profileUrl ?? item.url);
            return (
              <article key={item.id} className="recipient-ranked-card">
                <div className="recipient-info">
                  <div className="recipient-name-row">
                    <strong>{item.name}</strong>
                    <span className="score-pill">{item.score}% match</span>
                  </div>
                  <p className="recipient-title">{item.title} @ {item.company}</p>
                  <p className="recipient-reason">{item.reason}</p>
                </div>
                <div className="recipient-actions">
                  {linkedInUrl ? (
                    <a
                      className="open-linkedin-btn"
                      href={linkedInUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open LinkedIn
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="select-target-btn"
                    onClick={() => onSelect({
                      actionItemId,
                      targetQueueItemId: item.queueItemId,
                      personId: item.personId || (item.source === 'person' ? item.id : undefined),
                      connectionRecordId: item.connectionRecordId || (item.source === 'connection' ? item.id : undefined)
                    })}
                    disabled={isWorking}
                  >
                    Select & Draft
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="recipient-empty">
          <div className="recipient-empty-icon">
            <User size={20} />
          </div>
          <h5>No ranked recipients yet</h5>
          <p>No suitable targets were returned from your current contact list. This may mean the imported relationship data is empty, too sparse, or not matched to this campaign.</p>
          <button className="recipient-retry-button" onClick={() => void fetchQueue()} disabled={isWorking}>
            <RefreshCw size={16} />
            Retry ranking
          </button>
        </div>
      )}

      <div className="action-command-row">
        <p className="footer-note">Selecting a target will automatically promote them to your workspace and generate the initial draft.</p>
      </div>
    </section>
  );
};

const LinkedInDmActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction, onSaveActionDraft, onRefineDraft, onStartDiscoveryScan, onAcceptDiscoveryTarget, onRejectDiscoveryTarget }) => {
  const [draft, setDraft] = useState(payload.actionItem?.draftContent || '');

  React.useEffect(() => {
    setDraft(payload.actionItem?.draftContent || '');
  }, [payload.actionItem?.id, payload.actionItem?.draftContent]);

  return (
    <section className="action-canvas-card">
      <h4>LinkedIn DM action</h4>
      <div className="action-draft-editor">
        <label>
          <span>DM draft / execution notes</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Draft the LinkedIn DM or execution notes..."
          />
        </label>
        {onRefineDraft && (
          <DraftRefiner
            isWorking={isWorking}
            onRefine={async (instructions) => {
              const result = await onRefineDraft({
                actionItemId: payload.actionItem.id,
                currentContent: draft,
                instructions,
                campaignTitle: payload.campaign?.title,
                targetName: payload.context?.targetPersonName,
              });
              setDraft(result);
            }}
          />
        )}
      </div>
      <div className="action-command-row">
        {payload.context?.externalUrl ? (
          <a href={payload.context.externalUrl} target="_blank" rel="noreferrer">Open LinkedIn</a>
        ) : <button type="button" disabled>Open LinkedIn</button>}
        <button type="button" onClick={() => onSaveActionDraft({ actionItemId: payload.actionItem.id, draftContent: draft })} disabled={isWorking || !draft.trim()}>
          Save draft
        </button>
        <button type="button" onClick={() => onConfirmCanvasAction({ actionItemId: payload.actionItem.id, finalContent: draft })} disabled={isWorking || !draft.trim()}>
          Confirm sent
        </button>
      </div>
    </section>
  );
};

const ContentActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction, onSaveActionDraft, onStartDiscoveryScan, onAcceptDiscoveryTarget, onRejectDiscoveryTarget }) => {
  const [draft, setDraft] = useState(payload.actionItem?.draftContent || '');

  React.useEffect(() => {
    setDraft(payload.actionItem?.draftContent || '');
  }, [payload.actionItem?.id, payload.actionItem?.draftContent]);

  return (
    <section className="action-canvas-card">
      <h4>Content action</h4>
      <div className="action-draft-editor">
        <label>
          <span>Content draft / plan</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Draft the post, script, comment, or content plan..."
          />
        </label>
      </div>
      <div className="action-command-row">
        <button type="button" onClick={() => onSaveActionDraft({ actionItemId: payload.actionItem.id, draftContent: draft })} disabled={isWorking || !draft.trim()}>
          Save content
        </button>
        <button type="button" onClick={() => onConfirmCanvasAction({ actionItemId: payload.actionItem.id, finalContent: draft, outcome: 'published_confirmed' })} disabled={isWorking || !draft.trim()}>
          Confirm published
        </button>
      </div>
    </section>
  );
};

const GenericActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction, onStartDiscoveryScan, onAcceptDiscoveryTarget, onRejectDiscoveryTarget }) => (
  <section className="action-canvas-card">
    <h4>Action details</h4>
    <div className="action-draft-block">
      <span>Instructions</span>
      <p>{payload.actionItem?.instructions || 'Review this action with the Conductor, complete it externally if needed, then confirm the result.'}</p>
    </div>
    <button type="button" className="feedback-capture-button" onClick={() => onConfirmCanvasAction({ actionItemId: payload.actionItem.id })} disabled={isWorking}>
      Confirm complete
    </button>
  </section>
);

const DraftRefiner: React.FC<{
  onRefine: (instructions: string) => Promise<void>;
  isWorking: boolean;
}> = ({ onRefine, isWorking }) => {
  const [instructions, setInstructions] = useState('');

  const handleRefine = () => {
    if (!instructions.trim()) return;
    void onRefine(instructions).then(() => setInstructions(''));
  };

  return (
    <div className="draft-refiner-toolbar" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
      <input
        type="text"
        className="form-control"
        placeholder="Ask the AI to refine this draft (e.g. 'Make it shorter')"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleRefine();
        }}
        disabled={isWorking}
        style={{ flex: 1 }}
      />
      <button type="button" className="secondary-btn" onClick={handleRefine} disabled={isWorking || !instructions.trim()}>
        Refine
      </button>
    </div>
  );
};

interface ActionPanelProps {
  payload: any;
  isWorking: boolean;
  onConfirmCanvasAction: ActiveWorkspaceProps['onConfirmCanvasAction'];
  onSaveActionDraft: ActiveWorkspaceProps['onSaveActionDraft'];
  onRefineDraft?: ActiveWorkspaceProps['onRefineDraft'];
  onStartDiscoveryScan: ActiveWorkspaceProps['onStartDiscoveryScan'];
  onAcceptDiscoveryTarget: ActiveWorkspaceProps['onAcceptDiscoveryTarget'];
  onRejectDiscoveryTarget: ActiveWorkspaceProps['onRejectDiscoveryTarget'];
  campaignWorkspace?: CampaignWorkspace | null;
}

function actionPanelFor(panelType: string): React.FC<ActionPanelProps> {
  if (panelType === 'email') return EmailActionPanel;
  if (panelType === 'linkedin_dm') return LinkedInDmActionPanel;
  if (panelType === 'linkedin_post' || panelType === 'content') return ContentActionPanel;
  return GenericActionPanel;
}

function needsRecipientQueue(payload: any): boolean {
  const targetLabel = String(payload?.context?.targetLabel || '').trim().toLowerCase();
  const title = String(payload?.actionItem?.title || '').toLowerCase();
  const instructions = String(payload?.actionItem?.instructions || '').toLowerCase();
  const hasConcreteTarget = Boolean(
    payload?.actionItem?.targetPersonId ||
    payload?.actionItem?.targetCompanyId ||
    payload?.context?.targetPersonName ||
    payload?.context?.targetCompanyName,
  );

  if (hasConcreteTarget) return false;
  if (['email', 'linkedin_dm'].includes(payload?.panelType) && ['person', 'company', 'campaign audience', ''].includes(targetLabel)) {
    return true;
  }
  return title.includes('select') || instructions.includes('choose the first contact') || instructions.includes('suggested recipients');
}

const CycleWorkspace: React.FC<{
  cycle: any;
  recommendation: any;
  campaignWorkspace: CampaignWorkspace | null;
  isWorking: boolean;
  onCommand: (body: WorkspaceCommandPayload, success: string) => Promise<void>;
  onGenerateDraft: () => Promise<void>;
  onGenerateDraftForOpportunity: (opportunityId: string, kind?: 'initial' | 'follow_up') => Promise<void>;
}> = ({ cycle, recommendation, campaignWorkspace, isWorking, onCommand, onGenerateDraft, onGenerateDraftForOpportunity }) => (
  <div className="cycle-workspace">
    <h3>Cycle Workspace</h3>
    <p>Cycle: {cycle?.title}</p>
    <p>Recommendation: {recommendation?.title}</p>
    <button onClick={onGenerateDraft} disabled={isWorking}>
      Generate Draft
    </button>
  </div>
);

const CanvasEmptyState: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div className="canvas-empty-state">
    <h3>{title}</h3>
    <p>{detail}</p>
  </div>
);

const StrategicPlanWorkspace: React.FC<{
  preview: StrategicPlanResult | null;
  isWorking: boolean;
  mode: 'planning' | 'campaign_ready';
  onPreview?: () => void;
  onFinalize?: () => void;
  onContinue?: () => void;
}> = ({ preview, isWorking, mode, onPreview, onFinalize, onContinue }) => (
  <div className="strategic-plan-workspace">
    <h3>Strategic Plan</h3>
    <p>Mode: {mode}</p>
    {mode === 'planning' && (
      <>
        <button onClick={onPreview} disabled={isWorking}>Preview</button>
        <button onClick={onFinalize} disabled={isWorking}>Finalize</button>
      </>
    )}
    {mode === 'campaign_ready' && (
      <button onClick={onContinue} disabled={isWorking}>Continue</button>
    )}
  </div>
);

const PlanningWorkspace: React.FC<{ cycle: any; recommendation: any }> = ({ cycle, recommendation }) => (
  <div className="planning-workspace">
    <h3>Planning Workspace</h3>
    <p>Cycle: {cycle?.title}</p>
    <p>Recommendation: {recommendation?.title}</p>
  </div>
);

function compactLabel(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function metadataLabel(item: CommandQueueItem, key: string): string | null {
  const value = item.metadataJson?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function externalProfileUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)?linkedin\.com\//i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function uniqueByIdOrTitle<T extends { id?: string | null; title?: string | null; name?: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id ?? item.title ?? item.name ?? JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const OperatingMapWorkspace: React.FC<{
  workspace: WorkspaceState | null;
  campaignWorkspace: CampaignWorkspace | null;
  offerings: OfferingSummary[];
  campaigns: CampaignSummary[];
  emailReadiness: EmailReadiness | null;
  commandQueue: CommandQueueState | null;
  intelligenceArtifacts: any[];
  intelligenceJobs: any[];
  intelligenceChunks: any[];
  userAssets: any[];
  activationPayload: WorkspaceActivationPayload | null;
  actionCanvasPayload: any | null;
  isWorking: boolean;
  onSelectCommandQueueItem: ActiveWorkspaceProps['onSelectCommandQueueItem'];
  onChangeMode: ActiveWorkspaceProps['onChangeMode'];
  onExtendedLogoutAndPurge: ActiveWorkspaceProps['onExtendedLogoutAndPurge'];
  onCreateOffering: ActiveWorkspaceProps['onCreateOffering'];
  onUpdateOffering: ActiveWorkspaceProps['onUpdateOffering'];
  onCreateCampaign: ActiveWorkspaceProps['onCreateCampaign'];
  onUpdateCampaign: ActiveWorkspaceProps['onUpdateCampaign'];
}> = (props) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    commercial: false,
    knowledge: false,
    contacts: false,
    execution: false,
    system: false,
  });
  const [detail, setDetail] = useState<{ title: string; eyebrow: string; data: any } | null>(null);
  const [mapEditorMode, setMapEditorMode] = useState<'offering' | 'campaign' | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [offeringForm, setOfferingForm] = useState<{ title: string; description: string; offeringType: OfferingType }>({
    title: '',
    description: '',
    offeringType: 'service',
  });
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    description: '',
    targetSegment: '',
    objective: '',
    strategicAngle: '',
  });
  const [isOfferingDropdownOpen, setIsOfferingDropdownOpen] = useState(false);
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const activeCampaign = props.actionCanvasPayload?.campaign
    ?? props.campaignWorkspace?.campaign
    ?? props.activationPayload?.campaign
    ?? props.commandQueue?.items.find((item) => item.ancestry?.campaign)?.ancestry?.campaign
    ?? null;
  const activeOffering = props.commandQueue?.items.find((item) => item.ancestry?.offering)?.ancestry?.offering
    ?? props.campaignWorkspace?.campaign?.offering
    ?? null;
  const selectedOffering = props.offerings.find((offering) => offering.id === selectedOfferingId)
    ?? props.offerings.find((offering) => offering.id === activeOffering?.id)
    ?? props.offerings[0]
    ?? null;
  const campaignsForSelectedOffering = props.campaigns.filter((campaign) => (
    selectedOffering ? campaign.offeringId === selectedOffering.id : true
  ));
  const selectedCampaign = props.campaigns.find((campaign) => campaign.id === selectedCampaignId)
    ?? campaignsForSelectedOffering.find((campaign) => campaign.id === activeCampaign?.id)
    ?? campaignsForSelectedOffering[0]
    ?? props.campaigns[0]
    ?? null;
  const activeAction = props.actionCanvasPayload?.actionItem ?? null;
  const activeLane = props.actionCanvasPayload?.actionLane
    ?? props.activationPayload?.lane
    ?? props.commandQueue?.items.find((item) => item.ancestry?.actionLane)?.ancestry?.actionLane
    ?? null;
  const queueItems = props.commandQueue?.items ?? [];
  const campaignChannels = uniqueByIdOrTitle([
    ...(activeLane ? [activeLane] : []),
    ...queueItems.map((item) => item.ancestry?.actionLane).filter(Boolean),
  ] as Array<{ id?: string | null; title?: string | null; name?: string | null; description?: string | null }>);
  const currentCampaignTitle = compactLabel(selectedCampaign?.title ?? activeCampaign?.title ?? activeCampaign?.name, 'No campaign selected');
  const offeringTitle = compactLabel(selectedOffering?.title ?? activeOffering?.title ?? activeOffering?.name, 'Current offering');
  const openActions = queueItems.filter((item) => !['completed', 'skipped', 'deferred'].includes(item.status)).length;
  const prospects = props.campaignWorkspace?.prospects ?? [];
  const targetQueue = props.campaignWorkspace?.targetQueue ?? [];
  const visibleTargets = targetQueue.length > 0 ? targetQueue : prospects.map((prospect) => ({
    id: prospect.id,
    name: prospect.primaryPersonName ?? prospect.companyName,
    title: prospect.primaryPersonTitle ?? prospect.stage,
    company: prospect.companyName,
    score: prospect.fitScore ?? prospect.qualificationScore ?? null,
    reason: prospect.summary,
    linkedinUrl: null,
    raw: prospect,
  }));
  const connectorArtifacts = props.intelligenceArtifacts.filter((artifact) => artifact?.sourceType !== 'knowledge_asset');
  const linkedinArtifacts = props.intelligenceArtifacts.filter(a => 
    a.sourceType === 'linkedin_archive' || 
    a.sourceKind === 'linkedin_archive_file' ||
    a.providerName === 'linkedin'
  );
  const otherArtifacts = props.intelligenceArtifacts.filter(a => 
    a.sourceType !== 'linkedin_archive' && 
    a.sourceKind !== 'linkedin_archive_file' &&
    a.providerName !== 'linkedin'
  );

  const knowledgeItems = [
    // 1. Core Priority Assets (Resume, Book)
    ...props.userAssets
      .filter(a => ['resume', 'book'].includes(a.category))
      .map((asset) => ({
        id: asset.id,
        title: asset.displayName ?? asset.fileName ?? 'Core Asset',
        subtitle: asset.category.charAt(0).toUpperCase() + asset.category.slice(1),
        status: asset.status ?? 'processed',
        kind: 'Core',
        isPriority: true,
        raw: asset,
      })),
    // 2. Standard User Uploads
    ...props.userAssets
      .filter(a => !['resume', 'book'].includes(a.category))
      .map((asset) => ({
        id: asset.id,
        title: asset.displayName ?? asset.fileName ?? 'Uploaded asset',
        subtitle: asset.category ?? asset.mimeType ?? 'Manual upload',
        status: asset.status ?? 'processed',
        kind: 'Asset',
        raw: asset,
      })),
    // 3. LinkedIn Bundle (Summary instead of 98 rows)
    ...(linkedinArtifacts.length > 0 ? [{
      id: 'linkedin-bundle',
      title: 'LinkedIn Personal Archive',
      subtitle: `${linkedinArtifacts.length} data points (CSVs, media, connections)`,
      status: 'analyzed',
      kind: 'Archive',
      isBundle: true,
      raw: linkedinArtifacts,
    }] : []),
    // 4. Other Artifacts (Non-LinkedIn)
    ...otherArtifacts.map((artifact) => {
      // Logic to determine if this should be a "Core" asset based on name
      const lowerName = (artifact.sourceName || artifact.title || '').toLowerCase();
      const isCoreCandidate = lowerName.includes('resume') || lowerName.includes('book');
      
      return {
        id: artifact.id,
        title: artifact.sourceName ?? artifact.title ?? 'Ingestion artifact',
        subtitle: isCoreCandidate ? 'Potential Core Knowledge' : (artifact.sourceType ?? 'Intelligence artifact'),
        status: artifact.status ?? 'staged',
        kind: isCoreCandidate ? 'Core' : 'Artifact',
        isPriority: isCoreCandidate,
        raw: artifact,
      };
    }),
  ];
  const chunkCount = props.intelligenceChunks.length;
  const runningJobs = props.intelligenceJobs.filter((job) => ['queued', 'running', 'processing'].includes(String(job?.status ?? '').toLowerCase())).length;

  const toggleSection = (key: string) => {
    setExpandedSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const openCommandItem = (item: CommandQueueItem) => {
    props.onChangeMode('command');
    void props.onSelectCommandQueueItem(item);
  };

  const openDetail = (eyebrow: string, title: string, data: any) => {
    setDetail({ eyebrow, title, data });
  };

  const getCampaignStatusClass = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'status-active';
      case 'paused': return 'status-paused';
      case 'scanning': return 'status-scanning';
      default: return 'status-active';
    }
  };

  const loadOfferingForEdit = (offering: OfferingSummary) => {
    setSelectedOfferingId(offering.id);
    setMapEditorMode('offering');
    setOfferingForm({
      title: offering.title,
      description: offering.description ?? '',
      offeringType: offering.offeringType,
    });
  };

  const loadCampaignForEdit = (campaign: CampaignSummary) => {
    setSelectedCampaignId(campaign.id);
    setMapEditorMode('campaign');
    setCampaignForm({
      title: campaign.title,
      description: campaign.description ?? '',
      targetSegment: campaign.targetSegment ?? '',
      objective: campaign.objective ?? '',
      strategicAngle: campaign.strategicAngle ?? '',
    });
  };

  const resetOfferingForm = () => {
    setSelectedOfferingId(null);
    setMapEditorMode('offering');
    setOfferingForm({ title: '', description: '', offeringType: 'service' });
  };

  const resetCampaignForm = () => {
    setSelectedCampaignId(null);
    setMapEditorMode('campaign');
    setCampaignForm({
      title: selectedOffering ? `${selectedOffering.title} campaign` : '',
      description: '',
      targetSegment: '',
      objective: '',
      strategicAngle: '',
    });
  };

  const saveOffering = async () => {
    const title = offeringForm.title.trim();
    if (!title) return;
    const input: { title: string; description?: string; offeringType: OfferingType } = {
      title,
      offeringType: offeringForm.offeringType,
    };
    const description = offeringForm.description.trim();
    if (description) input.description = description;
    if (selectedOfferingId) {
      await props.onUpdateOffering(selectedOfferingId, input);
      setMapEditorMode(null);
    } else {
      const created = await props.onCreateOffering(input);
      if (created) {
        setSelectedOfferingId(created.id);
        setOfferingForm({
          title: created.title,
          description: created.description ?? '',
          offeringType: created.offeringType,
        });
        setMapEditorMode(null);
      }
    }
  };

  const saveCampaign = async () => {
    const title = campaignForm.title.trim();
    if (!title) return;
    const input: {
      title: string;
      description?: string;
      targetSegment?: string;
      objective?: string;
      strategicAngle?: string;
      offeringId?: string;
    } = {
      title,
    };
    const description = campaignForm.description.trim();
    const targetSegment = campaignForm.targetSegment.trim();
    const objective = campaignForm.objective.trim();
    const strategicAngle = campaignForm.strategicAngle.trim();
    if (description) input.description = description;
    if (targetSegment) input.targetSegment = targetSegment;
    if (objective) input.objective = objective;
    if (strategicAngle) input.strategicAngle = strategicAngle;
    if (selectedCampaignId) {
      await props.onUpdateCampaign(selectedCampaignId, input);
      setMapEditorMode(null);
    } else {
      if (selectedOffering?.id) input.offeringId = selectedOffering.id;
      const created = await props.onCreateCampaign(input);
      if (created) {
        setSelectedCampaignId(created.id);
        setCampaignForm({
          title: created.title,
          description: created.description ?? '',
          targetSegment: created.targetSegment ?? '',
          objective: created.objective ?? '',
          strategicAngle: created.strategicAngle ?? '',
        });
        setMapEditorMode(null);
      }
    }
  };

  const archiveSelectedOffering = async () => {
    if (!selectedOffering) return;
    await props.onUpdateOffering(selectedOffering.id, { status: 'archived' });
  };

  const pauseSelectedCampaign = async () => {
    if (!selectedCampaign) return;
    await props.onUpdateCampaign(selectedCampaign.id, { status: selectedCampaign.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' });
  };

  const renderSection = (
    key: string,
    icon: React.ReactNode,
    title: string,
    summary: string,
    compact: React.ReactNode,
    children: React.ReactNode,
  ) => (
    <section className={`operating-map-section ${expandedSections[key] ? 'expanded' : 'collapsed'}`}>
      <button
        type="button"
        className="operating-map-section-toggle"
        onClick={() => toggleSection(key)}
        aria-expanded={Boolean(expandedSections[key])}
      >
        <span className="operating-map-section-icon">{icon}</span>
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <ChevronRight className={expandedSections[key] ? 'expanded' : ''} size={18} />
      </button>
      <div className="operating-map-compact">{compact}</div>
      {expandedSections[key] ? <div className="operating-map-expanded">{children}</div> : null}
    </section>
  );

  return (
    <section className="active-workspace operating-map-workspace tour-region-canvas">
      <div className="operating-map-header">
        <div>
          <p className="label">Operating map</p>
          <h2>Workspace system of record</h2>
          <p>
            Inspect the commercial structure behind the current execution loop: offering, campaign,
            channels, actions, and target data.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => props.onChangeMode('command')}>
          Return to Command
        </button>
      </div>

      <div className="operating-map-metrics">
        <article 
          className="metric-switcher" 
          onClick={() => setIsOfferingDropdownOpen(!isOfferingDropdownOpen)}
        >
          <div className="metric-switcher-header">
            <span>Offering</span>
            <ChevronDown size={14} color="#94a3b8" />
          </div>
          <strong>{offeringTitle}</strong>
          
          {isOfferingDropdownOpen && (
            <div className="glass-dropdown">
              {props.offerings.map((offering) => (
                <button 
                  key={offering.id}
                  className={`dropdown-item ${offering.id === selectedOffering?.id ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOfferingId(offering.id);
                    setIsOfferingDropdownOpen(false);
                  }}
                >
                  <strong>{offering.title}</strong>
                  <span>{offering.offeringType}</span>
                </button>
              ))}
            </div>
          )}
        </article>

        <article 
          className="metric-switcher" 
          onClick={() => setIsCampaignDropdownOpen(!isCampaignDropdownOpen)}
        >
          <div className="metric-switcher-header">
            <span>Campaign</span>
            <ChevronDown size={14} color="#94a3b8" />
          </div>
          <strong>{currentCampaignTitle}</strong>

          {isCampaignDropdownOpen && (
            <div className="glass-dropdown">
              {campaignsForSelectedOffering.length > 0 ? (
                campaignsForSelectedOffering.map((campaign) => (
                  <button 
                    key={campaign.id}
                    className={`dropdown-item ${campaign.id === selectedCampaign?.id ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCampaignId(campaign.id);
                      setIsCampaignDropdownOpen(false);
                    }}
                  >
                    <strong>
                      <span className={`status-indicator ${getCampaignStatusClass(campaign.status)}`} />
                      {campaign.title}
                    </strong>
                    <span>{campaign.targetSegment || 'No target segment'}</span>
                  </button>
                ))
              ) : (
                <div className="dropdown-item">
                  <span>No campaigns for this offering</span>
                </div>
              )}
            </div>
          )}
        </article>
        <article>
          <span>Channels</span>
          <strong>{campaignChannels.length || props.activationPayload?.selectedActionLaneCount || 0}</strong>
        </article>
        <article>
          <span>Open Actions</span>
          <strong>{openActions}</strong>
        </article>
        <article>
          <span>Known Contacts</span>
          <strong>{targetQueue.length || prospects.length}</strong>
        </article>
        <article>
          <span>Assets</span>
          <strong>{knowledgeItems.length}</strong>
        </article>
      </div>

      <div className="operating-map-grid">
        <div className="operating-map-column">
          {renderSection(
            'commercial',
            <Target size={18} />,
            'Commercial Map',
            `${currentCampaignTitle} through ${campaignChannels.length || 0} channel${campaignChannels.length === 1 ? '' : 's'}.`,
            (
              <div className="operating-map-mini-grid">
                <span>{offeringTitle}</span>
                <span>{currentCampaignTitle}</span>
                <span>{compactLabel(activeLane?.title ?? activeLane?.name, 'No channel selected')}</span>
              </div>
            ),
            (
              <>
                <div className="operating-map-toolbar">
                  <div>
                    <strong>Structure</strong>
                    <span>{props.offerings.length} offerings, {props.campaigns.length} campaigns</span>
                  </div>
                  <div>
                    <button type="button" onClick={resetOfferingForm}>Add offering</button>
                    <button type="button" onClick={resetCampaignForm} disabled={!selectedOffering}>Create campaign</button>
                  </div>
                </div>

                {mapEditorMode ? (
                  <div className="operating-map-crud-grid compact">
                    {mapEditorMode === 'offering' ? (
                      <div className="operating-map-editor">
                        <div className="operating-map-editor-header">
                          <div>
                            <span>Offerings</span>
                            <strong>{selectedOfferingId ? 'Edit offering' : 'Add offering'}</strong>
                          </div>
                          <button type="button" onClick={() => setMapEditorMode(null)}>Close</button>
                        </div>
                        <label>
                          Name
                          <input
                            value={offeringForm.title}
                            onChange={(event) => setOfferingForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder="AI-Native SDLC book"
                          />
                        </label>
                        <label>
                          Type
                          <select
                            value={offeringForm.offeringType}
                            onChange={(event) => setOfferingForm((current) => ({ ...current, offeringType: event.target.value as OfferingType }))}
                          >
                            {['service', 'consulting', 'book', 'product', 'content_series', 'software', 'platform', 'event', 'other'].map((type) => (
                              <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Positioning
                          <textarea
                            value={offeringForm.description}
                            onChange={(event) => setOfferingForm((current) => ({ ...current, description: event.target.value }))}
                            placeholder="Who it is for, what it helps them do, and the best CTA."
                          />
                        </label>
                        <div className="operating-map-editor-actions">
                          <button type="button" className="primary-button" onClick={() => void saveOffering()} disabled={props.isWorking || !offeringForm.title.trim()}>
                            {selectedOfferingId ? 'Save offering' : 'Add offering'}
                          </button>
                          <button type="button" onClick={() => void archiveSelectedOffering()} disabled={props.isWorking || !selectedOffering}>
                            Archive
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {mapEditorMode === 'campaign' ? (
                      <div className="operating-map-editor">
                        <div className="operating-map-editor-header">
                          <div>
                            <span>Campaigns</span>
                            <strong>{selectedCampaignId ? 'Edit campaign' : 'Create campaign'}</strong>
                          </div>
                          <button type="button" onClick={() => setMapEditorMode(null)}>Close</button>
                        </div>
                        <label>
                          Campaign
                          <input
                            value={campaignForm.title}
                            onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder={selectedOffering ? `${selectedOffering.title} campaign` : 'Book launch campaign'}
                          />
                        </label>
                        <label>
                          Target segment
                          <input
                            value={campaignForm.targetSegment}
                            onChange={(event) => setCampaignForm((current) => ({ ...current, targetSegment: event.target.value }))}
                            placeholder="Engineering leaders, podcast hosts, bulk buyers..."
                          />
                        </label>
                        <label>
                          Objective
                          <textarea
                            value={campaignForm.objective}
                            onChange={(event) => setCampaignForm((current) => ({ ...current, objective: event.target.value }))}
                            placeholder="Sell copies, book talks, generate reader conversations, or create consulting pull-through."
                          />
                        </label>
                        <div className="operating-map-editor-actions">
                          <button type="button" className="primary-button" onClick={() => void saveCampaign()} disabled={props.isWorking || !campaignForm.title.trim()}>
                            {selectedCampaignId ? 'Save campaign' : 'Create campaign'}
                          </button>
                          <button type="button" onClick={() => void pauseSelectedCampaign()} disabled={props.isWorking || !selectedCampaign}>
                            {selectedCampaign?.status === 'PAUSED' ? 'Activate' : 'Pause'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="operating-map-tree">
                  <button type="button" className="map-tree-node" onClick={() => openDetail('Offering', offeringTitle, selectedOffering ?? activeOffering)}>
                    <span>Offering</span>
                    <strong>{offeringTitle}</strong>
                  </button>
                  <ChevronRight size={18} />
                  <button type="button" className="map-tree-node" onClick={() => openDetail('Campaign', currentCampaignTitle, selectedCampaign ?? activeCampaign)}>
                    <span>Campaign</span>
                    <strong>{currentCampaignTitle}</strong>
                  </button>
                  <ChevronRight size={18} />
                  <button type="button" className="map-tree-node" onClick={() => openDetail('Channel', compactLabel(activeLane?.title ?? activeLane?.name, 'No channel selected'), activeLane)}>
                    <span>Current Channel</span>
                    <strong>{compactLabel(activeLane?.title ?? activeLane?.name, 'No channel selected')}</strong>
                  </button>
                </div>

                <div className="operating-map-list compact">
                  {props.offerings.length > 0 ? props.offerings.map((offering) => (
                    <article key={offering.id} className={`operating-map-row ${selectedOffering?.id === offering.id ? 'selected' : ''}`}>
                      <div>
                        <strong>{offering.title}</strong>
                        <p>{compactLabel(offering.description, offering.offeringType.replace(/_/g, ' '))}</p>
                        <div className="operating-map-tags">
                          <span>{offering.offeringType.replace(/_/g, ' ')}</span>
                          <span>{offering.status}</span>
                          <span>{props.campaigns.filter((campaign) => campaign.offeringId === offering.id).length} campaigns</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => loadOfferingForEdit(offering)}>Edit</button>
                    </article>
                  )) : (
                    <div className="operating-map-empty">No offerings exist yet. Add one here, then create a campaign from it.</div>
                  )}
                </div>

                <div className="operating-map-list">
                  {campaignsForSelectedOffering.length > 0 ? campaignsForSelectedOffering.map((campaign) => (
                    <article key={campaign.id} className={`operating-map-row ${selectedCampaign?.id === campaign.id ? 'selected' : ''}`}>
                      <div>
                        <strong>{campaign.title}</strong>
                        <p>{compactLabel(campaign.targetSegment ?? campaign.objective ?? campaign.strategicAngle, 'No campaign definition captured yet.')}</p>
                        <div className="operating-map-tags">
                          <span>{String(campaign.status).toLowerCase()}</span>
                          {campaign._count?.actionLanes !== undefined ? <span>{campaign._count.actionLanes} lanes</span> : null}
                          {campaign._count?.actionItems !== undefined ? <span>{campaign._count.actionItems} actions</span> : null}
                        </div>
                      </div>
                      <button type="button" onClick={() => loadCampaignForEdit(campaign)}>Edit</button>
                    </article>
                  )) : (
                    <div className="operating-map-empty">No campaigns are attached to this offering yet.</div>
                  )}
                </div>

                <div className="operating-map-list">
                  {campaignChannels.length > 0 ? campaignChannels.map((channel) => (
                    <article key={channel.id ?? channel.title ?? channel.name} className="operating-map-row">
                      <div>
                        <strong>{compactLabel(channel.title ?? channel.name, 'Untitled channel')}</strong>
                        <p>{compactLabel(channel.description, 'No channel description captured yet.')}</p>
                      </div>
                      <button type="button" onClick={() => openDetail('Channel', compactLabel(channel.title ?? channel.name, 'Untitled channel'), channel)}>Inspect</button>
                    </article>
                  )) : (
                    <div className="operating-map-empty">No campaign channels are loaded yet.</div>
                  )}
                </div>
              </>
            ),
          )}

          {renderSection(
            'knowledge',
            <FileText size={18} />,
            'Knowledge & Assets',
            `${knowledgeItems.length} inputs, ${chunkCount} chunks, ${runningJobs} active jobs.`,
            (
              <div className="operating-map-mini-grid">
                <span>{connectorArtifacts.length} archive artifacts</span>
                <span>{props.userAssets.length} uploaded assets</span>
                <span>{chunkCount} shredded chunks</span>
              </div>
            ),
            (
              <div className="operating-map-list">
                {knowledgeItems.length > 0 ? knowledgeItems.map((item: any) => (
                  <article 
                    key={`${item.kind}-${item.id}`} 
                    className={`operating-map-row ${item.isPriority ? 'priority-asset' : ''} ${item.isBundle ? 'bundle-asset' : ''}`}
                  >
                    <div>
                      <div className="title-row">
                        <strong>{item.title}</strong>
                        {item.isPriority && <span className="priority-badge">Core Knowledge</span>}
                      </div>
                      <p>{item.subtitle}</p>
                      <div className="operating-map-tags">
                        <span>{item.kind}</span>
                        <span>{item.status}</span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => openDetail(item.kind, item.title, item.raw)}
                    >
                      {item.isBundle ? 'Expand Bundle' : 'Inspect'}
                    </button>
                  </article>
                )) : (
                  <div className="operating-map-empty">
                    No asset or intelligence records are visible yet. Upload a resume, book, LinkedIn archive, or Drive document to populate this section.
                  </div>
                )}
              </div>
            ),
          )}
        </div>

        <div className="operating-map-column">
          {renderSection(
            'execution',
            <Layout size={18} />,
            'Execution',
            `${openActions} open actions in today's command queue.`,
            (
              <div className="operating-map-mini-grid">
                <span>{queueItems.length} queued</span>
                <span>{compactLabel(activeAction?.title, 'No active action')}</span>
              </div>
            ),
            (
              <div className="operating-map-list">
                {queueItems.length > 0 ? queueItems.map((item) => (
                  <article key={item.id} className={`operating-map-row status-${item.status}`}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.reason ?? metadataLabel(item, 'channel') ?? 'No reason captured.'}</p>
                      <div className="operating-map-tags">
                        <span>{item.status}</span>
                        {item.estimatedMinutes ? <span>{item.estimatedMinutes} min</span> : null}
                        {item.ancestry?.actionLane?.title ? <span>{item.ancestry.actionLane.title}</span> : null}
                      </div>
                    </div>
                    <button type="button" onClick={() => openCommandItem(item)} disabled={props.isWorking}>Open</button>
                  </article>
                )) : (
                  <div className="operating-map-empty">No command queue has been generated yet.</div>
                )}
                <div className="operating-map-detail-card">
                  <span>{compactLabel(activeAction?.status, 'No active action')}</span>
                  <strong>{compactLabel(activeAction?.title, 'No action is open')}</strong>
                  <p>{compactLabel(activeAction?.instructions ?? activeAction?.draftContent, 'Open a queue item to review its action details.')}</p>
                </div>
              </div>
            ),
          )}

          {renderSection(
            'contacts',
            <User size={18} />,
            'Contacts & Network',
            `${targetQueue.length || prospects.length} visible campaign targets.`,
            (
              <div className="operating-map-mini-grid">
                <span>{targetQueue.length || prospects.length} contacts</span>
                <span>{compactLabel(activeAction?.target?.label, 'Recipient not selected')}</span>
              </div>
            ),
            (
              <div className="operating-map-list compact">
                {visibleTargets.length > 0 ? visibleTargets.slice(0, 20).map((target: any) => (
                  <article key={target.queueItemId ?? target.id} className="operating-map-row">
                    <div>
                      <strong>{target.name ?? target.primaryPersonName ?? target.companyName}</strong>
                      <p>{compactLabel([target.title, target.company].filter(Boolean).join(' @ '), target.reason ?? target.stage)}</p>
                      <div className="operating-map-tags">
                        {target.score ? <span>{target.score}% match</span> : null}
                        {target.status ? <span>{String(target.status).toLowerCase()}</span> : null}
                        {target.linkedinUrl ? <span>LinkedIn ready</span> : null}
                      </div>
                    </div>
                    <button type="button" onClick={() => openDetail('Contact', target.name ?? target.primaryPersonName ?? target.companyName, target.raw ?? target)}>
                      Inspect
                    </button>
                  </article>
                )) : (
                  <div className="operating-map-empty">
                    Recipient ranking has not produced visible contacts yet. Build the recipient queue from Command mode.
                  </div>
                )}
              </div>
            ),
          )}

          {renderSection(
            'system',
            <AlertCircle size={18} />,
            'System',
            'Session, connector, and backend reset controls.',
            (
              <div className="operating-map-mini-grid">
                <span>{props.emailReadiness?.ready ? 'Email ready' : 'Email not ready'}</span>
                <span>{props.workspace?.conductor.activeConversationId ? 'Conductor active' : 'No conversation'}</span>
              </div>
            ),
            (
              <div className="operating-map-system-actions">
                <div>
                  <strong>Extended logout and purge</strong>
                  <p>Deletes this user and associated backend data, clears local browser state, and reloads the app.</p>
                </div>
                <button type="button" className="danger-button" onClick={() => void props.onExtendedLogoutAndPurge()}>
                  Scrub data & sign out
                </button>
              </div>
            ),
          )}
        </div>
      </div>

      {detail ? (
        <aside className="operating-map-drawer" aria-label="Operating map detail">
          <div className="operating-map-drawer-panel">
            <button type="button" className="icon-button" onClick={() => setDetail(null)} aria-label="Close detail">
              x
            </button>
            <p className="label">{detail.eyebrow}</p>
            <h3>{detail.title}</h3>
            <pre>{JSON.stringify(detail.data ?? {}, null, 2)}</pre>
          </div>
        </aside>
      ) : null}
    </section>
  );
};

export const ActiveWorkspace: React.FC<ActiveWorkspaceProps> = (props) => {
  if (props.mode === 'map') {
    return (
      <OperatingMapWorkspace
        workspace={props.workspace}
        campaignWorkspace={props.campaignWorkspace}
        offerings={props.offerings}
        campaigns={props.campaigns}
        emailReadiness={props.emailReadiness}
        commandQueue={props.commandQueue}
        intelligenceArtifacts={props.intelligenceArtifacts}
        intelligenceJobs={props.intelligenceJobs}
        intelligenceChunks={props.intelligenceChunks}
        userAssets={props.userAssets}
        activationPayload={props.activationPayload}
        actionCanvasPayload={props.actionCanvasPayload}
        isWorking={props.isWorking}
        onSelectCommandQueueItem={props.onSelectCommandQueueItem}
        onChangeMode={props.onChangeMode}
        onExtendedLogoutAndPurge={props.onExtendedLogoutAndPurge}
        onCreateOffering={props.onCreateOffering}
        onUpdateOffering={props.onUpdateOffering}
        onCreateCampaign={props.onCreateCampaign}
        onUpdateCampaign={props.onUpdateCampaign}
      />
    );
  }

  const cycle = props.workspace?.activeCycle ?? null;
  const recommendation = props.workspace?.recommendation ?? null;
  const showTimeline = props.view.action !== 'idle';
  const hasCycleContext = Boolean(cycle || recommendation);
  const showActivationTour = props.showWorkspaceTour && Boolean(props.activationPayload);
  const showActionCanvas = Boolean(props.actionCanvasPayload);
  const showCommandQueue = props.view.action === 'idle' && Boolean(props.commandQueue) && !showActivationTour;

  return (
    <section className="active-workspace tour-region-canvas">
      {showCommandQueue ? (
        <TodayCommandQueue
          queue={props.commandQueue}
          isWorking={props.isWorking}
          onSelect={props.onSelectCommandQueueItem}
          onUpdate={props.onUpdateCommandQueueItem}
          onRefresh={props.onRefreshCommandQueue}
        />
      ) : null}

      {showActionCanvas && props.actionCanvasPayload ? (
        <ActionCanvasShell
          payload={props.actionCanvasPayload}
          isWorking={props.isWorking}
          onCaptureActionFeedback={props.onCaptureActionFeedback}
          onConfirmCanvasAction={props.onConfirmCanvasAction}
          onSaveActionDraft={props.onSaveActionDraft}
          onBuildRecipientQueue={props.onBuildRecipientQueue!}
          onSelectRecipient={props.onSelectRecipient!}
          onClearRecipient={props.onClearRecipient!}
          onRefineDraft={props.onRefineDraft!}
          onStartDiscoveryScan={props.onStartDiscoveryScan}
          onAcceptDiscoveryTarget={props.onAcceptDiscoveryTarget}
          onRejectDiscoveryTarget={props.onRejectDiscoveryTarget}
          campaignWorkspace={props.campaignWorkspace}
        />
      ) : null}

      {props.view.action === 'idle' && !showActivationTour && !showActionCanvas && !showCommandQueue ? (
        <EmptyWorkspace />
      ) : null}

      {!showActionCanvas && props.view.action === 'review_opportunity' ? (
        hasCycleContext ? (
          <CycleWorkspace
            cycle={cycle}
            recommendation={recommendation}
            campaignWorkspace={props.campaignWorkspace}
            isWorking={props.isWorking}
            onCommand={props.onCommand}
            onGenerateDraft={props.onGenerateDraft}
            onGenerateDraftForOpportunity={props.onGenerateDraftForOpportunity}
          />
        ) : (
          <CanvasEmptyState
            title="No opportunity selected"
            detail="Activate a signal or ask the Conductor to surface the next opportunity before reviewing."
          />
        )
      ) : null}

      {!showActionCanvas && (props.view.action === 'confirm_goal' || props.view.action === 'confirm_campaign') ? (
        props.campaignFeedback ? (
          <StrategicPlanWorkspace
            preview={props.campaignFeedback}
            isWorking={props.isWorking}
            mode="campaign_ready"
            onContinue={props.onContinueFromCampaignFeedback}
          />
        ) : props.pendingStrategicSessionId ? (
          <StrategicPlanWorkspace
            preview={props.strategicPreview}
            isWorking={props.isWorking}
            mode="planning"
            onPreview={props.onPreviewStrategicPlan}
            onFinalize={props.onFinalizeStrategicGoal}
          />
        ) : hasCycleContext ? (
          <PlanningWorkspace cycle={cycle} recommendation={recommendation} />
        ) : (
          <CanvasEmptyState
            title={props.view.action === 'confirm_goal' ? 'No goal proposal ready' : 'No campaign ready'}
            detail="Ask the Conductor to create a goal proposal before confirming."
          />
        )
      ) : null}

      {/* Additional action handlers would go here */}
    </section>
  );
};
