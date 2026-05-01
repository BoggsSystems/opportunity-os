import React, { useState } from 'react';
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
  view: WorkspaceViewState;
  draft: OutreachDraft | null;
  outreachExecutionState: OutreachExecutionState;
  pendingStrategicSessionId: string | null;
  strategicPreview: StrategicPlanResult | null;
  campaignFeedback: StrategicPlanResult | null;
  activationPayload: WorkspaceActivationPayload | null;
  actionCanvasPayload: any | null;
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

const WorkspaceActivationTour: React.FC<{
  payload: WorkspaceActivationPayload;
  isWorking: boolean;
  onCaptureActionFeedback: ActiveWorkspaceProps['onCaptureActionFeedback'];
}> = ({ payload, isWorking, onCaptureActionFeedback }) => {
  const [replyText, setReplyText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [latestInsight, setLatestInsight] = useState<any | null>(null);
  const actionItemId = payload.persisted?.actionItemId;
  const canCapture = Boolean(actionItemId && (replyText.trim() || imageUrl.trim()));

  const captureFeedback = async () => {
    if (!actionItemId || !canCapture) return;
    const result = await onCaptureActionFeedback({
      actionItemId,
      bodyText: replyText,
      attachmentUrls: imageUrl.trim() ? [imageUrl.trim()] : [],
      attachmentMimeTypes: imageUrl.trim() ? ['image/png'] : [],
    });
    setLatestInsight(result?.insight || null);
    setReplyText('');
    setImageUrl('');
  };

  return (
    <div className="workspace-activation-tour">
      <section className="activation-hero">
        <p className="eyebrow">Workspace tour</p>
        <h3>First Action Cycle: {payload.lane.title}</h3>
        <p>{payload.campaign.title}</p>
      </section>

      <section className="activation-context-grid">
        <div>
          <span>Campaign</span>
          <strong>{payload.campaign.title}</strong>
        </div>
        <div>
          <span>Target</span>
          <strong>{payload.campaign.targetSegment || 'Defined campaign audience'}</strong>
        </div>
        <div>
          <span>Goal</span>
          <strong>{payload.campaign.goalMetric || 'Qualified progress'}</strong>
        </div>
      </section>

      <section className="activation-tour-card">
        <h4>What happens first</h4>
        <ol>
          <li>Review why this lane is the right starting point.</li>
          <li>Identify the first contact or target for the action.</li>
          <li>Draft the LinkedIn DM or lane-specific action.</li>
          <li>Ask for your approval before anything is sent or logged.</li>
        </ol>
      </section>

      {payload.persisted?.actionCycleId ? (
        <section className="activation-tour-card">
          <h4>Persisted action cycle</h4>
          <p>
            This first cycle is saved to the workspace and ready to continue from action item{' '}
            <code>{payload.persisted.actionItemId || 'pending'}</code>.
          </p>
        </section>
      ) : null}

      <section className="activation-tour-card">
        <h4>Capture reply feedback</h4>
        <p className="activation-card-copy">
          Paste a prospect reply or attach a screenshot URL. The system will keep it tied to this action cycle and suggest the next move.
        </p>
        <textarea
          className="feedback-textarea"
          placeholder="Paste the reply, comment, or notes from the screenshot..."
          value={replyText}
          onChange={(event) => setReplyText(event.target.value)}
        />
        <input
          className="feedback-input"
          placeholder="Optional screenshot/image URL"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
        />
        <button className="feedback-capture-button" onClick={captureFeedback} disabled={isWorking || !canCapture}>
          Capture and synthesize feedback
        </button>
        {latestInsight ? (
          <div className="feedback-insight">
            <span>{latestInsight.sentiment}</span>
            <strong>{latestInsight.recommendedNextAction}</strong>
            <p>{latestInsight.summary}</p>
          </div>
        ) : null}
      </section>

      <section className="activation-tour-card">
        <h4>Workspace orientation</h4>
        <div className="tour-step-list">
          <div><strong>Canvas</strong><span>The active action cycle stays staged here.</span></div>
          <div><strong>Conductor</strong><span>Use the conversation to revise, approve, or ask why.</span></div>
          <div><strong>Action context</strong><span>The campaign, lane, target, and goal stay tied together.</span></div>
        </div>
      </section>
    </div>
  );
};

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
}> = ({ payload, isWorking, onCaptureActionFeedback, onConfirmCanvasAction, onSaveActionDraft }) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const actionItem = payload.actionItem;
  const Panel = actionPanelFor(payload.panelType);
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
    <div className="action-canvas-shell">
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

export const ActiveWorkspace: React.FC<ActiveWorkspaceProps> = (props) => {
  const cycle = props.workspace?.activeCycle ?? null;
  const recommendation = props.workspace?.recommendation ?? null;
  const showTimeline = props.view.action !== 'idle';
  const hasCycleContext = Boolean(cycle || recommendation);
  const showActivationTour = props.view.action === 'idle' && Boolean(props.activationPayload);
  const showActionCanvas = props.view.action === 'idle' && Boolean(props.actionCanvasPayload);
  const showCommandQueue = props.view.action === 'idle' && Boolean(props.commandQueue);

  return (
    <section className="active-workspace">
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
        />
      ) : null}

      {!showActionCanvas && showActivationTour && props.activationPayload ? (
        <WorkspaceActivationTour
          payload={props.activationPayload}
          isWorking={props.isWorking}
          onCaptureActionFeedback={props.onCaptureActionFeedback}
        />
      ) : null}

      {props.view.action === 'idle' && !showActivationTour && !showActionCanvas && !showCommandQueue ? (
        <EmptyWorkspace />
      ) : null}

      {props.view.action === 'review_opportunity' ? (
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

      {props.view.action === 'confirm_goal' || props.view.action === 'confirm_campaign' ? (
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
