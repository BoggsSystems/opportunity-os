import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Info, Send, FileText, User, Layout, ArrowRight, ChevronRight, MessageSquare, Target, Search, SlidersHorizontal } from 'lucide-react';
import type {
  WorkspaceState,
  CampaignWorkspace,
  CommandQueueItem,
  CommandQueueItemStatus,
  CommandQueueState,
  EmailReadiness,
  OutreachDraft,
  StrategicPlanResult
} from '../../types';

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
  onCommand: (body: Record<string, unknown>, success: string) => Promise<void>;
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
  onExtendedLogoutAndPurge: () => void;
  onUpdateCommandQueueItem: (item: CommandQueueItem, status: CommandQueueItemStatus) => Promise<void>;
  onRefreshCommandQueue: () => Promise<void>;
  onGenerateDraft: () => Promise<void>;
  onGenerateDraftForOpportunity: (opportunityId: string, kind?: 'initial' | 'follow_up') => Promise<void>;
  onStartDiscoveryScan: () => Promise<void>;
  onAcceptDiscoveryTarget: (targetId: string) => Promise<void>;
  onRejectDiscoveryTarget: (targetId: string) => Promise<void>;
  onPromoteDiscoveryTargets: (scanId: string) => Promise<void>;
  onConnectEmail: (providerName: 'gmail' | 'outlook', accessToken: string, emailAddress?: string) => Promise<void>;
  onStartOutlookOAuth: () => Promise<void>;
  onSyncEmail: () => Promise<void>;
  onBuildRecipientQueue: (input: { campaignId: string; actionLaneId?: string; limit?: number; refinement?: string }) => Promise<any>;
  onSelectRecipient: (input: { actionItemId: string; personId?: string; connectionRecordId?: string }) => Promise<void>;
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
}> = ({ payload, isWorking, onCaptureActionFeedback, onConfirmCanvasAction, onSaveActionDraft, onBuildRecipientQueue, onSelectRecipient }) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const actionItem = payload.actionItem;
  const shouldPrepareRecipientQueue = needsRecipientQueue(payload);
  const Panel = shouldPrepareRecipientQueue ? RecipientQueuePreparation : actionPanelFor(payload.panelType);
  const canCapture = Boolean(actionItem?.id && (feedbackText.trim() || screenshotUrl.trim()));

  const captureFeedback = async () => {
    if (!actionItem?.id || !canCapture) return;
    await onCaptureActionFeedback({
      actionItemId: actionItem.id,
      bodyText: feedbackText,
      attachmentUrls: screenshotUrl.trim() ? [screenshotUrl.trim()] : [],
      attachmentMimeTypes: screenshotUrl.trim() ? ['image/png'] : [],
    });
    setFeedbackText('');
    setScreenshotUrl('');
  };

  return (
    <div className="action-canvas-shell tour-region-action">
      <header className="action-canvas-header">
        <div>
          <p className="eyebrow">{payload.actionLane?.laneType?.replace(/_/g, ' ') || payload.panelType}</p>
          <h3>{actionItem?.title || 'Action item'}</h3>
          <p>{payload.campaign?.title || 'Campaign action'}</p>
        </div>
        <StatusBadge label={actionItem?.status || 'ready'} />
      </header>

      <section className="action-canvas-context">
        <div><span>Lane</span><strong>{payload.actionLane?.title || 'Action lane'}</strong></div>
        <div><span>Target</span><strong>{payload.context?.targetLabel || 'Campaign audience'}</strong></div>
        <div><span>Provider</span><strong>{payload.context?.externalProvider || 'Manual'}</strong></div>
      </section>

      <Panel
        payload={payload}
        isWorking={isWorking}
        onConfirmCanvasAction={onConfirmCanvasAction}
        onSaveActionDraft={onSaveActionDraft}
        onBuild={onBuildRecipientQueue}
        onSelect={onSelectRecipient}
      />

      <section className="action-canvas-card">
        <div className="action-canvas-card-header">
          <div>
            <h4>Feedback and replies</h4>
            <p>Capture replies, comments, screenshots, or notes so the engine can learn and create the next action.</p>
          </div>
          {payload.latestInsight ? <StatusBadge label={payload.latestInsight.sentiment} /> : null}
        </div>
        {payload.latestInsight ? (
          <div className="action-insight">
            <strong>{payload.latestInsight.recommendedNextAction}</strong>
            <p>{payload.latestInsight.summary}</p>
          </div>
        ) : null}
        <textarea
          className="feedback-textarea"
          placeholder="Paste a reply, comment, or note from the conversation..."
          value={feedbackText}
          onChange={(event) => setFeedbackText(event.target.value)}
        />
        <input
          className="feedback-input"
          placeholder="Optional screenshot/image URL"
          value={screenshotUrl}
          onChange={(event) => setScreenshotUrl(event.target.value)}
        />
        <button className="feedback-capture-button" onClick={captureFeedback} disabled={isWorking || !canCapture}>
          Capture and synthesize
        </button>
      </section>
    </div>
  );
};

const EmailActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction, onSaveActionDraft }) => {
  const [draft, setDraft] = useState(payload.actionItem?.draftContent || payload.actionItem?.instructions || '');

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

const RecipientQueuePreparation: React.FC<ActionPanelProps & { onBuild: ActiveWorkspaceProps['onBuildRecipientQueue'], onSelect: ActiveWorkspaceProps['onSelectRecipient'] }> = ({ payload, isWorking, onBuild, onSelect }) => {
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
      const buildInput: { campaignId: string; actionLaneId?: string; limit?: number; refinement?: string } = {
        campaignId: payload.campaign.id, 
        actionLaneId: payload.actionLane?.id,
        limit: 12,
      };
      if (normalizedRefinement) buildInput.refinement = normalizedRefinement;
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
    if (!attempted && queue.length === 0 && !loading) {
      void fetchQueue();
    }
  }, [attempted, fetchQueue, queue.length, loading]);

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

  const submitRefinement = React.useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    const nextRefinement = refinement.trim();
    void fetchQueue(nextRefinement);
  }, [fetchQueue, refinement]);

  const applyPreset = React.useCallback((preset: string) => {
    setRefinement(preset);
    void fetchQueue(preset);
  }, [fetchQueue]);

  return (
    <section className="recipient-prep-panel">
      <div className="action-canvas-card-header">
        <div>
          <h4>Build the target queue</h4>
          <p>
            Search your relationship graph or ask the Conductor to refine who should be considered for <strong>{campaignTitle}</strong>.
          </p>
        </div>
        <StatusBadge label={loading ? 'Ranking...' : `${displayedQueue.length}/${queue.length} targets`} />
      </div>

      <div className="target-workbench">
        <label className="target-search-box">
          <Search size={18} />
          <input
            value={targetSearch}
            onChange={(event) => setTargetSearch(event.target.value)}
            placeholder="Search ranked targets by name, title, company, or reason..."
          />
        </label>
        <form className="target-refinement-box" onSubmit={submitRefinement}>
          <div className="target-refinement-heading">
            <SlidersHorizontal size={18} />
            <div>
              <strong>AI target criteria</strong>
              <span>{activeRefinement ? `Current: ${activeRefinement}` : 'Use natural language to reshape the ranking.'}</span>
            </div>
          </div>
          <div className="target-refinement-input-row">
            <input
              value={refinement}
              onChange={(event) => setRefinement(event.target.value)}
              placeholder="Example: find CTOs in banks who would care about an AI-native SDLC audit..."
            />
            <button type="submit" disabled={loading || isWorking || !refinement.trim()}>
              Refine ranking
            </button>
          </div>
          <div className="target-preset-row">
            {refinementPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                disabled={loading || isWorking}
              >
                {preset}
              </button>
            ))}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="recipient-scan-list loading">
          <div className="recipient-scan-row active">
            <div className="report-icon"><RefreshCw size={20} className="spin" /></div>
            <div>
              <strong>Ranking high-signal targets</strong>
              <p>Evaluating your LinkedIn archive and contact list against campaign parameters...</p>
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
                      personId: item.source === 'person' ? item.id : undefined,
                      connectionRecordId: item.source === 'connection' ? item.id : undefined
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

const LinkedInDmActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction, onSaveActionDraft }) => {
  const [draft, setDraft] = useState(payload.actionItem?.draftContent || payload.actionItem?.instructions || '');

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

const ContentActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction, onSaveActionDraft }) => {
  const [draft, setDraft] = useState(payload.actionItem?.draftContent || payload.actionItem?.instructions || '');

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

const GenericActionPanel: React.FC<ActionPanelProps> = ({ payload, isWorking, onConfirmCanvasAction }) => (
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

interface ActionPanelProps {
  payload: any;
  isWorking: boolean;
  onConfirmCanvasAction: ActiveWorkspaceProps['onConfirmCanvasAction'];
  onSaveActionDraft: ActiveWorkspaceProps['onSaveActionDraft'];
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
  onCommand: (body: Record<string, unknown>, success: string) => Promise<void>;
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
}> = (props) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    commercial: true,
    knowledge: true,
    contacts: false,
    execution: true,
    system: false,
  });
  const [detail, setDetail] = useState<{ title: string; eyebrow: string; data: any } | null>(null);
  const activeCampaign = props.actionCanvasPayload?.campaign
    ?? props.campaignWorkspace?.campaign
    ?? props.activationPayload?.campaign
    ?? props.commandQueue?.items.find((item) => item.ancestry?.campaign)?.ancestry?.campaign
    ?? null;
  const activeOffering = props.commandQueue?.items.find((item) => item.ancestry?.offering)?.ancestry?.offering
    ?? props.campaignWorkspace?.campaign?.offering
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
  const currentCampaignTitle = compactLabel(activeCampaign?.title ?? activeCampaign?.name, 'No campaign selected');
  const offeringTitle = compactLabel(activeOffering?.title ?? activeOffering?.name, 'Current offering');
  const openActions = queueItems.filter((item) => !['completed', 'skipped', 'deferred'].includes(item.status)).length;
  const prospects = props.campaignWorkspace?.prospects ?? [];
  const connectorArtifacts = props.intelligenceArtifacts.filter((artifact) => artifact?.sourceType !== 'knowledge_asset');
  const knowledgeItems = [
    ...props.userAssets.map((asset) => ({
      id: asset.id,
      title: asset.displayName ?? asset.fileName ?? asset.title ?? 'Uploaded asset',
      subtitle: asset.category ?? asset.mimeType ?? 'Manual upload',
      status: asset.status ?? 'processed',
      kind: 'Asset',
      raw: asset,
    })),
    ...props.intelligenceArtifacts.map((artifact) => ({
      id: artifact.id,
      title: artifact.title ?? artifact.sourcePath ?? artifact.externalKey ?? 'Ingestion artifact',
      subtitle: artifact.sourceName ?? artifact.sourceType ?? artifact.sourcePath ?? 'Intelligence artifact',
      status: artifact.status ?? 'staged',
      kind: artifact.sourceType === 'linkedin_archive' ? 'LinkedIn' : 'Artifact',
      raw: artifact,
    })),
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
        <article>
          <span>Offering</span>
          <strong>{offeringTitle}</strong>
        </article>
        <article>
          <span>Campaign</span>
          <strong>{currentCampaignTitle}</strong>
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
          <strong>{prospects.length}</strong>
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
                <div className="operating-map-tree">
                  <button type="button" className="map-tree-node" onClick={() => openDetail('Offering', offeringTitle, activeOffering)}>
                    <span>Offering</span>
                    <strong>{offeringTitle}</strong>
                  </button>
                  <ChevronRight size={18} />
                  <button type="button" className="map-tree-node" onClick={() => openDetail('Campaign', currentCampaignTitle, activeCampaign)}>
                    <span>Campaign</span>
                    <strong>{currentCampaignTitle}</strong>
                  </button>
                  <ChevronRight size={18} />
                  <button type="button" className="map-tree-node" onClick={() => openDetail('Channel', compactLabel(activeLane?.title ?? activeLane?.name, 'No channel selected'), activeLane)}>
                    <span>Current Channel</span>
                    <strong>{compactLabel(activeLane?.title ?? activeLane?.name, 'No channel selected')}</strong>
                  </button>
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
                {knowledgeItems.length > 0 ? knowledgeItems.slice(0, 12).map((item) => (
                  <article key={`${item.kind}-${item.id}`} className="operating-map-row">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.subtitle}</p>
                      <div className="operating-map-tags">
                        <span>{item.kind}</span>
                        <span>{item.status}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => openDetail(item.kind, item.title, item.raw)}>Inspect</button>
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
            `${prospects.length} visible campaign prospects.`,
            (
              <div className="operating-map-mini-grid">
                <span>{prospects.length} contacts</span>
                <span>{compactLabel(activeAction?.target?.label, 'Recipient not selected')}</span>
              </div>
            ),
            (
              <div className="operating-map-list compact">
                {prospects.length > 0 ? prospects.slice(0, 20).map((prospect) => (
                  <article key={prospect.id} className="operating-map-row">
                    <div>
                      <strong>{prospect.primaryPersonName ?? prospect.companyName}</strong>
                      <p>{prospect.primaryPersonTitle ?? prospect.summary ?? prospect.stage}</p>
                    </div>
                    <button type="button" onClick={() => openDetail('Contact', prospect.primaryPersonName ?? prospect.companyName, prospect)}>
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
            'Session, connector, and local reset controls.',
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
                  <p>Clears local browser session, onboarding drafts, cached workspace state, and reloads the app.</p>
                </div>
                <button type="button" className="danger-button" onClick={props.onExtendedLogoutAndPurge}>
                  Logout & purge local state
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
      <div className="canvas-action-header">
        <div>
          <p className="label">Canvas action</p>
          <h2>{actionLabel(props.view.action)}</h2>
        </div>
        <StatusBadge label={props.view.phase} />
      </div>

      <CanvasActionSummary view={props.view} />

      {showTimeline ? (
        <CycleTimeline phase={props.view.phase} />
      ) : null}

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
          onBuildRecipientQueue={props.onBuildRecipientQueue}
          onSelectRecipient={props.onSelectRecipient}
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
