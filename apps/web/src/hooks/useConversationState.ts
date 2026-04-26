import { useState } from 'react';
import type { ConversationMessage, StrategicPlanResult } from '../types';

interface UseConversationStateReturn {
  messages: ConversationMessage[];
  draft: any;
  outreachExecutionState: 'idle' | 'blocked' | 'sent';
  activeConversationId: string | null;
  pendingStrategicSessionId: string | null;
  strategicPreview: StrategicPlanResult | null;
  campaignFeedback: StrategicPlanResult | null;
  
  // Setters
  setMessages: (messages: ConversationMessage[]) => void;
  setDraft: (draft: any) => void;
  setOutreachExecutionState: (state: 'idle' | 'blocked' | 'sent') => void;
  setActiveConversationId: (id: string | null) => void;
  setPendingStrategicSessionId: (id: string | null) => void;
  setStrategicPreview: (preview: StrategicPlanResult | null) => void;
  setCampaignFeedback: (feedback: StrategicPlanResult | null) => void;
}

export const useConversationState = (): UseConversationStateReturn => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [outreachExecutionState, setOutreachExecutionState] = useState<'idle' | 'blocked' | 'sent'>('idle');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingStrategicSessionId, setPendingStrategicSessionId] = useState<string | null>(null);
  const [strategicPreview, setStrategicPreview] = useState<StrategicPlanResult | null>(null);
  const [campaignFeedback, setCampaignFeedback] = useState<StrategicPlanResult | null>(null);

  return {
    messages,
    draft,
    outreachExecutionState,
    activeConversationId,
    pendingStrategicSessionId,
    strategicPreview,
    campaignFeedback,
    
    setMessages,
    setDraft,
    setOutreachExecutionState,
    setActiveConversationId,
    setPendingStrategicSessionId,
    setStrategicPreview,
    setCampaignFeedback,
  };
};
