import type {
  AuthResponse,
  CapabilityCheckResult,
  OutreachDraft,
  StrategicPlanResult,
  SubscriptionSummary,
  UsageSummary,
  WorkspaceState,
} from '../types';

const API_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3002';

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
    this.accessToken = accessToken;
  }

  setAccessToken(accessToken: string | null) {
    this.accessToken = accessToken;
  }

  get baseUrl() {
    return API_URL;
  }

  async signup(input: { email: string; password: string; fullName?: string; timezone?: string }) {
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

  async getWorkspace() {
    return this.request<WorkspaceState>('/workspace');
  }

  async executeWorkspaceCommand(body: Record<string, unknown>) {
    return this.request<unknown>('/workspace/commands', {
      method: 'POST',
      body,
    });
  }

  async converse(body: { sessionId?: string; message: string; context?: Record<string, unknown> }) {
    return this.request<{
      success: boolean;
      sessionId: string;
      reply: string;
      suggestedAction?: string;
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

  async getSubscription() {
    return this.request<SubscriptionSummary>('/me/subscription');
  }

  async getUsage() {
    return this.request<UsageSummary>('/me/usage');
  }

  async checkCapability(featureKey: string) {
    return this.request<CapabilityCheckResult>(`/me/capabilities/${encodeURIComponent(featureKey)}/check`);
  }

  async generateDraft(opportunityId: string) {
    return this.request<OutreachDraft>(`/outreach/draft/${encodeURIComponent(opportunityId)}`);
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

    return this.request<
      | { success: true; activity: unknown; opportunity: unknown }
      | ({ success: false; blocked: true } & CapabilityCheckResult)
    >('/outreach/send', {
      method: 'POST',
      body,
    });
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      authenticated?: boolean;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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

    const response = await fetch(`${API_URL}${path}`, requestInit);

    const text = await response.text();
    const payload = text ? parseJson(text) : null;

    if (!response.ok) {
      throw new ApiError(response.status, payload);
    }

    return payload as T;
  }
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
