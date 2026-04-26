import { useCallback, useMemo } from 'react';
import { ApiClient } from '../lib/api';
import type { 
  WorkspaceState, 
  CampaignWorkspace, 
  SubscriptionSummary, 
  UsageSummary, 
  CommercialState, 
  PlanSummary,
  EmailReadiness,
  ConversationMessage,
  AuthResponse 
} from '../types';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthResponse['user'];
}

interface UseWorkspaceReturn {
  workspace: WorkspaceState | null;
  campaignWorkspace: CampaignWorkspace | null;
  subscription: SubscriptionSummary | null;
  usage: UsageSummary | null;
  commercialState: CommercialState | null;
  plans: PlanSummary[];
  emailReadiness: EmailReadiness | null;
  messages: ConversationMessage[];
  isBooting: boolean;
  loadWorkspace: () => Promise<void>;
  runCommand: (body: Record<string, unknown>, success: string) => Promise<void>;
}

export const useWorkspace = (session: StoredSession | null): UseWorkspaceReturn => {
  const api = useMemo(() => new ApiClient(session?.accessToken ?? null), [session?.accessToken]);
  
  // State would be managed internally - for now, return placeholder values
  // In a real implementation, these would be useState hooks
  const workspace = null;
  const campaignWorkspace = null;
  const subscription = null;
  const usage = null;
  const commercialState = null;
  const plans: PlanSummary[] = [];
  const emailReadiness = null;
  const messages: ConversationMessage[] = [];
  const isBooting = false;

  const loadWorkspace = useCallback(async () => {
    if (!session) return;
    // Implementation would go here
    console.log('Loading workspace...');
  }, [session]);

  const runCommand = useCallback(async (body: Record<string, unknown>, success: string) => {
    try {
      await api.executeWorkspaceCommand(body);
      console.log(success);
      await loadWorkspace();
    } catch (error) {
      console.error('Command failed:', error);
      throw error;
    }
  }, [api, loadWorkspace]);

  return {
    workspace,
    campaignWorkspace,
    subscription,
    usage,
    commercialState,
    plans,
    emailReadiness,
    messages,
    isBooting,
    loadWorkspace,
    runCommand,
  };
};
