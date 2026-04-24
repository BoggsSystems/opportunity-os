import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  CircleGauge,
  ClipboardCheck,
  Loader2,
  Mail,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  UserRound,
  Database,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { ApiClient, ApiError } from './lib/api';
import { useUIStore } from './store';
import type {
  AuthResponse,
  CanvasAction,
  CanvasState,
  CampaignWorkspace,
  CampaignProspectSummary,
  CommercialState,
  ConversationMessage,
  DiscoveryTargetSummary,
  EmailReadiness,
  EntitlementSummary,
  OutreachDraft,
  PlanSummary,
  StrategicPlanResult,
  SubscriptionSummary,
  UsageSummary,
  WorkspaceMode,
  WorkspaceSignalSummary,
  WorkspaceState,
} from './types';

const STORAGE_KEY = 'opportunity-os-session';
const TEST_PASSWORD = 'Password123!';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthResponse['user'];
}

interface Notice {
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface UpgradePromptState {
  featureKey: string;
  reason?: string | undefined;
  hint?: string | undefined;
}

type SettingsSection = 'profile' | 'connectors' | 'usage' | 'notifications';

type OutreachExecutionState = 'idle' | 'blocked' | 'sent';

interface WorkspaceViewState {
  action: CanvasAction;
  title: string;
  explanation: string;
  phase: string;
  cycleId: string | null;
  refs: CanvasState['refs'];
  allowedActions: Set<string>;
  primaryAction: string | null;
}

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

export function App() {
  const [session, setSession] = useState<StoredSession | null>(() => readSession());
  const api = useMemo(() => new ApiClient(session?.accessToken ?? null), [session?.accessToken]);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [campaignWorkspace, setCampaignWorkspace] = useState<CampaignWorkspace | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [commercialState, setCommercialState] = useState<CommercialState | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [emailReadiness, setEmailReadiness] = useState<EmailReadiness | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [outreachExecutionState, setOutreachExecutionState] = useState<OutreachExecutionState>('idle');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingStrategicSessionId, setPendingStrategicSessionId] = useState<string | null>(null);
  const [strategicPreview, setStrategicPreview] = useState<StrategicPlanResult | null>(null);
  const [campaignFeedback, setCampaignFeedback] = useState<StrategicPlanResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');
  const [isBooting, setIsBooting] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  
  // UI store for conductor expanded state
  const { conductorExpanded, toggleConductor } = useUIStore();

  const loadWorkspace = useCallback(async () => {
    if (!session) return;
    setIsBooting(true);
    try {
      const [workspaceState, subscriptionState, usageState] = await Promise.all([
        api.getWorkspace(),
        api.getSubscription(),
        api.getUsage(),
      ]);
      const emailState = await api.getEmailReadiness().catch(() => null);
      const commercial = await api.getCommercialState().catch(() => null);
      const availablePlans = await api.listPlans().catch(() => []);
      const campaignId = workspaceState.activeCycle?.refs.campaignId;
      const campaignState = campaignId
        ? await api.getCampaignWorkspace(campaignId).catch(() => null)
        : await api.getCurrentCampaignWorkspace().catch(() => null);
      setWorkspace(workspaceState);
      setCampaignWorkspace(campaignState);
      setActiveConversationId((current) => current ?? workspaceState.conductor.activeConversationId);
      setSubscription(subscriptionState);
      setUsage(usageState);
      setCommercialState(commercial);
      setPlans(availablePlans);
      setEmailReadiness(emailState);
      setMessages((current) => {
        if (current.length > 0) return current;
        const summary = workspaceState.conductor.currentReasoningSummary;
        return [
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: summary ?? 'I am ready. Tell me what opportunity cycle you want to create or execute next.',
          },
        ];
      });
    } catch (error) {
      setNotice({
        title: 'Workspace unavailable',
        detail: error instanceof Error ? error.message : 'The backend did not return workspace state.',
        tone: 'error',
      });
    } finally {
      setIsBooting(false);
    }
  }, [api, session]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const workspaceView = useMemo(
    () => buildWorkspaceView(workspace, draft, pendingStrategicSessionId, campaignFeedback),
    [workspace, draft, pendingStrategicSessionId, campaignFeedback],
  );

  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    params.set('canvas', workspaceView.action);
    params.delete('mode');
    if (workspaceView.cycleId) {
      params.set('cycle', workspaceView.cycleId);
    } else {
      params.delete('cycle');
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }, [session, workspaceView.action, workspaceView.cycleId]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen]);

  function commitSession(auth: AuthResponse) {
    const stored = {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      user: auth.user,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setSession(stored);
    setSubscription(auth.subscription ?? null);
  }

  async function handleAuth(mode: 'login' | 'signup', email: string, password: string, fullName?: string) {
    setIsWorking(true);
    setNotice(null);
    try {
      const auth =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.signup({
              email,
              password,
              fullName: fullName || 'Test Operator',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
      commitSession(auth);
    } catch (error) {
      setNotice({
        title: mode === 'login' ? 'Login failed' : 'Signup failed',
        detail: error instanceof Error ? error.message : 'Authentication failed.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setWorkspace(null);
    setCampaignWorkspace(null);
    setMessages([]);
    setDraft(null);
    setOutreachExecutionState('idle');
    setActiveConversationId(null);
    setPendingStrategicSessionId(null);
    setStrategicPreview(null);
    setCampaignFeedback(null);
    setSubscription(null);
    setUsage(null);
    setCommercialState(null);
    setPlans([]);
    setEmailReadiness(null);
    setUpgradePrompt(null);
  }

  async function runCommand(body: Record<string, unknown>, success: string) {
    setIsWorking(true);
    setNotice(null);
    try {
      await api.executeWorkspaceCommand(body);
      setNotice({ title: success, detail: 'The workspace has been refreshed with the latest cycle state.', tone: 'success' });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Command failed',
        detail: error instanceof Error ? error.message : 'The command could not be completed.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMessage: ConversationMessage = { id: crypto.randomUUID(), role: 'user', text };
    setMessages((current) => [...current, userMessage]);
    setIsWorking(true);
    setNotice(null);
    try {
      const conversationInput: { sessionId?: string; message: string; context?: Record<string, unknown> } = {
        message: text,
      };
      const sessionId = activeConversationId ?? workspace?.conductor.activeConversationId;
      if (sessionId) {
        conversationInput.sessionId = sessionId;
      }
      if (workspace) {
        conversationInput.context = {
          canvasAction: workspace.canvas?.action ?? actionFromMode(workspace.activeWorkspace.mode),
          activeCycle: workspace.activeCycle,
        };
      }

      const result = await api.converse(conversationInput);
      setActiveConversationId(result.sessionId);

      if (result.blocked) {
        setUpgradePrompt({
          featureKey: result.upgradeReason ?? result.suggestedAction ?? 'ai_requests',
          reason: result.upgradeReason,
          hint: result.upgradeHint,
        });
        setNotice({
          title: 'Capability blocked',
          detail: result.upgradeHint ?? result.upgradeReason ?? 'This action is not available on the current plan.',
          tone: 'warning',
        });
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: result.reply,
        },
      ]);
      if (result.suggestedAction === 'PROPOSE_GOAL') {
        setPendingStrategicSessionId(result.sessionId);
        setStrategicPreview(result.onboardingPlan ?? null);
        setCampaignFeedback(null);
        setNotice({
          title: 'Goal proposal ready',
          detail: 'Review the proposed goal and campaign in the Canvas.',
          tone: 'info',
        });
      } else if (result.suggestedAction === 'PROPOSE_CAMPAIGN' && result.onboardingPlan) {
        setPendingStrategicSessionId(null);
        setStrategicPreview(null);
        setCampaignFeedback(result.onboardingPlan);
        setNotice({
          title: 'Campaign proposal ready',
          detail: 'Review the proposed campaign update in the Canvas.',
          tone: 'info',
        });
      }
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Assistant failed',
        detail: error instanceof Error ? error.message : 'The assistant could not complete the turn.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function previewStrategicPlan() {
    const sessionId = pendingStrategicSessionId ?? activeConversationId;
    if (!sessionId) {
      setNotice({
        title: 'No conversation selected',
        detail: 'Ask the Conductor to shape a goal before previewing the plan.',
        tone: 'warning',
      });
      return;
    }

    setIsWorking(true);
    setNotice(null);
    try {
      const preview = await api.previewStrategicPlan(sessionId);
      setStrategicPreview(preview);
      setNotice({
        title: 'Strategic plan previewed',
        detail: 'The goal, campaign, and first cycle are ready for confirmation.',
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        title: 'Preview failed',
        detail: error instanceof Error ? error.message : 'The backend could not preview the plan.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function finalizeStrategicGoal() {
    const sessionId = pendingStrategicSessionId ?? activeConversationId;
    if (!sessionId) {
      setNotice({
        title: 'No conversation selected',
        detail: 'Ask the Conductor to shape a goal before finalizing.',
        tone: 'warning',
      });
      return;
    }

    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.finalizeStrategicGoal(sessionId);
      setStrategicPreview(result);
      setPendingStrategicSessionId(null);
      setCampaignFeedback(result);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: buildCampaignFeedbackMessage(result),
        },
      ]);
      setNotice({
        title: 'Goal and campaign created',
        detail: `${result.goal.title} is now active with campaign ${result.campaign.title}.`,
        tone: 'success',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Finalization failed',
        detail: error instanceof Error ? error.message : 'The backend could not finalize the goal.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function continueFromCampaignFeedback() {
    console.log('[DEBUG] continueFromCampaignFeedback called');
    const feedback = campaignFeedback;
    console.log('[DEBUG] feedback:', feedback);
    setCampaignFeedback(null);
    
    setNotice({
      title: 'Campaign brief reviewed',
      detail: 'The Canvas can move into the first execution step now.',
      tone: 'success',
    });

    if (feedback?.campaign?.id) {
      console.log(`[DEBUG] Attempting to set workspace mode to discovery_scan for campaign ${feedback.campaign.id}`);
      try {
        await runCommand(
          { 
            type: 'set_workspace_mode', 
            input: { mode: 'discovery_scan' },
            campaignId: feedback.campaign.id
          }, 
          'Moving to lead discovery'
        );
        console.log('[DEBUG] runCommand successful');
      } catch (err) {
        console.error('[DEBUG] Failed to move to discovery mode', err);
      }
    } else {
      console.warn('[DEBUG] No feedback campaign ID found');
    }
  }

  async function generateDraft() {
    setCampaignFeedback(null);
    const opportunityId =
      workspace?.activeCycle?.refs.opportunityId ??
      (typeof workspace?.recommendation?.opportunityId === 'string' ? workspace.recommendation.opportunityId : undefined);

    if (!opportunityId) {
      setNotice({
        title: 'No opportunity selected',
        detail: 'Activate an opportunity signal before generating outreach.',
        tone: 'warning',
      });
      return;
    }

    setIsWorking(true);
    setNotice(null);
    try {
      const generated = await api.generateDraft(opportunityId);
      setDraft({ ...generated, opportunityId: generated.opportunityId ?? opportunityId });
      setOutreachExecutionState('idle');
      setNotice({ title: 'Draft generated', detail: 'The outreach draft is ready in the Canvas.', tone: 'success' });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Draft failed',
        detail: error instanceof Error ? error.message : 'The backend could not create a draft.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function generateDraftForOpportunity(opportunityId: string, kind: 'initial' | 'follow_up' = 'initial') {
    setCampaignFeedback(null);
    setIsWorking(true);
    setNotice(null);
    try {
      const generated = kind === 'follow_up' ? await api.generateFollowUpDraft(opportunityId) : await api.generateDraft(opportunityId);
      setDraft({ ...generated, opportunityId: generated.opportunityId ?? opportunityId });
      setOutreachExecutionState('idle');
      setNotice({
        title: kind === 'follow_up' ? 'Follow-up draft generated' : 'Draft generated',
        detail: 'The outreach draft is ready in the Canvas.',
        tone: 'success',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Draft failed',
        detail: error instanceof Error ? error.message : 'The backend could not create a draft.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function startDiscoveryScan() {
    setCampaignFeedback(null);
    const campaign = campaignWorkspace?.campaign;
    const goalTitle = campaignWorkspace?.discovery?.goal?.title;
    const targetSegment = campaign?.targetSegment;

    // Combine goal and target segment for maximum specificity (e.g. "Book Sales - CTOs")
    const query = goalTitle && targetSegment && !targetSegment.toLowerCase().includes(goalTitle.toLowerCase())
      ? `${goalTitle} - ${targetSegment}`
      : targetSegment || goalTitle || campaign?.strategicAngle || 'relevant prospects';

    setIsWorking(true);
    setNotice(null);
    try {
      const scanInput: {
        query: string;
        scanType: string;
        campaignId?: string;
        offeringId?: string;
        goalId?: string;
        targetSegment?: string;
        maxTargets: number;
      } = {
        query,
        scanType: query.toLowerCase().includes('professor') ? 'university_professors' : 'mixed',
        maxTargets: 5,
      };
      if (campaign?.id) scanInput.campaignId = campaign.id;
      const offeringId = campaign?.offeringId ?? workspace?.canvas?.refs.offeringId;
      if (offeringId) scanInput.offeringId = offeringId;
      if (campaign?.goalId) scanInput.goalId = campaign.goalId;
      if (campaign?.targetSegment) scanInput.targetSegment = campaign.targetSegment;

      const result = await api.createDiscoveryScan(scanInput);
      setNotice({
        title: 'Discovery scan complete',
        detail: `${result.targets.length} targets are ready for review.`,
        tone: 'success',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Discovery failed',
        detail: error instanceof Error ? error.message : 'The backend could not run discovery.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function acceptDiscoveryTarget(targetId: string) {
    setIsWorking(true);
    setNotice(null);
    try {
      await api.acceptDiscoveryTarget(targetId);
      setNotice({ title: 'Target accepted', detail: 'This target is ready for campaign promotion.', tone: 'success' });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Accept failed',
        detail: error instanceof Error ? error.message : 'The target could not be accepted.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function rejectDiscoveryTarget(targetId: string) {
    setIsWorking(true);
    setNotice(null);
    try {
      await api.rejectDiscoveryTarget(targetId, 'Rejected in Canvas review');
      setNotice({ title: 'Target rejected', detail: 'The discovery list has been updated.', tone: 'success' });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Reject failed',
        detail: error instanceof Error ? error.message : 'The target could not be rejected.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function promoteDiscoveryTargets(scanId: string) {
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.promoteDiscoveryTargets(scanId);
      setNotice({
        title: 'Targets promoted',
        detail: `${result.promoted} accepted targets were added to the campaign workflow.`,
        tone: 'success',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Promotion failed',
        detail: error instanceof Error ? error.message : 'Accepted targets could not be promoted.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function connectEmail(providerName: 'gmail' | 'outlook', accessToken: string, emailAddress?: string) {
    setIsWorking(true);
    setNotice(null);
    try {
      const readiness = await api.setupEmailConnector({
        providerName,
        connectorName: providerName === 'gmail' ? 'Gmail' : 'Outlook',
        accessToken,
        ...(emailAddress ? { emailAddress } : {}),
      });
      setEmailReadiness(readiness);
      setNotice({
        title: readiness.ready ? 'Email connected' : 'Email connector pending',
        detail: readiness.ready ? 'Real outreach can now be sent through this provider.' : readiness.upgradeHint ?? 'Connector setup needs a valid access token.',
        tone: readiness.ready ? 'success' : 'warning',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Connector setup failed',
        detail: error instanceof Error ? error.message : 'The email connector could not be configured.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function startOutlookOAuth() {
    setIsWorking(true);
    setNotice(null);
    try {
      const start = await api.startEmailOAuth('outlook', window.location.origin);
      const callbackOrigin = new URL(api.baseUrl).origin;
      const popup = window.open(start.authUrl, 'opportunity-os-outlook-oauth', 'width=560,height=760');
      if (!popup) {
        throw new Error('The OAuth popup was blocked by the browser.');
      }

      const result = await new Promise<{ success: boolean; emailAddress?: string | null; error?: string | null }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error('Timed out waiting for Microsoft login to complete.'));
        }, 120000);

        function cleanup() {
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
        }

        function onMessage(event: MessageEvent) {
          if (event.origin !== callbackOrigin) return;
          const data = event.data as { type?: string; provider?: string; success?: boolean; emailAddress?: string | null; error?: string | null };
          if (data?.type !== 'opportunity-os-oauth' || data.provider !== 'outlook') return;
          cleanup();
          const resolved: { success: boolean; emailAddress?: string | null; error?: string | null } = {
            success: data.success === true,
          };
          if (data.emailAddress !== undefined) resolved.emailAddress = data.emailAddress;
          if (data.error !== undefined) resolved.error = data.error;
          resolve(resolved);
        }

        window.addEventListener('message', onMessage);
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Microsoft login did not complete successfully.');
      }

      const readiness = await api.getEmailReadiness();
      setEmailReadiness(readiness);
      setNotice({
        title: 'Outlook connected',
        detail: result.emailAddress
          ? `Real outreach can now send through ${result.emailAddress}.`
          : 'Real outreach can now send through Outlook.',
        tone: 'success',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Outlook connect failed',
        detail: error instanceof Error ? error.message : 'The Microsoft login flow could not be completed.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function syncEmail() {
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.syncEmail();
      setNotice({
        title: 'Email synced',
        detail: `${result.synced} messages checked, ${result.linkedReplies} replies linked to opportunities.`,
        tone: 'success',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Email sync failed',
        detail: error instanceof Error ? error.message : 'The connected inbox could not be synced.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function startCheckout(planCode: string) {
    setIsWorking(true);
    setNotice(null);
    try {
      const checkout = await api.createCheckout(planCode);
      setNotice({
        title: checkout.mode === 'local_pending' ? 'Checkout session prepared' : 'Opening checkout',
        detail: checkout.mode === 'local_pending'
          ? `${checkout.plan.name} is ready for billing provider wiring.`
          : `Continue to ${checkout.provider} checkout for ${checkout.plan.name}.`,
        tone: 'info',
      });
      if (checkout.mode !== 'local_pending') {
        window.location.assign(checkout.checkoutUrl);
      }
    } catch (error) {
      setNotice({
        title: 'Checkout failed',
        detail: error instanceof Error ? error.message : 'The checkout session could not be created.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function sendDraft() {
    if (!draft) return;
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.sendDraft(draft);
      if ('blocked' in result && result.blocked) {
        setOutreachExecutionState('blocked');
        setUpgradePrompt({
          featureKey: result.featureKey ?? 'email_send',
          reason: result.upgradeReason,
          hint: result.upgradeHint,
        });
        setNotice({
          title: 'Send blocked',
          detail: result.upgradeHint ?? result.upgradeReason ?? 'Email send is not available on the current plan.',
          tone: 'warning',
        });
        return;
      }
      setOutreachExecutionState('sent');
      setNotice({ title: 'Email recorded', detail: 'The outreach activity was linked back to the opportunity.', tone: 'success' });
      await loadWorkspace();
    } catch (error) {
      const blocked = error instanceof ApiError && error.status === 402;
      if (blocked) {
        setOutreachExecutionState('blocked');
        const payload = error instanceof ApiError && error.payload && typeof error.payload === 'object' ? error.payload as any : null;
        setUpgradePrompt({
          featureKey: payload?.featureKey ?? 'email_send',
          reason: payload?.upgradeReason,
          hint: payload?.upgradeHint,
        });
      }
      setNotice({
        title: blocked ? 'Send blocked' : 'Send failed',
        detail: error instanceof Error ? error.message : 'The email could not be sent.',
        tone: blocked ? 'warning' : 'error',
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function completeActiveCycle() {
    const cycleId = workspace?.activeCycle?.id;
    if (!cycleId) {
      setNotice({
        title: 'No active cycle',
        detail: 'There is no active cycle to complete yet.',
        tone: 'warning',
      });
      return;
    }

    setDraft(null);
    setOutreachExecutionState('idle');
    await runCommand({ type: 'complete_cycle', cycleId }, 'Cycle completed');
  }

  if (!session) {
    return (
      <AuthScreen
        apiBaseUrl={api.baseUrl}
        isWorking={isWorking}
        notice={notice}
        onAuth={handleAuth}
      />
    );
  }

  return (
    <main className={`app-shell ${conductorExpanded ? 'conductor-expanded' : 'conductor-collapsed'}`}>
      <ConductorPane
        userEmail={session.user.email}
        messages={messages}
        suggestedPrompts={workspace?.conductor.suggestedPrompts ?? []}
        currentReasoningSummary={workspace?.conductor.currentReasoningSummary ?? null}
        isWorking={isWorking}
        onSend={sendMessage}
        onLogout={logout}
        expanded={conductorExpanded}
        onToggleExpanded={toggleConductor}
      />

      <section className="workspace-pane">
        <WorkspaceTopBar
          workspace={workspace}
          subscription={subscription}
          usage={usage}
          isLoading={isBooting || isWorking}
          onRefresh={() => void loadWorkspace()}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}
        {upgradePrompt ? (
          <UpgradePrompt
            prompt={upgradePrompt}
            plans={plans}
            commercialState={commercialState}
            isWorking={isWorking}
            onCheckout={startCheckout}
            onDismiss={() => setUpgradePrompt(null)}
          />
        ) : null}

        <div className="workspace-grid">
          <ActiveWorkspace
            workspace={workspace}
            campaignWorkspace={campaignWorkspace}
            emailReadiness={emailReadiness}
            view={workspaceView}
            draft={draft}
            outreachExecutionState={outreachExecutionState}
            pendingStrategicSessionId={pendingStrategicSessionId}
            strategicPreview={strategicPreview}
            campaignFeedback={campaignFeedback}
            isWorking={isWorking}
            onCommand={runCommand}
            onGenerateDraft={generateDraft}
            onGenerateDraftForOpportunity={generateDraftForOpportunity}
            onStartDiscoveryScan={startDiscoveryScan}
            onAcceptDiscoveryTarget={acceptDiscoveryTarget}
            onRejectDiscoveryTarget={rejectDiscoveryTarget}
            onPromoteDiscoveryTargets={promoteDiscoveryTargets}
            onConnectEmail={connectEmail}
            onStartOutlookOAuth={startOutlookOAuth}
            onSyncEmail={syncEmail}
            onDraftChange={setDraft}
            onSendDraft={sendDraft}
            onCompleteCycle={completeActiveCycle}
            onPreviewStrategicPlan={previewStrategicPlan}
            onFinalizeStrategicGoal={finalizeStrategicGoal}
            onContinueFromCampaignFeedback={continueFromCampaignFeedback}
          />
          <SignalsPanel
            signals={workspace?.signals ?? []}
            {...(workspace?.activeCycle?.refs.signalId ? { activeSignalId: workspace.activeCycle.refs.signalId } : {})}
            isWorking={isWorking}
            onActivate={(signal) => {
              void runCommand(
                { type: 'activate_signal', signalId: signal.id },
                'Signal activated',
              );
            }}
            onDismiss={(signal) => {
              void runCommand(
                { type: 'dismiss_signal', signalId: signal.id, reason: 'Dismissed from web workspace' },
                'Signal dismissed',
              );
            }}
          />
        </div>
      </section>
      {settingsOpen ? (
        <SettingsModal
          user={session.user}
          subscription={subscription}
          usage={usage}
          commercialState={commercialState}
          emailReadiness={emailReadiness}
          activeSection={settingsSection}
          isWorking={isWorking}
          onClose={() => setSettingsOpen(false)}
          onChangeSection={setSettingsSection}
          onStartOutlookOAuth={startOutlookOAuth}
          onSyncEmail={syncEmail}
        />
      ) : null}
    </main>
  );
}

function AuthScreen(props: {
  apiBaseUrl: string;
  isWorking: boolean;
  notice: Notice | null;
  onAuth: (mode: 'login' | 'signup', email: string, password: string, fullName?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(TEST_PASSWORD);
  const [fullName, setFullName] = useState('Test Operator');

  function useGeneratedUser() {
    setMode('signup');
    setFullName('Test Operator');
    setPassword(TEST_PASSWORD);
    setEmail(`web-test-${Date.now()}@example.com`);
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand-row">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="eyebrow">Opportunity OS</p>
            <h1>AI-led opportunity execution</h1>
          </div>
        </div>

        <p className="auth-copy">
          Enter the workspace where the assistant stays central and each cycle moves from signal to execution.
        </p>

        <div className="segmented-control" aria-label="Authentication mode">
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
            Sign up
          </button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
            Log in
          </button>
        </div>

        {props.notice ? <NoticeBanner notice={props.notice} compact /> : null}

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void props.onAuth(mode, email, password, fullName);
          }}
        >
          {mode === 'signup' ? (
            <label>
              Name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Test Operator" />
            </label>
          ) : null}
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>

          <div className="auth-actions">
            <button className="primary-button" disabled={props.isWorking || !email || !password} type="submit">
              {props.isWorking ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
              Enter workspace
            </button>
            <button className="secondary-button" disabled={props.isWorking} onClick={useGeneratedUser} type="button">
              Create test user
            </button>
          </div>
        </form>

        <p className="api-note">API: {props.apiBaseUrl}</p>
      </section>
    </main>
  );
}

function ConductorPane(props: {
  userEmail: string;
  messages: ConversationMessage[];
  suggestedPrompts: string[];
  currentReasoningSummary: string | null;
  isWorking: boolean;
  onSend: (message: string) => Promise<void>;
  onLogout: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [draftMessage, setDraftMessage] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [paneWidth, setPaneWidth] = useState(420);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [props.messages]);

  // Set CSS variable for grid layout
  useEffect(() => {
    if (props.expanded) {
      document.documentElement.style.setProperty('--conductor-width', `${paneWidth}px`);
    }
  }, [paneWidth, props.expanded]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = paneWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(300, Math.min(600, startWidth + deltaX));
      setPaneWidth(newWidth);
      
      // Update CSS variable for dynamic width
      document.documentElement.style.setProperty('--conductor-width', `${newWidth}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <aside 
      ref={paneRef}
      className={`conductor-pane ${isResizing ? 'resizing' : ''} ${props.expanded ? 'expanded' : 'collapsed'}`}
      style={{ width: props.expanded ? `${paneWidth}px` : '60px' }}
    >
      <header className="conductor-header">
        <div className="conductor-title">
          <div className="assistant-mark">
            <Bot size={21} />
          </div>
          {props.expanded && (
            <div>
              <p className="eyebrow">The Conductor</p>
              <h2>Strategic operator</h2>
            </div>
          )}
        </div>
        <div className="conductor-actions">
          <button 
            className="icon-button" 
            onClick={props.onToggleExpanded} 
            title={props.expanded ? "Collapse conductor" : "Expand conductor"}
            type="button"
          >
            {props.expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
          {props.expanded && (
            <button className="icon-button" onClick={props.onLogout} title="Log out" type="button">
              <UserRound size={18} />
            </button>
          )}
        </div>
      </header>

      {props.expanded && (
        <>
          <div className="account-chip">{props.userEmail}</div>
        </>
      )}

      {/* Resize handle */}
      {props.expanded && (
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        />
      )}

      {props.expanded && (
        <>
          {props.currentReasoningSummary ? (
            <div className="reasoning-card">
              <p className="label">Current reasoning</p>
              <p>{props.currentReasoningSummary}</p>
            </div>
          ) : null}

          <div ref={scrollRef} className="conversation-thread">
            {props.messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <p>{message.text}</p>
              </article>
            ))}
            {props.isWorking ? (
              <article className="message assistant pending">
                <Loader2 className="spin" size={16} />
                <p>Working through the current cycle...</p>
              </article>
            ) : null}
          </div>

          <div className="prompt-row">
            {props.suggestedPrompts.slice(0, 3).map((prompt) => (
              <button key={prompt} onClick={() => void props.onSend(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              const message = draftMessage.trim();
              setDraftMessage('');
              void props.onSend(message);
            }}
          >
            <textarea
              aria-label="Message the Conductor"
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder="Tell the assistant what you want to create, review, or execute..."
              rows={3}
              value={draftMessage}
            />
            <button className="send-button" disabled={!draftMessage.trim() || props.isWorking} title="Send message" type="submit">
              <Send size={18} />
            </button>
          </form>
        </>
      )}
    </aside>
  );
}

function WorkspaceTopBar(props: {
  workspace: WorkspaceState | null;
  subscription: SubscriptionSummary | null;
  usage: UsageSummary | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
}) {
  const velocity = props.workspace?.velocity ?? emptyVelocity;
  const aiUsage = props.usage?.usage?.find((item) => item.featureKey === 'ai_requests');

  return (
    <header className="workspace-topbar">
      <div>
        <p className="eyebrow">Canvas</p>
        <h1>{props.workspace?.activeCycle?.title ?? 'Opportunity cycle engine'}</h1>
      </div>
      <div className="topbar-actions">
        <Metric label="Signals" value={velocity.pendingSignalCount} tone="blue" />
        <Metric label="Outreach" value={velocity.outreachSentThisWeek} tone="green" />
        <Metric label="Open tasks" value={velocity.openTaskCount} tone="amber" />
        <div className="plan-pill">
          <span>{props.subscription?.plan.name ?? 'Plan'}</span>
          <strong>{formatRemaining(aiUsage)}</strong>
        </div>
        <button className="icon-button" onClick={props.onOpenSettings} title="Open settings" type="button">
          <UserRound size={18} />
        </button>
        <button className="icon-button" onClick={props.onRefresh} title="Refresh workspace" type="button">
          {props.isLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
      </div>
    </header>
  );
}

function SettingsModal(props: {
  user: AuthResponse['user'];
  subscription: SubscriptionSummary | null;
  usage: UsageSummary | null;
  commercialState: CommercialState | null;
  emailReadiness: EmailReadiness | null;
  activeSection: SettingsSection;
  isWorking: boolean;
  onClose: () => void;
  onChangeSection: (section: SettingsSection) => void;
  onStartOutlookOAuth: () => Promise<void>;
  onSyncEmail: () => Promise<void>;
}) {
  const aiUsage = props.usage?.usage?.find((item) => item.featureKey === 'ai_requests') ?? null;
  const discoveryUsage = props.usage?.usage?.find((item) => item.featureKey === 'discovery_scans') ?? null;
  const cycleUsage = props.usage?.usage?.find((item) => item.featureKey === 'next_action_cycles') ?? null;
  const connectorName = props.emailReadiness?.connector?.providerDisplayName ?? 'Outlook / Hotmail';

  return (
    <div className="settings-modal-overlay" onClick={props.onClose} role="presentation">
      <section
        aria-label="User settings"
        className="settings-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Account and workspace controls</h2>
          </div>
          <button className="icon-button" onClick={props.onClose} title="Close settings" type="button">
            <X size={18} />
          </button>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            <SettingsNavButton
              active={props.activeSection === 'profile'}
              icon={<UserRound size={16} />}
              label="Profile"
              onClick={() => props.onChangeSection('profile')}
            />
            <SettingsNavButton
              active={props.activeSection === 'connectors'}
              icon={<Mail size={16} />}
              label="Connectors"
              onClick={() => props.onChangeSection('connectors')}
            />
            <SettingsNavButton
              active={props.activeSection === 'usage'}
              icon={<CircleGauge size={16} />}
              label="Usage & Plan"
              onClick={() => props.onChangeSection('usage')}
            />
            <SettingsNavButton
              active={props.activeSection === 'notifications'}
              icon={<Bell size={16} />}
              label="Notifications"
              onClick={() => props.onChangeSection('notifications')}
            />
          </nav>

          <div className="settings-panel">
            {props.activeSection === 'profile' ? (
              <div className="settings-section">
                <div className="surface-card">
                  <p className="label">Profile</p>
                  <h3>{props.user.fullName ?? 'Operator'}</h3>
                  <div className="settings-detail-list">
                    <div>
                      <span>Email</span>
                      <strong>{props.user.email}</strong>
                    </div>
                    <div>
                      <span>Timezone</span>
                      <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>
                    </div>
                    <div>
                      <span>User ID</span>
                      <strong>{props.user.id}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {props.activeSection === 'connectors' ? (
              <div className="settings-section">
                <div className="surface-card">
                  <p className="label">Email connector</p>
                  <h3>{connectorName}</h3>
                  <p>
                    {props.emailReadiness?.ready
                      ? 'Connected. Real outreach and inbox sync are available.'
                      : props.emailReadiness?.upgradeHint ?? 'Connect Outlook to enable real email send and reply sync.'}
                  </p>
                </div>
                <div className="action-grid">
                  <button
                    className="primary-button"
                    disabled={props.isWorking}
                    onClick={() => void props.onStartOutlookOAuth()}
                    type="button"
                  >
                    {props.isWorking ? <Loader2 className="spin" size={16} /> : <Mail size={16} />}
                    {props.emailReadiness?.ready ? 'Reconnect Outlook' : 'Connect Outlook'}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={props.isWorking || !props.emailReadiness?.ready}
                    onClick={() => void props.onSyncEmail()}
                    type="button"
                  >
                    {props.isWorking ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                    Sync inbox
                  </button>
                </div>
              </div>
            ) : null}

            {props.activeSection === 'usage' ? (
              <div className="settings-section">
                <div className="surface-card">
                  <p className="label">Plan</p>
                  <h3>{props.subscription?.plan.name ?? props.commercialState?.subscription.plan.name ?? 'Unknown plan'}</h3>
                  <p>
                    {props.subscription?.status ?? props.commercialState?.subscription.status ?? 'No subscription status available'}
                  </p>
                </div>
                <div className="settings-usage-grid">
                  <UsageCard label="AI requests" usage={aiUsage} />
                  <UsageCard label="Discovery scans" usage={discoveryUsage} />
                  <UsageCard label="Action cycles" usage={cycleUsage} />
                </div>
              </div>
            ) : null}

            {props.activeSection === 'notifications' ? (
              <div className="settings-section">
                <div className="surface-card">
                  <p className="label">Notifications</p>
                  <h3>Coaching and momentum prompts</h3>
                  <p>
                    Notification preferences are not configurable yet. This section will hold delivery controls for coaching nudges,
                    momentum reminders, and blocked-action prompts.
                  </p>
                </div>
                <div className="settings-detail-list muted-panel">
                  <div>
                    <span>Current state</span>
                    <strong>Using in-product notices and signals</strong>
                  </div>
                  <div>
                    <span>Next step</span>
                    <strong>Add delivery preferences and reactivation controls</strong>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsNavButton(props: {
  active: boolean;
  icon: JSX.Element;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`settings-nav-button ${props.active ? 'active' : ''}`} onClick={props.onClick} type="button">
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

function UsageCard(props: { label: string; usage: EntitlementSummary | null | undefined }) {
  return (
    <article className="surface-card usage-card">
      <p className="label">{props.label}</p>
      <h3>{formatRemaining(props.usage ?? undefined)}</h3>
      <p>
        {props.usage
          ? `${props.usage.used} used${typeof props.usage.limit === 'number' ? ` of ${props.usage.limit}` : ''}`
          : 'No usage tracked yet'}
      </p>
    </article>
  );
}

function ActiveWorkspace(props: {
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
}) {
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
            detail="Use the Conductor to define the next objective, then the Canvas will show the confirmation step."
          />
        )
      ) : null}

      {props.view.action === 'confirm_offering' ? (
        <OfferingConfirmCanvas />
      ) : null}

      {props.view.action === 'run_discovery' || props.view.action === 'review_discovery_targets' ? (
        <DiscoveryCanvas
          campaignWorkspace={props.campaignWorkspace}
          isWorking={props.isWorking}
          onStartScan={props.onStartDiscoveryScan}
          onAcceptTarget={props.onAcceptDiscoveryTarget}
          onRejectTarget={props.onRejectDiscoveryTarget}
          onPromoteTargets={props.onPromoteDiscoveryTargets}
        />
      ) : null}

      {props.view.action === 'upload_asset' ? (
        <AssetUploadCanvas />
      ) : null}

      {props.view.action === 'review_asset' ? (
        <AssetReviewCanvas cycle={cycle} recommendation={recommendation} />
      ) : null}

      {props.view.action === 'draft_email' ? (
        props.draft ? (
          <DraftWorkspace
            draft={props.draft}
            cycle={cycle}
            emailReadiness={props.emailReadiness}
            isWorking={props.isWorking}
            executionState={props.outreachExecutionState}
            onChange={props.onDraftChange}
            onSend={props.onSendDraft}
            onCompleteCycle={props.onCompleteCycle}
            onConnectEmail={props.onConnectEmail}
            onStartOutlookOAuth={props.onStartOutlookOAuth}
            onSyncEmail={props.onSyncEmail}
          />
        ) : (
          <CanvasEmptyState
            title="No draft loaded"
            detail="Generate an outreach draft from an active opportunity before editing or sending."
          />
        )
      ) : null}

      {props.view.action === 'confirm_send' || props.view.action === 'complete_cycle' ? (
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
            title="No active cycle"
            detail="There is no cycle to confirm yet. Ask the Conductor what should move next."
          />
        )
      ) : null}
    </section>
  );
}

function CanvasActionSummary(props: { view: WorkspaceViewState }) {
  return (
    <div className="canvas-summary">
      <div>
        <p className="label">Current action</p>
        <strong>{props.view.title}</strong>
        <p>{props.view.explanation}</p>
      </div>
      <span>{props.view.primaryAction ? `Next: ${actionLabel(props.view.primaryAction)}` : `${props.view.allowedActions.size} actions available`}</span>
    </div>
  );
}

function CanvasEmptyState(props: { title: string; detail: string }) {
  return (
    <div className="empty-workspace compact">
      <Target size={30} />
      <h3>{props.title}</h3>
      <p>{props.detail}</p>
    </div>
  );
}

function CycleTimeline(props: { phase: string }) {
  return (
    <div className="cycle-steps timeline" aria-label="Cycle timeline">
      {['surfaced', 'pursued', 'executed', 'confirmed'].map((step, index) => (
        <div key={step} className={stepClass(props.phase, step, index)}>
          <span>{index + 1}</span>
          <p>{step}</p>
        </div>
      ))}
    </div>
  );
}

function StrategicPlanWorkspace(props: {
  preview: StrategicPlanResult | null;
  isWorking: boolean;
  mode: 'planning' | 'campaign_ready';
  onPreview?: () => Promise<void>;
  onFinalize?: () => Promise<void>;
  onContinue?: () => void;
}) {
  const finalized = props.mode === 'campaign_ready' && props.preview;

  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">{finalized ? 'Campaign ready' : 'Proposed strategy'}</p>
        <h3>{props.preview?.goal.title ?? 'Goal proposal is ready'}</h3>
        <p>
          {finalized
            ? `The AI has established the goal, created the campaign, and selected the first motion. Review the synthesis before moving into execution.`
            : props.preview?.goal.description ??
            'The Conductor has identified a strategic goal. Preview the plan, then confirm it to create the goal, campaign, and first execution cycle.'}
        </p>
      </div>

      {props.preview ? (
        <div className="strategy-preview-grid">
          <article className="surface-card">
            <p className="label">Campaign</p>
            <h3>{props.preview.campaign.title}</h3>
            <p>{props.preview.campaign.strategicAngle}</p>
            <span className="status-badge">{props.preview.campaign.targetSegment}</span>
          </article>
          <article className="surface-card">
            <p className="label">{finalized ? 'Recommended first move' : 'First cycle'}</p>
            <h3>{props.preview.extractedIntent.firstCycleTitle}</h3>
            <ol className="cycle-list">
              {props.preview.extractedIntent.firstCycleSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
          <article className="surface-card wide">
            <p className="label">{finalized ? 'AI feedback' : 'First draft prompt'}</p>
            <p>
              {finalized
                ? buildCampaignBriefText(props.preview)
                : props.preview.extractedIntent.firstDraftPrompt}
            </p>
          </article>
        </div>
      ) : null}

      <div className="action-grid">
        {finalized ? (
          <button className="primary-button" disabled={props.isWorking} onClick={() => props.onContinue?.()} type="button">
            {props.isWorking ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
            Continue to first action
          </button>
        ) : (
          <>
            <button className="secondary-button" disabled={props.isWorking || !props.onPreview} onClick={() => props.onPreview && void props.onPreview()} type="button">
              {props.isWorking ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              Preview plan
            </button>
            <button className="primary-button" disabled={props.isWorking || !props.onFinalize} onClick={() => props.onFinalize && void props.onFinalize()} type="button">
              {props.isWorking ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
              Confirm goal
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <div className="empty-workspace">
      <Target size={34} />
      <h3>No active cycle yet</h3>
      <p>Use the Conductor to define an offering, clarify a goal, or ask what opportunity should move next.</p>
    </div>
  );
}

function CycleWorkspace(props: {
  cycle: WorkspaceState['activeCycle'];
  recommendation: WorkspaceState['recommendation'];
  campaignWorkspace: CampaignWorkspace | null;
  isWorking: boolean;
  onCommand: (body: Record<string, unknown>, success: string) => Promise<void>;
  onGenerateDraft: () => Promise<void>;
  onGenerateDraftForOpportunity: (opportunityId: string, kind?: 'initial' | 'follow_up') => Promise<void>;
}) {
  const cycle = props.cycle;
  const allowed = new Set(cycle?.allowedActions ?? []);

  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">Current cycle</p>
        <h3>{cycle?.title ?? props.recommendation?.title ?? 'Highest leverage next move'}</h3>
        <p>{cycle?.whyItMatters ?? props.recommendation?.aiExplanation ?? props.recommendation?.reason ?? 'The assistant has identified this as the next action to move momentum forward.'}</p>
      </div>

      <div className="action-grid">
        <button className="primary-button" disabled={props.isWorking} onClick={() => void props.onGenerateDraft()} type="button">
          <Mail size={16} />
          Draft outreach
        </button>
        <button
          className="secondary-button"
          disabled={props.isWorking || !cycle || !allowed.has('advance_opportunity')}
          onClick={() =>
            void props.onCommand(
              { type: 'advance_opportunity', cycleId: cycle?.id, input: { stage: 'outreach_sent' } },
              'Opportunity advanced',
            )
          }
          type="button"
        >
          <Play size={16} />
          Advance opportunity
        </button>
        <button
          className="secondary-button"
          disabled={props.isWorking || !cycle || !allowed.has('create_task')}
          onClick={() =>
            void props.onCommand(
              { type: 'create_task', cycleId: cycle?.id, input: { title: cycle?.recommendedAction ?? 'Follow up on cycle' } },
              'Task created',
            )
          }
          type="button"
        >
          <ClipboardCheck size={16} />
          Create task
        </button>
        <button
          className="secondary-button"
          disabled={props.isWorking || !cycle || !allowed.has('complete_cycle')}
          onClick={() => void props.onCommand({ type: 'complete_cycle', cycleId: cycle?.id }, 'Cycle completed')}
          type="button"
        >
          <CheckCircle2 size={16} />
          Complete cycle
        </button>
      </div>

      {props.campaignWorkspace ? (
        <CampaignWorkspacePanel
          campaignWorkspace={props.campaignWorkspace}
          isWorking={props.isWorking}
          onGenerateDraft={props.onGenerateDraftForOpportunity}
        />
      ) : null}
    </div>
  );
}

function CampaignWorkspacePanel(props: {
  campaignWorkspace: CampaignWorkspace;
  isWorking: boolean;
  onGenerateDraft: (opportunityId: string, kind?: 'initial' | 'follow_up') => Promise<void>;
}) {
  const { campaignWorkspace } = props;
  const visibleProspects = campaignWorkspace.prospects.slice(0, 6);

  return (
    <div className="campaign-workspace">
      <div className="campaign-header">
        <div>
          <p className="label">Campaign workspace</p>
          <h3>{campaignWorkspace.campaign.title}</h3>
          <p>{campaignWorkspace.campaign.targetSegment ?? campaignWorkspace.campaign.strategicAngle}</p>
        </div>
        <div className="campaign-metrics">
          <Metric label="Prospects" value={campaignWorkspace.metrics.prospectCount} tone="blue" />
          <Metric label="Drafts" value={campaignWorkspace.metrics.draftQueueCount} tone="amber" />
          <Metric label="Follow-ups" value={campaignWorkspace.metrics.followUpQueueCount} tone="green" />
        </div>
      </div>

      <div className="prospect-table" role="table" aria-label="Campaign prospects">
        <div className="prospect-row header" role="row">
          <span>Prospect</span>
          <span>Stage</span>
          <span>Next</span>
          <span>Action</span>
        </div>
        {visibleProspects.map((prospect) => (
          <ProspectRow
            key={prospect.id}
            prospect={prospect}
            isWorking={props.isWorking}
            onGenerateDraft={props.onGenerateDraft}
          />
        ))}
      </div>
    </div>
  );
}

function ProspectRow(props: {
  prospect: CampaignProspectSummary;
  isWorking: boolean;
  onGenerateDraft: (opportunityId: string, kind?: 'initial' | 'follow_up') => Promise<void>;
}) {
  const needsFollowUp = Boolean(props.prospect.lastEmailAt && !props.prospect.openFollowUpTask);
  return (
    <div className="prospect-row" role="row">
      <span>
        <strong>{props.prospect.companyName}</strong>
        <small>{props.prospect.primaryPersonName ?? props.prospect.title}</small>
      </span>
      <span><StatusBadge label={props.prospect.stage} /></span>
      <span>{props.prospect.nextAction ?? (needsFollowUp ? 'Follow up' : 'Draft outreach')}</span>
      <span>
        <button
          className="secondary-button compact"
          disabled={props.isWorking}
          onClick={() => void props.onGenerateDraft(props.prospect.id, needsFollowUp ? 'follow_up' : 'initial')}
          type="button"
        >
          <Mail size={15} />
          {needsFollowUp ? 'Follow up' : 'Draft'}
        </button>
      </span>
    </div>
  );
}

function DiscoveryCanvas(props: {
  campaignWorkspace: CampaignWorkspace | null;
  isWorking: boolean;
  onStartScan: () => Promise<void>;
  onAcceptTarget: (targetId: string) => Promise<void>;
  onRejectTarget: (targetId: string) => Promise<void>;
  onPromoteTargets: (scanId: string) => Promise<void>;
}) {
  const [showRejected, setShowRejected] = useState(false);
  const scan = props.campaignWorkspace?.discovery?.scans?.[0] ?? null;
  const allTargets = scan?.targets ?? [];
  const targets = showRejected ? allTargets : allTargets.filter((t) => t.status !== 'rejected');
  const acceptedCount = allTargets.filter((target) => target.status === 'accepted').length;
  const providerKeys = Array.isArray(scan?.providerKeys) ? scan?.providerKeys : [];

  return (
    <div className="execution-surface discovery-canvas">
      <div className="surface-card priority">
        <p className="label">Discovery</p>
        <h3>{scan ? scan.query : 'Find campaign targets'}</h3>
        <p>
          {scan
            ? 'Review the strongest targets, keep the ones that fit, and promote accepted targets into the campaign.'
            : 'Run a focused scan using the current offering and campaign context.'}
        </p>
      </div>

      <div className="action-grid">
        <button className={`primary-button ${props.isWorking ? 'working' : ''}`} disabled={props.isWorking} onClick={() => void props.onStartScan()} type="button">
          {props.isWorking ? (
            <>
              <Loader2 className="spin" size={16} />
              Searching providers...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Run scan
            </>
          )}
        </button>
        <button
          className="secondary-button"
          disabled={props.isWorking || !scan || acceptedCount === 0}
          onClick={() => scan && void props.onPromoteTargets(scan.id)}
          type="button"
        >
          <CheckCircle2 size={16} />
          Promote accepted
        </button>
      </div>

      {scan ? (
        <div className="discovery-results">
          <div className="campaign-header compact">
            <div>
              <p className="label">Latest scan</p>
              <h3>{scan.targetCount} targets found</h3>
              {providerKeys.length > 0 ? <p className="meta">Providers: {providerKeys.join(', ')}</p> : null}
            </div>
            <div className="campaign-metrics">
              <Metric label="Accepted" value={scan.acceptedCount} tone="green" />
              <Metric label="Promoted" value={scan.promotedCount} tone="blue" />
              <div className="metric-with-action">
                <Metric label="Rejected" value={scan.rejectedCount} tone="amber" />
                {scan.rejectedCount > 0 ? (
                  <button
                    className={`icon-button ${showRejected ? 'active' : ''}`}
                    onClick={() => setShowRejected(!showRejected)}
                    title={showRejected ? 'Hide rejected' : 'Show rejected'}
                    type="button"
                  >
                    {showRejected ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {targets.length > 0 ? (
            <div className="target-list">
              {targets.map((target) => (
                <DiscoveryTargetCard
                  key={target.id}
                  target={target}
                  isWorking={props.isWorking}
                  onAccept={props.onAcceptTarget}
                  onReject={props.onRejectTarget}
                />
              ))}
            </div>
          ) : (
            <CanvasEmptyState
              title={allTargets.length > 0 ? 'No visible targets' : 'No targets returned'}
              detail={allTargets.length > 0 ? 'All current targets are rejected. Toggle visibility to review them.' : 'Run a scan or adjust the campaign query to produce reviewable targets.'}
            />
          )}
        </div>
      ) : (
        <CanvasEmptyState title="No discovery scan yet" detail="Run the first scan to produce explainable campaign targets." />
      )}
    </div>
  );
}

function DiscoveryTargetCard(props: {
  target: DiscoveryTargetSummary;
  isWorking: boolean;
  onAccept: (targetId: string) => Promise<void>;
  onReject: (targetId: string) => Promise<void>;
}) {
  const evidence = props.target.evidence?.[0];
  const isLocked = props.target.status === 'promoted' || props.target.status === 'rejected';
  const metadata = props.target.metadata ?? {};
  const existingMatch = typeof metadata['existingMatch'] === 'object' && metadata['existingMatch'] !== null
    ? (metadata['existingMatch'] as Record<string, unknown>)
    : null;
  const matchedDetails = typeof existingMatch?.['details'] === 'string' ? existingMatch['details'] : null;
  const providerKeys = Array.isArray(metadata['providerKeys'])
    ? (metadata['providerKeys'] as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];

  return (
    <article className="target-card">
      <div className="target-card-main">
        <div className="target-icon">
          <UserRound size={18} />
        </div>
        <div>
          <div className="target-title-row">
            <h4>{props.target.title}</h4>
            <div className="target-badges">
              {props.target.relevanceScore >= 80 && <span className="status-badge high-relevance">High Relevance</span>}
              <StatusBadge label={props.target.status} />
            </div>
          </div>
          <div className="target-reasoning">
            <Sparkles size={14} className="reasoning-icon" />
            <p>{props.target.whyThisTarget ?? 'This target matched the discovery scan.'}</p>
          </div>
          {metadata['source'] === 'internal_db' ? (
            <div className="source-badge internal">
              <Database size={12} />
              <span>Database Match</span>
            </div>
          ) : null}
          {matchedDetails ? <small className="match-info">Matched existing: {matchedDetails}</small> : null}
          {providerKeys.length > 0 ? <small className="provider-info">Sourced via {providerKeys.join(', ')}</small> : null}
          {evidence ? <small className="evidence-info">Evidence: {evidence.snippet ?? evidence.title}</small> : null}
        </div>
      </div>
      <div className="target-score-row">
        <Metric label="Relevance" value={props.target.relevanceScore} tone="blue" />
        <Metric label="Confidence" value={props.target.confidenceScore} tone="green" />
        <div className="target-actions">
          <button
            className="secondary-button compact"
            disabled={props.isWorking || isLocked || props.target.status === 'accepted'}
            onClick={() => void props.onAccept(props.target.id)}
            type="button"
          >
            <CheckCircle2 size={15} />
            Accept
          </button>
          <button
            className="secondary-button compact"
            disabled={props.isWorking || isLocked}
            onClick={() => void props.onReject(props.target.id)}
            type="button"
          >
            <X size={15} />
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}

function OfferingConfirmCanvas() {
  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">Offering</p>
        <h3>Define the offer through the Conductor</h3>
        <p>The Canvas will stay focused on confirmation, uploads, and review steps while the conversation captures positioning.</p>
      </div>
    </div>
  );
}

function AssetUploadCanvas() {
  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">Supporting asset</p>
        <h3>Upload source material</h3>
        <p>Attach the file that supports the current offering or campaign. The Conductor can use it as leverage in later cycles.</p>
      </div>
      <div className="draft-warning">
        <strong>Upload control pending</strong>
        <p>The backend upload path exists; this Canvas action is ready for the file picker implementation.</p>
      </div>
    </div>
  );
}

function AssetReviewCanvas(props: {
  cycle: WorkspaceState['activeCycle'];
  recommendation: WorkspaceState['recommendation'];
}) {
  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">Asset review</p>
        <h3>{props.cycle?.title ?? props.recommendation?.title ?? 'Review supporting material'}</h3>
        <p>{props.recommendation?.recommendedAction ?? 'Confirm whether this material should be used in the current cycle.'}</p>
      </div>
    </div>
  );
}

function PlanningWorkspace(props: {
  cycle: WorkspaceState['activeCycle'];
  recommendation: WorkspaceState['recommendation'];
}) {
  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">Planning surface</p>
        <h3>{props.cycle?.title ?? props.recommendation?.title ?? 'Shape the next cycle'}</h3>
        <p>{props.cycle?.recommendedAction ?? props.recommendation?.recommendedAction ?? 'Use the Conductor to clarify the plan and lock the next execution step.'}</p>
      </div>
    </div>
  );
}

function EmailReadinessPanel(props: {
  readiness: EmailReadiness | null;
  isWorking: boolean;
  onConnectEmail: (providerName: 'gmail' | 'outlook', accessToken: string, emailAddress?: string) => Promise<void>;
  onStartOutlookOAuth: () => Promise<void>;
  onSyncEmail: () => Promise<void>;
}) {
  const [providerName, setProviderName] = useState<'gmail' | 'outlook'>('gmail');
  const [accessToken, setAccessToken] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const ready = props.readiness?.ready === true;

  return (
    <div className={`send-readiness ${ready ? 'ready' : 'blocked'}`}>
      <div>
        <p className="label">Send readiness</p>
        <strong>{ready ? `${props.readiness?.connector?.providerDisplayName ?? 'Email'} connected` : 'Email connector required'}</strong>
        <p>
          {ready
            ? 'Real outreach will send through the connected provider. Sync can detect replies and link them to opportunities.'
            : props.readiness?.upgradeHint ?? 'Connect Gmail or Outlook before sending real outreach.'}
        </p>
      </div>

      {ready ? (
        <button className="secondary-button compact" disabled={props.isWorking} onClick={() => void props.onSyncEmail()} type="button">
          <RefreshCw size={15} />
          Sync replies
        </button>
      ) : (
        <div className="connector-form">
          <select value={providerName} onChange={(event) => setProviderName(event.target.value as 'gmail' | 'outlook')}>
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
          </select>
          {providerName === 'outlook' ? (
            <button
              className="primary-button compact"
              disabled={props.isWorking}
              onClick={() => void props.onStartOutlookOAuth()}
              type="button"
            >
              <CheckCircle2 size={15} />
              Connect with Microsoft
            </button>
          ) : null}
          <input
            value={emailAddress}
            onChange={(event) => setEmailAddress(event.target.value)}
            placeholder="email address"
            type="email"
          />
          <input
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            placeholder="OAuth access token"
            type="password"
          />
          <button
            className="secondary-button compact"
            disabled={props.isWorking || !accessToken}
            onClick={() => void props.onConnectEmail(providerName, accessToken, emailAddress || undefined)}
            type="button"
          >
            <CheckCircle2 size={15} />
            {providerName === 'outlook' ? 'Use token instead' : 'Connect'}
          </button>
        </div>
      )}
    </div>
  );
}

function DraftWorkspace(props: {
  draft: OutreachDraft;
  cycle: WorkspaceState['activeCycle'];
  emailReadiness: EmailReadiness | null;
  isWorking: boolean;
  executionState: OutreachExecutionState;
  onChange: (draft: OutreachDraft) => void;
  onSend: () => Promise<void>;
  onCompleteCycle: () => Promise<void>;
  onConnectEmail: (providerName: 'gmail' | 'outlook', accessToken: string, emailAddress?: string) => Promise<void>;
  onStartOutlookOAuth: () => Promise<void>;
  onSyncEmail: () => Promise<void>;
}) {
  const primaryRecipient = props.draft.recipients[0];
  const bodyWordCount = props.draft.body.trim() ? props.draft.body.trim().split(/\s+/).length : 0;
  const canComplete = props.executionState === 'blocked' || props.executionState === 'sent';

  return (
    <div className="draft-workspace">
      <div className="draft-meta">
        <div>
          <p className="label">Recipient</p>
          <h3>{primaryRecipient?.name ?? 'Recipient'}</h3>
          <p>{primaryRecipient?.organization ?? 'Organization pending'}</p>
        </div>
        <StatusBadge label={primaryRecipient?.email ? 'ready to send' : 'missing email'} />
      </div>

      {!primaryRecipient?.email ? (
        <div className="draft-warning">
          <strong>Recipient email is missing</strong>
          <p>This draft can be reviewed, but real provider send will need a resolved email address.</p>
        </div>
      ) : null}

      <EmailReadinessPanel
        readiness={props.emailReadiness}
        isWorking={props.isWorking}
        onConnectEmail={props.onConnectEmail}
        onStartOutlookOAuth={props.onStartOutlookOAuth}
        onSyncEmail={props.onSyncEmail}
      />

      <label>
        Subject
        <input
          value={props.draft.subject}
          onChange={(event) => props.onChange({ ...props.draft, subject: event.target.value })}
        />
      </label>

      <label>
        Body <span className="field-hint">{bodyWordCount} words</span>
        <textarea
          rows={14}
          value={props.draft.body}
          onChange={(event) => props.onChange({ ...props.draft, body: event.target.value })}
        />
      </label>

      <div className="draft-actions">
        <button className="primary-button" disabled={props.isWorking} onClick={() => void props.onSend()} type="button">
          {props.isWorking ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          {props.emailReadiness?.ready ? 'Send outreach' : 'Check send readiness'}
        </button>
        {canComplete ? (
          <button className="secondary-button" disabled={props.isWorking || !props.cycle} onClick={() => void props.onCompleteCycle()} type="button">
            <CheckCircle2 size={16} />
            Complete cycle
          </button>
        ) : null}
      </div>
      {canComplete ? (
        <div className={`execution-result ${props.executionState}`}>
          <strong>{props.executionState === 'blocked' ? 'Execution boundary reached' : 'Outreach recorded'}</strong>
          <p>
            {props.executionState === 'blocked'
              ? 'The send step was blocked by plan rules. You can still close this guided cycle and continue to the next action.'
              : 'The outreach step has been recorded. Complete the cycle to move the workspace forward.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SignalsPanel(props: {
  signals: WorkspaceSignalSummary[];
  activeSignalId?: string;
  isWorking: boolean;
  onActivate: (signal: WorkspaceSignalSummary) => void;
  onDismiss: (signal: WorkspaceSignalSummary) => void;
}) {
  return (
    <aside className="signals-panel">
      <div className="panel-header">
        <div>
          <p className="label">Signals</p>
          <h2>Needs attention</h2>
        </div>
        <CircleGauge size={20} />
      </div>

      <div className="signal-list">
        {props.signals.length === 0 ? (
          <p className="muted">No pending signals. Ask the Conductor to find the next opportunity cycle.</p>
        ) : null}
        {props.signals.map((signal) => (
          <article key={signal.id} className={`signal-card ${props.activeSignalId === signal.id ? 'active' : ''}`}>
            <div className="signal-heading">
              <StatusBadge label={signal.importance} />
              <span>{signal.priorityScore}</span>
            </div>
            <p className="label">Recommended: {actionLabel(actionFromMode(signal.recommendedWorkspaceMode))}</p>
            <h3>{signal.title}</h3>
            <p>{signal.summary ?? signal.reason ?? signal.recommendedAction}</p>
            <div className="signal-actions">
              <button disabled={props.isWorking} onClick={() => props.onActivate(signal)} type="button">
                Activate in Canvas
                <ChevronRight size={15} />
              </button>
              <button disabled={props.isWorking} onClick={() => props.onDismiss(signal)} type="button">
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function NoticeBanner(props: { notice: Notice; compact?: boolean; onDismiss?: () => void }) {
  return (
    <div className={`notice ${props.notice.tone} ${props.compact ? 'compact' : ''}`}>
      <div>
        <strong>{props.notice.title}</strong>
        <p>{props.notice.detail}</p>
      </div>
      {props.onDismiss ? (
        <button className="icon-button" onClick={props.onDismiss} title="Dismiss notice" type="button">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

function UpgradePrompt(props: {
  prompt: UpgradePromptState;
  plans: PlanSummary[];
  commercialState: CommercialState | null;
  isWorking: boolean;
  onCheckout: (planCode: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const paidPlans = props.plans.filter((plan) => plan.monthlyPriceCents > 0).slice(0, 3);
  const currentPlan = props.commercialState?.subscription.plan.name ?? 'current plan';
  const referral = props.commercialState?.referral;

  return (
    <section className="upgrade-panel">
      <div>
        <p className="label">Upgrade moment</p>
        <h3>{upgradeTitle(props.prompt.reason)}</h3>
        <p>{props.prompt.hint ?? `This capability is not available on ${currentPlan}.`}</p>
        {referral ? (
          <p className="referral-line">Referral rewards are active: share <strong>{referral.code}</strong> to earn extra credits after meaningful milestones.</p>
        ) : null}
      </div>
      <div className="upgrade-options">
        {paidPlans.map((plan) => (
          <button
            key={plan.code}
            className="secondary-button compact"
            disabled={props.isWorking}
            onClick={() => void props.onCheckout(plan.code)}
            type="button"
          >
            {plan.name}
            <span>{formatPrice(plan.monthlyPriceCents)}</span>
          </button>
        ))}
        <button className="icon-button" onClick={props.onDismiss} title="Dismiss upgrade prompt" type="button">
          <X size={16} />
        </button>
      </div>
    </section>
  );
}

function Metric(props: { label: string; value: number; tone: 'blue' | 'green' | 'amber' }) {
  return (
    <div className={`metric ${props.tone}`}>
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

function StatusBadge(props: { label: string }) {
  return <span className="status-badge">{props.label.replaceAll('_', ' ')}</span>;
}

function actionLabel(action: string) {
  return action.replaceAll('_', ' ');
}

function formatRemaining(item: { remaining?: number | null } | undefined) {
  if (!item) return 'Usage ready';
  if (item.remaining === null || item.remaining === undefined) return 'Unlimited AI';
  return `${item.remaining} AI left`;
}

function formatPrice(cents: number) {
  if (cents <= 0) return 'Free';
  return `$${Math.round(cents / 100)}/mo`;
}

function upgradeTitle(reason?: string) {
  if (reason === 'missing_required_connector') return 'Connect a provider to continue';
  if (reason === 'usage_limit_reached') return 'Usage limit reached';
  if (reason === 'plan_does_not_include_capability') return 'Upgrade to unlock this capability';
  if (reason === 'payment_required') return 'Choose a plan to continue';
  return 'Capability blocked';
}

function stepClass(phase: string | undefined, step: string, index: number) {
  const phaseText = phase ?? '';
  const active =
    phaseText.includes(step) ||
    (phaseText === 'active' && index === 1) ||
    (phaseText === 'proposed' && index === 0) ||
    (phaseText === 'pursued' && index <= 1) ||
    (phaseText === 'executed' && index <= 2) ||
    (phaseText === 'completed' && index <= 3);
  return `cycle-step ${active ? 'active' : ''}`;
}

function buildWorkspaceView(
  workspace: WorkspaceState | null,
  draft: OutreachDraft | null,
  pendingStrategicSessionId: string | null,
  campaignFeedback: StrategicPlanResult | null,
): WorkspaceViewState {
  const backendCanvas = workspace?.canvas;
  const mode = draft
    ? 'draft_edit'
    : campaignFeedback
      ? 'campaign_review'
      : pendingStrategicSessionId
        ? 'goal_planning'
        : workspace?.activeWorkspace.mode ?? 'empty';
  const cycle = workspace?.activeCycle ?? null;
  const recommendation = workspace?.recommendation ?? null;
  const action = draft
    ? 'draft_email'
    : campaignFeedback
      ? 'confirm_campaign'
      : pendingStrategicSessionId
        ? 'confirm_goal'
        : backendCanvas?.action ?? actionFromMode(mode);
  return {
    action,
    title:
      draft?.subject ??
      (campaignFeedback ? campaignFeedback.campaign.title : undefined) ??
      (pendingStrategicSessionId ? 'Goal proposal is ready' : undefined) ??
      backendCanvas?.title ??
      cycle?.title ??
      recommendation?.title ??
      (mode === 'goal_planning' ? 'Goal proposal' : 'Opportunity cycle engine'),
    explanation:
      (campaignFeedback ? buildCampaignBriefText(campaignFeedback) : undefined) ??
      backendCanvas?.explanation ??
      cycle?.whyItMatters ??
      recommendation?.aiExplanation ??
      recommendation?.reason ??
      'The Conductor will guide the next step and the Canvas will keep the current action focused.',
    phase: draft
      ? 'executed'
      : campaignFeedback
        ? 'pursued'
        : cycle?.phase ?? backendCanvas?.phase ?? (pendingStrategicSessionId ? 'pursued' : recommendation?.type ?? 'ready'),
    cycleId: cycle?.id ?? null,
    refs: campaignFeedback
      ? {
          goalId: campaignFeedback.goal.id,
          campaignId: campaignFeedback.campaign.id,
          ...(campaignFeedback.goal.offeringId ?? campaignFeedback.campaign.offeringId
            ? { offeringId: campaignFeedback.goal.offeringId ?? campaignFeedback.campaign.offeringId ?? '' }
            : {}),
          ...(workspace?.conductor.activeConversationId ? { conversationId: workspace.conductor.activeConversationId } : {}),
        }
      : backendCanvas?.refs ?? cycle?.refs ?? {},
    allowedActions: new Set(
      campaignFeedback
        ? ['continue']
        : backendCanvas?.allowedActions ?? cycle?.allowedActions ?? workspace?.activeWorkspace.allowedActions ?? [],
    ),
    primaryAction: campaignFeedback ? 'continue' : backendCanvas?.primaryAction ?? null,
  };
}

function buildCampaignBriefText(result: StrategicPlanResult) {
  const audience = result.campaign.targetSegment ?? result.extractedIntent.targetAudience;
  const angle = result.campaign.strategicAngle ?? 'the current positioning';
  return `The AI translated your goal into the campaign "${result.campaign.title}", focused on ${audience}. It chose this first motion because ${angle.toLowerCase()} gives the fastest path to real outreach momentum. The next step is ${result.extractedIntent.firstCycleTitle.toLowerCase()}.`;
}

function buildCampaignFeedbackMessage(result: StrategicPlanResult) {
  const audience = result.campaign.targetSegment ?? result.extractedIntent.targetAudience;
  const steps = result.extractedIntent.firstCycleSteps.slice(0, 2).join(', ');
  return `I established the goal "${result.goal.title}" and created the campaign "${result.campaign.title}" for ${audience}. I recommend starting with ${result.extractedIntent.firstCycleTitle.toLowerCase()} so we can move from planning into execution quickly. First steps: ${steps}.`;
}

function actionFromMode(mode: WorkspaceMode): CanvasAction {
  if (mode === 'empty') return 'idle';
  if (mode === 'goal_planning') return 'confirm_goal';
  if (mode === 'campaign_review') return 'confirm_campaign';
  if (mode === 'discovery_review') return 'review_discovery_targets';
  if (mode === 'discovery_scan') return 'run_discovery';
  if (mode === 'opportunity_review' || mode === 'signal_review') return 'review_opportunity';
  if (mode === 'draft_edit') return 'draft_email';
  if (mode === 'asset_review') return 'review_asset';
  if (mode === 'execution_confirm') return 'confirm_send';
  return 'complete_cycle';
}

function readSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}
