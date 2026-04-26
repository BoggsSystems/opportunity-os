import { useState } from 'react';
import { ApiClient } from '../lib/api';
import type { OutreachDraft, WorkspaceState } from '../types';

interface Notice {
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface UseOutreachReturn {
  draft: OutreachDraft | null;
  outreachExecutionState: 'idle' | 'blocked' | 'sent';
  isWorking: boolean;
  generateDraft: () => Promise<void>;
  generateDraftForOpportunity: (opportunityId: string, kind?: 'initial' | 'follow_up') => Promise<void>;
  sendDraft: () => Promise<void>;
  setDraft: (draft: OutreachDraft | null) => void;
  setOutreachExecutionState: (state: 'idle' | 'blocked' | 'sent') => void;
}

export const useOutreach = (
  api: ApiClient,
  workspace: WorkspaceState | null,
  setNotice: (notice: Notice | null) => void
): UseOutreachReturn => {
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [outreachExecutionState, setOutreachExecutionState] = useState<'idle' | 'blocked' | 'sent'>('idle');
  const [isWorking, setIsWorking] = useState(false);

  const generateDraft = async () => {
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
    } catch (error) {
      setNotice({
        title: 'Draft failed',
        detail: error instanceof Error ? error.message : 'The backend could not create a draft.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const generateDraftForOpportunity = async (opportunityId: string, kind: 'initial' | 'follow_up' = 'initial') => {
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
    } catch (error) {
      setNotice({
        title: 'Draft failed',
        detail: error instanceof Error ? error.message : 'The backend could not create a draft.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const sendDraft = async () => {
    if (!draft) return;
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.sendDraft(draft);
      if ('blocked' in result && result.blocked) {
        setOutreachExecutionState('blocked');
        setNotice({
          title: 'Send blocked',
          detail: result.upgradeHint ?? result.upgradeReason ?? 'Email send is not available on the current plan.',
          tone: 'warning',
        });
        return;
      }
      setOutreachExecutionState('sent');
      setNotice({ title: 'Email recorded', detail: 'The outreach activity was linked back to the opportunity.', tone: 'success' });
    } catch (error) {
      const blocked = error instanceof Error && error.message.includes('402');
      if (blocked) {
        setOutreachExecutionState('blocked');
      }
      setNotice({
        title: blocked ? 'Send blocked' : 'Send failed',
        detail: error instanceof Error ? error.message : 'The email could not be sent.',
        tone: blocked ? 'warning' : 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  return {
    draft,
    outreachExecutionState,
    isWorking,
    generateDraft,
    generateDraftForOpportunity,
    sendDraft,
    setDraft,
    setOutreachExecutionState,
  };
};
