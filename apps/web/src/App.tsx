import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
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
  Users,
  Database,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { ApiClient, ApiError } from './lib/api';
import { useUIStore } from './store';
import { ConnectionsSettings } from './features/connections/components/ConnectionsSettings';
import { ProfileSettings } from './components/settings/ProfileSettings';
import { ConnectorsSettings } from './components/settings/ConnectorsSettings';
import { UsageSettings } from './components/settings/UsageSettings';
import { NotificationsSettings } from './components/settings/NotificationsSettings';
import { ConductorPane } from './components/conductor/ConductorPane';
import { OnboardingWizard } from './features/onboarding/components/OnboardingWizard';
import { AuthScreen } from './components/auth/AuthScreen';
import { LandingPage } from './features/marketing/components/LandingPage';
import { WorkspaceTopBar } from './components/workspace/WorkspaceTopBar';
import { ActiveWorkspace } from './components/workspace/ActiveWorkspace';
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
const PENDING_ONBOARDING_COMPLETION_KEY = 'opportunity-os:pending-onboarding-completion';
const CONTINUE_ONBOARDING_AFTER_AUTH_KEY = 'opportunity-os:continue-onboarding-after-auth';
const GUEST_ONBOARDING_DRAFT_KEY = 'opportunity-os:onboarding-draft:guest';
const WORKSPACE_ACTIVATION_PAYLOAD_KEY = 'opportunity-os:workspace-activation-payload';
const userOnboardingDraftKey = (userId: string) => `opportunity-os:onboarding-draft:${userId}`;
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

type SettingsSection = 'profile' | 'connectors' | 'connections' | 'usage' | 'billing' | 'notifications';

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

function readWorkspaceActivationPayload(): WorkspaceActivationPayload | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_ACTIVATION_PAYLOAD_KEY);
    return raw ? JSON.parse(raw) as WorkspaceActivationPayload : null;
  } catch {
    return null;
  }
}

function looksLikeFeedbackIntake(text: string): boolean {
  const normalized = text.toLowerCase();
  return /\b(got|received|have|had)\b/.test(normalized)
    && /\b(reply|response|responded|comment|screenshot|answer|message)\b/.test(normalized);
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
  console.log('📱 App RENDERED', { 
    hasSession: !!session, 
    userEmail: session?.user?.email,
    accessTokenPrefix: session?.accessToken?.substring(0, 10) 
  });
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
  const [activationPayload, setActivationPayload] = useState<WorkspaceActivationPayload | null>(() => readWorkspaceActivationPayload());
  const [actionCanvasPayload, setActionCanvasPayload] = useState<any | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');
  const [isBooting, setIsBooting] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [view, setView] = useState<'landing' | 'onboarding' | 'auth' | 'app'>(() => {
    // For local testing/iteration, we can force the landing page
    const params = new URLSearchParams(window.location.search);
    if (params.get('landing') === 'true') return 'landing';
    return session ? 'app' : 'landing';
  });
  
  // UI store for conductor expanded state
  const { conductorExpanded, toggleConductor, podiumMode, setPodiumMode } = useUIStore();
  const [billingState, setBillingState] = useState<any>(null);

  // ── Referral capture ──────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (!refCode) return;

    // Persist referral code for signup
    localStorage.setItem('opportunity-os-referral-code', refCode);

    // Clean URL
    params.delete('ref');
    const nextQuery = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);

    // Record visit on backend (fire-and-forget)
    const visitorId = localStorage.getItem('opportunity-os-visitor-id') || crypto.randomUUID();
    localStorage.setItem('opportunity-os-visitor-id', visitorId);

    api.recordReferralVisit({
      referralCode: refCode,
      visitorId,
      landingPath: window.location.pathname,
      landingUrl: window.location.href,
      referrerUrl: document.referrer || undefined,
    }).then((result) => {
      if (result?.id) {
        localStorage.setItem('opportunity-os-referral-visit-id', result.id);
      }
    }).catch(() => { /* silent – referral tracking is best-effort */ });
  }, [api]);

  // ── OAuth Callback Handling ─────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      console.log('🔐 OAUTH CALLBACK: Tokens detected');
      
      // We don't have the full user object yet, so we'll fetch it or the backend could pass it
      // For now, let's just trigger a login-like flow
      // A better way is to have the backend pass the user JSON as well
      
      // Temporary: fetch user if missing, or just refresh session
      // For simplicity in this PR, I'll assume the backend might pass user details in query too
      // OR I can use the accessToken to fetch /me
      
      const fetchUserAndCommit = async () => {
        setIsWorking(true);
        try {
          const tempApi = new ApiClient(accessToken);
          const { user, subscription, entitlements } = await tempApi.getCurrentUser();
          
          const auth: AuthResponse = {
            accessToken,
            refreshToken,
            user,
            session: { id: 'oauth-session' }, // SID will be in token anyway
            subscription,
            entitlements
          };
          
          commitSession(auth);
          
          // Clean URL
          params.delete('accessToken');
          params.delete('refreshToken');
          const nextQuery = params.toString();
          window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
          
          const providerName = params.get('provider') || 'social';
          setNotice({
            title: `Logged in with ${providerName.charAt(0).toUpperCase() + providerName.slice(1)}`,
            detail: `Welcome back, ${user.fullName || user.email}.`,
            tone: 'success'
          });
        } catch (error) {
          setNotice({
            title: 'Google Login failed',
            detail: 'Could not retrieve user profile after Google authentication.',
            tone: 'error'
          });
        } finally {
          setIsWorking(false);
        }
      };
      
      void fetchUserAndCommit();
    }
  }, []); // Only run on mount

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
      const billing = await api.getBillingState().catch(() => null);
      setBillingState(billing);
      const pendingActivation = readWorkspaceActivationPayload();
      if (pendingActivation) setActivationPayload(pendingActivation);
      if (pendingActivation?.persisted?.actionItemId) {
        const canvasPayload = await api.getActionItemCanvas(pendingActivation.persisted.actionItemId).catch(() => null);
        setActionCanvasPayload(canvasPayload);
      } else {
        setActionCanvasPayload(null);
      }
      
      // Auto-open onboarding if it's the first time
      const onboardingCompleted = localStorage.getItem(`onboarding_completed_${session.user.id}`);
      if (!onboardingCompleted) {
        setOnboardingOpen(true);
        setPodiumMode(true);
      }
      setMessages((current) => {
        if (current.length > 0) return current;
        if (pendingActivation) {
          return [
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: `We're now in the workspace. I've staged your first action cycle: ${pendingActivation.lane.title} for ${pendingActivation.campaign.title}. I’ll show you where the plan lives, then we’ll review the first proposed action before anything happens.`,
            },
          ];
        }
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauthProvider') !== 'outlook') return;

    const oauthSucceeded = params.get('oauthSuccess') === 'true';
    params.delete('oauthProvider');
    params.delete('oauthSuccess');
    const nextQuery = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);

    if (!oauthSucceeded) {
      setNotice({
        title: 'Outlook connect failed',
        detail: 'Microsoft redirected back without completing the Outlook connection.',
        tone: 'error',
      });
      return;
    }

    api.getEmailReadiness()
      .then((readiness) => {
        setEmailReadiness(readiness);
        setNotice({
          title: readiness.ready ? 'Outlook connected' : 'Outlook connection pending',
          detail: readiness.ready
            ? `Real outreach can now send through ${readiness.connector?.connectorName || readiness.connector?.providerDisplayName || 'Outlook'}.`
            : readiness.upgradeHint ?? 'The Outlook connection is still being verified.',
          tone: readiness.ready ? 'success' : 'warning',
        });
      })
      .catch((error) => {
        setNotice({
          title: 'Outlook status unavailable',
          detail: error instanceof Error ? error.message : 'The Outlook connection status could not be refreshed.',
          tone: 'error',
        });
      });
  }, [api]);

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
    setView('app');
  }

  async function handleAuth(mode: 'login' | 'signup', email: string, password: string, fullName?: string, initialStrategy?: any) {
    setIsWorking(true);
    setNotice(null);
    try {
      // Gather referral context from localStorage (captured on landing)
      const referralCode = localStorage.getItem('opportunity-os-referral-code') || undefined;
      const referralVisitId = localStorage.getItem('opportunity-os-referral-visit-id') || undefined;
      const referralVisitorId = localStorage.getItem('opportunity-os-visitor-id') || undefined;

      const auth =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.signup({
              email,
              password,
              fullName: fullName || 'Test Operator',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              initialStrategy,
              referralCode,
              referralVisitId,
              referralVisitorId,
            });

      // Clear referral context after successful signup
      if (mode === 'signup') {
        localStorage.removeItem('opportunity-os-referral-code');
        localStorage.removeItem('opportunity-os-referral-visit-id');
      }
      
      const continueOnboardingAfterAuth =
        localStorage.getItem(CONTINUE_ONBOARDING_AFTER_AUTH_KEY) === 'true';
      const completedOnboardingBeforeAuth =
        view === 'onboarding' ||
        localStorage.getItem(PENDING_ONBOARDING_COMPLETION_KEY) === 'true';

      if (continueOnboardingAfterAuth) {
        const guestDraft = localStorage.getItem(GUEST_ONBOARDING_DRAFT_KEY);
        if (guestDraft) {
          try {
            const draft = JSON.parse(guestDraft);
            localStorage.setItem(userOnboardingDraftKey(auth.user.id), JSON.stringify({
              ...draft,
              currentStep: 'connectivity',
            }));
          } catch {
            localStorage.setItem(userOnboardingDraftKey(auth.user.id), guestDraft);
          }
        }
        localStorage.removeItem(CONTINUE_ONBOARDING_AFTER_AUTH_KEY);
        localStorage.removeItem(GUEST_ONBOARDING_DRAFT_KEY);
        setOnboardingOpen(true);
        setPodiumMode(true);
      } else if (completedOnboardingBeforeAuth) {
        localStorage.setItem(`onboarding_completed_${auth.user.id}`, 'true');
        localStorage.removeItem(PENDING_ONBOARDING_COMPLETION_KEY);
        localStorage.removeItem(GUEST_ONBOARDING_DRAFT_KEY);
        setOnboardingOpen(false);
        setPodiumMode(false);
      }
      
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
    setView('landing');
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

  async function captureActionFeedback(input: {
    actionItemId: string;
    bodyText: string;
    attachmentUrls?: string[];
    attachmentMimeTypes?: string[];
  }) {
    if (!input.actionItemId) return null;
    setIsWorking(true);
    setNotice(null);
    try {
      const thread = await api.getOrCreateActionItemConversationThread(input.actionItemId);
      await api.captureConversationMessage(thread.id, {
        direction: 'inbound',
        source: input.attachmentUrls?.length ? 'screenshot' : 'manual_paste',
        bodyText: input.bodyText,
        attachmentUrls: input.attachmentUrls || [],
        attachmentMimeTypes: input.attachmentMimeTypes || [],
      });
      const synthesis = await api.synthesizeConversationThread(thread.id, { createSuggestedAction: true });
      setNotice({
        title: 'Feedback synthesized',
        detail: 'The reply is now attached to the action cycle and a follow-up action was suggested.',
        tone: 'success',
      });
      await loadWorkspace();
      return synthesis;
    } catch (error) {
      setNotice({
        title: 'Feedback capture failed',
        detail: error instanceof Error ? error.message : 'The reply could not be captured.',
        tone: 'error',
      });
      return null;
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmCanvasAction(input: { actionItemId: string; finalContent?: string; outcome?: string }) {
    if (!input.actionItemId) return null;
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.confirmActionItem(input.actionItemId, {
        ...(input.finalContent ? { finalContent: input.finalContent } : {}),
        outcome: input.outcome || 'confirmed_from_action_canvas',
        confirmationSource: 'user_confirmed',
      });
      setNotice({
        title: 'Action confirmed',
        detail: 'The action was logged and the workspace state was refreshed.',
        tone: 'success',
      });
      const canvasPayload = await api.getActionItemCanvas(input.actionItemId).catch(() => null);
      setActionCanvasPayload(canvasPayload);
      await loadWorkspace();
      return result;
    } catch (error) {
      setNotice({
        title: 'Action confirmation failed',
        detail: error instanceof Error ? error.message : 'The action could not be confirmed.',
        tone: 'error',
      });
      return null;
    } finally {
      setIsWorking(false);
    }
  }

  async function saveCanvasDraft(input: { actionItemId: string; draftContent: string }) {
    if (!input.actionItemId) return null;
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.updateActionItem(input.actionItemId, {
        draftContent: input.draftContent,
      });
      const canvasPayload = await api.getActionItemCanvas(input.actionItemId).catch(() => null);
      setActionCanvasPayload(canvasPayload);
      setNotice({
        title: 'Draft saved',
        detail: 'The action canvas draft was updated.',
        tone: 'success',
      });
      return result;
    } catch (error) {
      setNotice({
        title: 'Draft save failed',
        detail: error instanceof Error ? error.message : 'The draft could not be saved.',
        tone: 'error',
      });
      return null;
    } finally {
      setIsWorking(false);
    }
  }

  async function intakeCanvasFeedbackFromConductor(text: string) {
    const actionItemId = actionCanvasPayload?.actionItem?.id ?? activationPayload?.persisted?.actionItemId;
    if (!actionItemId) return false;
    if (!looksLikeFeedbackIntake(text)) return false;

    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.intakeConversationFeedback({
        message: text,
        bodyText: text,
        actionItemIdHint: actionItemId,
        channelHint: actionCanvasPayload?.panelType === 'email' ? 'email' : actionCanvasPayload?.panelType,
        createSuggestedAction: true,
      });
      const canvasPayload = await api.getActionItemCanvas(actionItemId).catch(() => null);
      setActionCanvasPayload(canvasPayload);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: result.status === 'captured'
            ? `I attached that response to this action, synthesized it, and created the next suggested follow-up. ${result.insight?.recommendedNextAction || ''}`.trim()
            : result.clarificationQuestion || 'I need one more detail to attach this response to the right conversation.',
        },
      ]);
      setNotice({
        title: result.status === 'captured' ? 'Response captured' : 'Clarification needed',
        detail: result.status === 'captured'
          ? 'The conversation thread and next action were updated.'
          : 'The Conductor found multiple possible matches.',
        tone: result.status === 'captured' ? 'success' : 'info',
      });
      await loadWorkspace();
      return true;
    } catch (error) {
      setNotice({
        title: 'Response intake failed',
        detail: error instanceof Error ? error.message : 'The response could not be attached.',
        tone: 'error',
      });
      return true;
    } finally {
      setIsWorking(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMessage: ConversationMessage = { id: crypto.randomUUID(), role: 'user', text };
    setMessages((current) => [...current, userMessage]);
    if (await intakeCanvasFeedbackFromConductor(text)) return;
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
      } else if (result.suggestedAction === 'ORCHESTRATE_DAILY_HABIT') {
        setPodiumMode(true);
        setNotice({
          title: 'Daily Brief Active',
          detail: 'I am preparing your strategic orchestration for the day.',
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
    const goalTitle = campaignWorkspace?.campaign?.title;
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
          popup?.close();
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

  async function startGmailOAuth() {
    setIsWorking(true);
    setNotice(null);
    try {
      const start = await api.startEmailOAuth('gmail', window.location.origin);
      const callbackOrigin = new URL(api.baseUrl).origin;
      const popup = window.open(start.authUrl, 'opportunity-os-gmail-oauth', 'width=560,height=760');
      if (!popup) {
        throw new Error('The OAuth popup was blocked by the browser.');
      }

      const result = await new Promise<{ success: boolean; emailAddress?: string | null; error?: string | null }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error('Timed out waiting for Google login to complete.'));
        }, 120000);

        function cleanup() {
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          popup?.close();
        }

        function onMessage(event: MessageEvent) {
          if (event.origin !== callbackOrigin) return;
          const data = event.data as { type?: string; provider?: string; success?: boolean; emailAddress?: string | null; error?: string | null };
          if (data?.type !== 'opportunity-os-oauth' || data.provider !== 'gmail') return;

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
        throw new Error(result.error ?? 'Google login did not complete successfully.');
      }

      const readiness = await api.getEmailReadiness();
      setEmailReadiness(readiness);
      setNotice({
        title: 'Gmail connected',
        detail: result.emailAddress
          ? `Real outreach can now send through ${result.emailAddress}.`
          : 'Real outreach can now send through Gmail.',
        tone: 'success',
      });
      await loadWorkspace();
    } catch (error) {
      setNotice({
        title: 'Gmail connect failed',
        detail: error instanceof Error ? error.message : 'The Google login flow could not be completed.',
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

  const handleOnboardingComplete = useCallback(() => {
    if (!session) return;
    const pendingActivation = readWorkspaceActivationPayload();
    setActivationPayload(pendingActivation);
    if (pendingActivation) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `We're now in the workspace. I've staged your first action cycle: ${pendingActivation.lane.title} for ${pendingActivation.campaign.title}. First, I’ll orient you to the Canvas and Conductor, then we’ll prepare the first action for your approval.`,
        },
      ]);
    }
    localStorage.setItem(`onboarding_completed_${session.user.id}`, 'true');
    setOnboardingOpen(false);
    setPodiumMode(false);
    void loadWorkspace();
  }, [session, loadWorkspace, setOnboardingOpen, setPodiumMode]);

  if (!session) {
    if (view === 'landing') {
      return <LandingPage onStart={(mode) => {
        if (mode === 'signup') setView('onboarding');
        else setView('auth');
      }} />;
    }
    
    if (view === 'onboarding') {
      return (
        <OnboardingWizard 
          onComplete={() => {
            localStorage.setItem(PENDING_ONBOARDING_COMPLETION_KEY, 'true');
            setView('app');
          }}
          api={api}
          emailReadiness={emailReadiness}
          isWorking={isWorking}
          notice={notice}
          onAuth={handleAuth}
          onConnectOutlook={startOutlookOAuth}
          onConnectGmail={startGmailOAuth}
          onSyncEmail={syncEmail}
        />
      );
    }

    return (
      <AuthScreen
        apiBaseUrl={api.baseUrl}
        isWorking={isWorking}
        notice={notice}
        onAuth={handleAuth}
      />
    );
  }

  if (view === 'landing') {
    return <LandingPage onStart={(mode) => setView(mode === 'signup' ? 'onboarding' : 'auth')} />;
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

        <div className="workspace-grid full-width">
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
            activationPayload={activationPayload}
            actionCanvasPayload={actionCanvasPayload}
            isWorking={isWorking}
            onCommand={runCommand}
            onCaptureActionFeedback={captureActionFeedback}
            onConfirmCanvasAction={confirmCanvasAction}
            onSaveActionDraft={saveCanvasDraft}
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
        </div>
      </section>
      {settingsOpen ? (
        <SettingsModal
          user={session.user}
          subscription={subscription}
          usage={usage}
          commercialState={commercialState}
          emailReadiness={emailReadiness}
          billingState={billingState}
          activeSection={settingsSection}
          isWorking={isWorking}
          onClose={() => setSettingsOpen(false)}
          onChangeSection={setSettingsSection}
          onStartOutlookOAuth={startOutlookOAuth}
          onSyncEmail={syncEmail}
        />
      ) : null}
      {onboardingOpen && session ? (
        <OnboardingWizard 
          user={session.user} 
          api={api}
          emailReadiness={emailReadiness}
          onComplete={handleOnboardingComplete} 
          onConnectOutlook={startOutlookOAuth}
          onSyncEmail={syncEmail}
          isWorking={isWorking}
          notice={notice}
        />
      ) : null}
    </main>
  );
}




function SettingsModal(props: {
  user: AuthResponse['user'];
  subscription: SubscriptionSummary | null;
  usage: UsageSummary | null;
  commercialState: CommercialState | null;
  emailReadiness: EmailReadiness | null;
  billingState?: any;
  activeSection: SettingsSection;
  isWorking: boolean;
  onClose: () => void;
  onChangeSection: (section: SettingsSection) => void;
  onStartOutlookOAuth: () => Promise<void>;
  onSyncEmail: () => Promise<void>;
}) {
  
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
              active={props.activeSection === 'connections'}
              icon={<Users size={16} />}
              label="Connections"
              onClick={() => props.onChangeSection('connections')}
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
              <ProfileSettings user={props.user} />
            ) : null}

            {props.activeSection === 'connectors' ? (
              <ConnectorsSettings
                emailReadiness={props.emailReadiness}
                isWorking={props.isWorking}
                onStartOutlookOAuth={props.onStartOutlookOAuth}
                onSyncEmail={props.onSyncEmail}
              />
            ) : null}

            {props.activeSection === 'connections' ? (
              <ConnectionsSettings isWorking={props.isWorking} />
            ) : null}

            {props.activeSection === 'usage' ? (
              <UsageSettings
                subscription={props.subscription}
                commercialState={props.commercialState}
                usage={props.usage}
                billingState={props.billingState}
              />
            ) : null}

            {props.activeSection === 'notifications' ? (
              <NotificationsSettings />
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
        <div className="canvas-empty-state">
          <div className="empty-state-content">
            <h3>No discovery scan yet</h3>
            <p>Run the first scan to produce explainable campaign targets.</p>
            <div className="empty-state-actions">
              <button
                onClick={props.onStartScan}
                className="primary-action"
                disabled={props.isWorking}
              >
                {props.isWorking ? 'Scanning...' : 'Run Discovery Scan'}
              </button>
              <div className="or-divider">
                <span>or</span>
              </div>
              <button
                onClick={() => window.location.href = '/connections/import'}
                className="secondary-action"
                disabled={props.isWorking}
              >
                Import LinkedIn Connections
              </button>
            </div>
          </div>
        </div>
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
