import type { WorkspaceState } from '../types';

const emptyVelocity = {
  activeGoalCount: 0,
  activeCampaignCount: 0,
  activeOpportunityCount: 0,
  openTaskCount: 0,
  overdueTaskCount: 0,
  outreachSentThisWeek: 0,
  opportunitiesAdvancedThisWeek: 0,
  pendingSignalCount: 0,
  activeCycleCount: 0,
};

export function buildWorkspaceView(
  workspace: WorkspaceState | null,
  _draft: any,
  _pendingStrategicSessionId: string | null,
  _campaignFeedback: any
) {
  // This would contain the actual workspace view building logic
  // For now, return a placeholder
  return {
    action: 'idle',
    title: 'Workspace View',
    explanation: 'Current workspace state',
    phase: 'ready',
    cycleId: workspace?.activeCycle?.id ?? null,
    refs: workspace?.canvas?.refs ?? {},
    allowedActions: new Set(['idle']),
    primaryAction: null,
  };
}

export function actionFromMode(mode: string): string {
  const actionMap: Record<string, string> = {
    idle: 'idle',
    discovery: 'discovery_scan',
    outreach: 'draft_email',
    planning: 'confirm_goal',
  };
  return actionMap[mode] || 'idle';
}

export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    idle: 'Idle',
    review_opportunity: 'Review Opportunity',
    confirm_goal: 'Confirm Goal',
    confirm_campaign: 'Confirm Campaign',
    discovery_scan: 'Discovery Scan',
    outreach: 'Outreach',
    draft_email: 'Draft Email',
  };
  return labels[action] || action;
}

export function buildCampaignFeedbackMessage(result: any): string {
  return `Campaign "${result.campaign.title}" has been created with goal "${result.goal.title}".`;
}

export function stepClass(phase: string, step: string, _index: number): string {
  const steps = ['surfaced', 'pursued', 'executed', 'confirmed'];
  const currentIndex = steps.indexOf(phase);
  const stepIndex = steps.indexOf(step);
  
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'current';
  return 'pending';
}

export { emptyVelocity };
