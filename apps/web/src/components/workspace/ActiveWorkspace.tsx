import React from 'react';
import type {
  WorkspaceState,
  CampaignWorkspace,
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

interface ActiveWorkspaceProps {
  workspace: WorkspaceState | null;
  campaignWorkspace: CampaignWorkspace | null;
  emailReadiness: EmailReadiness | null;
  view: WorkspaceViewState;
  draft: OutreachDraft | null;
  outreachExecutionState: OutreachExecutionState;
  pendingStrategicSessionId: string | null;
  strategicPreview: StrategicPlanResult | null;
  campaignFeedback: StrategicPlanResult | null;
  isWorking: boolean;
  onCommand: (body: Record<string, unknown>, success: string) => Promise<void>;
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

      {props.view.action === 'idle' ? (
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
