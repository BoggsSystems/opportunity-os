import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
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
  X,
} from 'lucide-react';
import { ApiClient, ApiError } from './lib/api';
import type {
  AuthResponse,
  ConversationMessage,
  OutreachDraft,
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
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingStrategicSessionId, setPendingStrategicSessionId] = useState<string | null>(null);
  const [strategicPreview, setStrategicPreview] = useState<StrategicPlanResult | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isBooting, setIsBooting] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!session) return;
    setIsBooting(true);
    try {
      const [workspaceState, subscriptionState, usageState] = await Promise.all([
        api.getWorkspace(),
        api.getSubscription(),
        api.getUsage(),
      ]);
      setWorkspace(workspaceState);
      setActiveConversationId((current) => current ?? workspaceState.conductor.activeConversationId);
      setSubscription(subscriptionState);
      setUsage(usageState);
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
    setMessages([]);
    setDraft(null);
    setActiveConversationId(null);
    setPendingStrategicSessionId(null);
    setStrategicPreview(null);
    setSubscription(null);
    setUsage(null);
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
          workspaceState: workspace.activeWorkspace.mode,
          activeCycle: workspace.activeCycle,
        };
      }

      const result = await api.converse(conversationInput);
      setActiveConversationId(result.sessionId);

      if (result.blocked) {
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
        setStrategicPreview(null);
        setNotice({
          title: 'Goal proposal ready',
          detail: 'Review the proposed goal and campaign in the Active Workspace.',
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

  async function generateDraft() {
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
      setNotice({ title: 'Draft generated', detail: 'The outreach draft is ready in the Active Workspace.', tone: 'success' });
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

  async function sendDraft() {
    if (!draft) return;
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.sendDraft(draft);
      if ('blocked' in result && result.blocked) {
        setNotice({
          title: 'Send blocked',
          detail: result.upgradeHint ?? result.upgradeReason ?? 'Email send is not available on the current plan.',
          tone: 'warning',
        });
        return;
      }
      setNotice({ title: 'Email recorded', detail: 'The outreach activity was linked back to the opportunity.', tone: 'success' });
      setDraft(null);
      await loadWorkspace();
    } catch (error) {
      const blocked = error instanceof ApiError && error.status === 402;
      setNotice({
        title: blocked ? 'Send blocked' : 'Send failed',
        detail: error instanceof Error ? error.message : 'The email could not be sent.',
        tone: blocked ? 'warning' : 'error',
      });
    } finally {
      setIsWorking(false);
    }
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
    <main className="app-shell">
      <ConductorPane
        userEmail={session.user.email}
        messages={messages}
        suggestedPrompts={workspace?.conductor.suggestedPrompts ?? []}
        currentReasoningSummary={workspace?.conductor.currentReasoningSummary ?? null}
        isWorking={isWorking}
        onSend={sendMessage}
        onLogout={logout}
      />

      <section className="workspace-pane">
        <WorkspaceTopBar
          workspace={workspace}
          subscription={subscription}
          usage={usage}
          isLoading={isBooting || isWorking}
          onRefresh={() => void loadWorkspace()}
        />

        {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}

        <div className="workspace-grid">
          <ActiveWorkspace
            workspace={workspace}
            draft={draft}
            pendingStrategicSessionId={pendingStrategicSessionId}
            strategicPreview={strategicPreview}
            isWorking={isWorking}
            onCommand={runCommand}
            onGenerateDraft={generateDraft}
            onDraftChange={setDraft}
            onSendDraft={sendDraft}
            onPreviewStrategicPlan={previewStrategicPlan}
            onFinalizeStrategicGoal={finalizeStrategicGoal}
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
}) {
  const [draftMessage, setDraftMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [props.messages]);

  return (
    <aside className="conductor-pane">
      <header className="conductor-header">
        <div className="conductor-title">
          <div className="assistant-mark">
            <Bot size={21} />
          </div>
          <div>
            <p className="eyebrow">The Conductor</p>
            <h2>Strategic operator</h2>
          </div>
        </div>
        <button className="icon-button" onClick={props.onLogout} title="Log out" type="button">
          <UserRound size={18} />
        </button>
      </header>

      <div className="account-chip">{props.userEmail}</div>

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
    </aside>
  );
}

function WorkspaceTopBar(props: {
  workspace: WorkspaceState | null;
  subscription: SubscriptionSummary | null;
  usage: UsageSummary | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const velocity = props.workspace?.velocity ?? emptyVelocity;
  const aiUsage = props.usage?.usage?.find((item) => item.featureKey === 'ai_requests');

  return (
    <header className="workspace-topbar">
      <div>
        <p className="eyebrow">Active Workspace</p>
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
        <button className="icon-button" onClick={props.onRefresh} title="Refresh workspace" type="button">
          {props.isLoading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
        </button>
      </div>
    </header>
  );
}

function ActiveWorkspace(props: {
  workspace: WorkspaceState | null;
  draft: OutreachDraft | null;
  pendingStrategicSessionId: string | null;
  strategicPreview: StrategicPlanResult | null;
  isWorking: boolean;
  onCommand: (body: Record<string, unknown>, success: string) => Promise<void>;
  onGenerateDraft: () => Promise<void>;
  onDraftChange: (draft: OutreachDraft) => void;
  onSendDraft: () => Promise<void>;
  onPreviewStrategicPlan: () => Promise<void>;
  onFinalizeStrategicGoal: () => Promise<void>;
}) {
  const mode = props.draft ? 'draft_edit' : props.pendingStrategicSessionId ? 'goal_planning' : props.workspace?.activeWorkspace.mode ?? 'empty';
  const cycle = props.workspace?.activeCycle ?? null;
  const recommendation = props.workspace?.recommendation ?? null;

  return (
    <section className="active-workspace">
      <div className="workspace-mode-header">
        <div>
          <p className="label">Workspace mode</p>
          <h2>{modeLabel(mode)}</h2>
        </div>
        <StatusBadge label={cycle?.phase ?? recommendation?.type ?? 'ready'} />
      </div>

      {mode === 'empty' ? (
        <EmptyWorkspace />
      ) : null}

      {mode === 'signal_review' ? (
        <SignalReview cycle={cycle} recommendation={recommendation} onGenerateDraft={props.onGenerateDraft} />
      ) : null}

      {mode === 'opportunity_review' || mode === 'execution_confirm' || mode === 'progress_summary' ? (
        <CycleWorkspace
          cycle={cycle}
          recommendation={recommendation}
          isWorking={props.isWorking}
          onCommand={props.onCommand}
          onGenerateDraft={props.onGenerateDraft}
        />
      ) : null}

      {mode === 'goal_planning' || mode === 'campaign_review' || mode === 'asset_review' ? (
        props.pendingStrategicSessionId ? (
          <StrategicPlanWorkspace
            preview={props.strategicPreview}
            isWorking={props.isWorking}
            onPreview={props.onPreviewStrategicPlan}
            onFinalize={props.onFinalizeStrategicGoal}
          />
        ) : (
          <PlanningWorkspace cycle={cycle} recommendation={recommendation} />
        )
      ) : null}

      {mode === 'draft_edit' && props.draft ? (
        <DraftWorkspace
          draft={props.draft}
          isWorking={props.isWorking}
          onChange={props.onDraftChange}
          onSend={props.onSendDraft}
        />
      ) : null}
    </section>
  );
}

function StrategicPlanWorkspace(props: {
  preview: StrategicPlanResult | null;
  isWorking: boolean;
  onPreview: () => Promise<void>;
  onFinalize: () => Promise<void>;
}) {
  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">Proposed strategy</p>
        <h3>{props.preview?.goal.title ?? 'Goal proposal is ready'}</h3>
        <p>
          {props.preview?.goal.description ??
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
            <p className="label">First cycle</p>
            <h3>{props.preview.extractedIntent.firstCycleTitle}</h3>
            <ol className="cycle-list">
              {props.preview.extractedIntent.firstCycleSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
          <article className="surface-card wide">
            <p className="label">First draft prompt</p>
            <p>{props.preview.extractedIntent.firstDraftPrompt}</p>
          </article>
        </div>
      ) : null}

      <div className="action-grid">
        <button className="secondary-button" disabled={props.isWorking} onClick={() => void props.onPreview()} type="button">
          {props.isWorking ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
          Preview plan
        </button>
        <button className="primary-button" disabled={props.isWorking} onClick={() => void props.onFinalize()} type="button">
          {props.isWorking ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
          Confirm goal
        </button>
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

function SignalReview(props: {
  cycle: WorkspaceState['activeCycle'];
  recommendation: WorkspaceState['recommendation'];
  onGenerateDraft: () => Promise<void>;
}) {
  const title = props.cycle?.title ?? props.recommendation?.title ?? 'Review the surfaced signal';
  const detail = props.cycle?.whyItMatters ?? props.recommendation?.aiExplanation ?? props.recommendation?.reason;

  return (
    <div className="execution-surface">
      <div className="surface-card priority">
        <p className="label">Why it matters</p>
        <h3>{title}</h3>
        <p>{detail ?? 'The system has surfaced this item as the next useful signal to evaluate.'}</p>
      </div>
      <button className="primary-button" onClick={() => void props.onGenerateDraft()} type="button">
        <Mail size={16} />
        Generate outreach draft
      </button>
    </div>
  );
}

function CycleWorkspace(props: {
  cycle: WorkspaceState['activeCycle'];
  recommendation: WorkspaceState['recommendation'];
  isWorking: boolean;
  onCommand: (body: Record<string, unknown>, success: string) => Promise<void>;
  onGenerateDraft: () => Promise<void>;
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

      <div className="cycle-steps">
        {['surfaced', 'pursued', 'executed', 'confirmed'].map((step, index) => (
          <div key={step} className={stepClass(cycle?.phase, step, index)}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </div>
        ))}
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

function DraftWorkspace(props: {
  draft: OutreachDraft;
  isWorking: boolean;
  onChange: (draft: OutreachDraft) => void;
  onSend: () => Promise<void>;
}) {
  const primaryRecipient = props.draft.recipients[0];

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

      <label>
        Subject
        <input
          value={props.draft.subject}
          onChange={(event) => props.onChange({ ...props.draft, subject: event.target.value })}
        />
      </label>

      <label>
        Body
        <textarea
          rows={14}
          value={props.draft.body}
          onChange={(event) => props.onChange({ ...props.draft, body: event.target.value })}
        />
      </label>

      <div className="draft-actions">
        <button className="primary-button" disabled={props.isWorking} onClick={() => void props.onSend()} type="button">
          {props.isWorking ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          Send outreach
        </button>
      </div>
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
            <h3>{signal.title}</h3>
            <p>{signal.summary ?? signal.reason ?? signal.recommendedAction}</p>
            <div className="signal-actions">
              <button disabled={props.isWorking} onClick={() => props.onActivate(signal)} type="button">
                Activate
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

function modeLabel(mode: WorkspaceMode) {
  return mode.replaceAll('_', ' ');
}

function formatRemaining(item: { remaining?: number | null } | undefined) {
  if (!item) return 'Usage ready';
  if (item.remaining === null || item.remaining === undefined) return 'Unlimited AI';
  return `${item.remaining} AI left`;
}

function stepClass(phase: string | undefined, step: string, index: number) {
  const phaseText = phase ?? '';
  const active =
    phaseText.includes(step) ||
    (phaseText === 'proposed' && index === 0) ||
    (phaseText === 'executed' && index <= 2) ||
    (phaseText === 'completed' && index <= 3);
  return `cycle-step ${active ? 'active' : ''}`;
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
