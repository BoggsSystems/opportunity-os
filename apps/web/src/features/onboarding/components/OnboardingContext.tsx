import React, { createContext, useContext, useState, useRef, useEffect, useCallback, memo } from 'react';
import { ApiClient } from '../../../lib/api';
import { importWebSocketService, ImportEvent } from '../../connections/services/importWebSocket.service';
import { MOCK_IP_ASSETS, MOCK_SYNTHESIS, MOCK_OFFERINGS, MOCK_CAMPAIGNS } from '../../../lib/onboarding-mocks';

export type Step = 'briefing' | 'account' | 'intent' | 'relationships' | 'discovery-sensing' | 'discovery-synthesis' | 'knowledge' | 'campaigns' | 'analysis' | 'actionLanes' | 'connectivity' | 'channels' | 'activation' | 'workspaceIntro' | 'workspaceHandoff' | 'welcome';

export type OnboardingSnapshot = {
  version: 1;
  currentStep: Step;
  connectionCount: number;
  activeImportId: string | null;
  uploadedAssets: Array<{
    title: string;
    interpretation: string;
    summary: string;
    frameworks: string[];
  }>;
  comprehensiveSynthesis: string | null;
  selectedLanes: string[];
  wizardMessages: any[];
  strategicDraft: any;
  proposedOfferings: any[];
  proposedCampaigns: any[];
  selectedCampaigns: string[];
  proposedActionLanes: any[];
  selectedActionLanes: string[];
  currentActionLaneCampaignIndex: number;
  connectedProviders: string[];
};

export interface OnboardingContextType {
  // State
  currentStep: Step;
  setCurrentStep: (step: Step) => void;
  connectionCount: number;
  activeImportId: string | null;
  uploadedAssets: any[];
  comprehensiveSynthesis: string | null;
  selectedLanes: string[];
  wizardMessages: any[];
  strategicDraft: any;
  proposedOfferings: any[];
  proposedCampaigns: any[];
  selectedCampaigns: string[];
  proposedActionLanes: any[];
  selectedActionLanes: string[];
  currentActionLaneCampaignIndex: number;
  connectedProviders: string[];
  providerStatuses: Record<string, any>;
  sensingLogs: any[];
  isSensingActive: boolean;
  spotlightData: any[];
  spotlightIndex: number;
  googleSubStep: 'drive' | 'gmail' | null;
  discoveryCalibration: Record<string, string>;
  isLoading: boolean;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  isConductorThinking: boolean;
  generationMessage: string | null;
  onComplete: () => void;
  isWorking: boolean;
  isConductorExpanded: boolean;

  // Actions
  nextStep: (step: Step) => void;
  triggerStepNarration: (step: Step) => Promise<void>;
  handleDiscoveryNext: () => Promise<void>;
  startSequentialSensing: () => Promise<void>;
  designActionLanes: () => Promise<void>;
  handleConductorSend: (text: string) => Promise<void>;
  seedState: () => void;
  
  // Setters (for specific needs)
  setConnectedProviders: React.Dispatch<React.SetStateAction<string[]>>;
  setDiscoveryCalibration: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setUploadStatus: React.Dispatch<React.SetStateAction<'idle' | 'uploading' | 'success' | 'error'>>;
  setActiveImportId: React.Dispatch<React.SetStateAction<string | null>>;
  setWizardMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedCampaigns: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedActionLanes: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentActionLaneCampaignIndex: React.Dispatch<React.SetStateAction<number>>;
  setSpotlightIndex: React.Dispatch<React.SetStateAction<number>>;
  setGoogleSubStep: React.Dispatch<React.SetStateAction<'drive' | 'gmail' | null>>;
  setSelectedLanes: React.Dispatch<React.SetStateAction<string[]>>;
  setIsConductorExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Handlers
  onAuth?: ((mode: 'login' | 'signup', email: string, password: string, fullName?: string, initialStrategy?: any) => Promise<void>) | undefined;
  onConnectOutlook?: (() => Promise<void>) | undefined;
  onConnectGmail?: (() => Promise<void>) | undefined;
  onConnectLinkedIn?: (() => Promise<void>) | undefined;
  onConnectHubSpot?: ((token: string) => Promise<void>) | undefined;
  onConnectShopify?: ((storeName: string, token: string) => Promise<void>) | undefined;
  onConnectSalesforce?: ((token: string) => Promise<void>) | undefined;
  onSyncEmail?: (() => Promise<void>) | undefined;
  
  // Utils
  api: ApiClient;
  user: any;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return context;
};

const getOnboardingStorageKey = (userId?: string) => `opportunity-os:onboarding-draft:${userId || 'guest'}`;

const loadOnboardingSnapshot = (userId?: string): OnboardingSnapshot | null => {
  try {
    const raw = localStorage.getItem(getOnboardingStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingSnapshot;
    return parsed?.version === 1 && parsed.currentStep ? parsed : null;
  } catch {
    return null;
  }
};

interface OnboardingProviderProps {
  children: React.ReactNode;
  api: ApiClient;
  user?: any;
  onAuth?: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, initialStrategy?: any) => Promise<void>;
  onConnectOutlook?: () => Promise<void>;
  onConnectGmail?: () => Promise<void>;
  onConnectLinkedIn?: () => Promise<void>;
  onConnectHubSpot?: (token: string) => Promise<void>;
  onConnectShopify?: (storeName: string, token: string) => Promise<void>;
  onConnectSalesforce?: (token: string) => Promise<void>;
  onSyncEmail?: () => Promise<void>;
  onComplete: () => void;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ 
  children, api, user,
  onAuth, onConnectOutlook, onConnectGmail, onConnectLinkedIn,
  onConnectHubSpot, onConnectShopify, onConnectSalesforce, onSyncEmail,
  onComplete
}) => {
  const restoredSnapshot = useRef<OnboardingSnapshot | null>(loadOnboardingSnapshot(user?.id)).current;

  // --- State Initialization ---
  const [currentStep, setCurrentStep] = useState<Step>(restoredSnapshot?.currentStep ?? 'briefing');
  const [connectionCount, setConnectionCount] = useState(restoredSnapshot?.connectionCount ?? 0);
  const [activeImportId, setActiveImportId] = useState<string | null>(restoredSnapshot?.activeImportId ?? null);
  const [uploadedAssets, setUploadedAssets] = useState<any[]>(restoredSnapshot?.uploadedAssets ?? []);
  const [comprehensiveSynthesis, setComprehensiveSynthesis] = useState<string | null>(restoredSnapshot?.comprehensiveSynthesis ?? null);
  const [selectedLanes, setSelectedLanes] = useState<string[]>(restoredSnapshot?.selectedLanes ?? []);
  const [wizardMessages, setWizardMessages] = useState<any[]>(restoredSnapshot?.wizardMessages ?? []);
  const [strategicDraft, setStrategicDraft] = useState<any>(restoredSnapshot?.strategicDraft ?? null);
  const [proposedOfferings, setProposedOfferings] = useState<any[]>(restoredSnapshot?.proposedOfferings ?? []);
  const [proposedCampaigns, setProposedCampaigns] = useState<any[]>(restoredSnapshot?.proposedCampaigns ?? []);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(restoredSnapshot?.selectedCampaigns ?? []);
  const [proposedActionLanes, setProposedActionLanes] = useState<any[]>(restoredSnapshot?.proposedActionLanes ?? []);
  const [selectedActionLanes, setSelectedActionLanes] = useState<string[]>(restoredSnapshot?.selectedActionLanes ?? []);
  const [currentActionLaneCampaignIndex, setCurrentActionLaneCampaignIndex] = useState(restoredSnapshot?.currentActionLaneCampaignIndex ?? 0);
  const [connectedProviders, setConnectedProviders] = useState<string[]>(restoredSnapshot?.connectedProviders ?? []);

  const [providerStatuses, setProviderStatuses] = useState<Record<string, any>>({});
  const [sensingLogs, setSensingLogs] = useState<any[]>([]);
  const [isSensingActive, setIsSensingActive] = useState(false);
  const [spotlightData, setSpotlightData] = useState<any[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [googleSubStep, setGoogleSubStep] = useState<'drive' | 'gmail' | null>(null);
  const [discoveryCalibration, setDiscoveryCalibration] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [isConductorThinking, setIsConductorThinking] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [isConductorExpanded, setIsConductorExpanded] = useState(false);
  const isWorking = isLoading; // Alias for compatibility

  const [guestSessionId] = useState(() => crypto.randomUUID());

  // --- Sync with Real Connectors ---
  useEffect(() => {
    if (user?.id) {
      api.getWorkspace().then(ws => {
        // Assuming workspace or another endpoint has connectors. 
        // Actually, let's use listConnectors if available or just check emailReadiness
        api.get<any[]>('/connectors').then(connectors => {
          if (Array.isArray(connectors)) {
            const active = connectors
              .filter(c => c.status === 'connected' || c.status === 'syncing')
              .map(c => {
                const name = c.providerName;
                if (name === 'google_oauth' || name === 'gmail' || name === 'google_calendar') return 'google';
                if (name === 'microsoft' || name === 'outlook') return 'microsoft';
                return name;
              });
            
            setConnectedProviders(prev => {
              const next = new Set([...prev, ...active]);
              return Array.from(next);
            });

            const statuses: Record<string, any> = {};
            connectors.forEach(c => {
              const name = c.providerName;
              let id = name;
              if (name === 'google_oauth' || name === 'gmail' || name === 'google_calendar') id = 'google';
              else if (name === 'microsoft' || name === 'outlook') id = 'microsoft';
              
              if (c.status === 'connected') {
                statuses[id] = { status: 'completed', result: 'Verified' };
              } else if (c.status === 'syncing') {
                statuses[id] = { status: 'syncing', message: 'Sensing...' };
              }
            });
            setProviderStatuses(prev => ({ ...prev, ...statuses }));
          }
        }).catch(() => null);
      }).catch(() => null);
    }
  }, [user?.id, api]);

  // --- Persistence ---
  useEffect(() => {
    if (currentStep === 'welcome') return;
    const snapshot: OnboardingSnapshot = {
      version: 1,
      currentStep,
      connectionCount,
      activeImportId,
      uploadedAssets,
      comprehensiveSynthesis,
      selectedLanes,
      wizardMessages,
      strategicDraft,
      proposedOfferings,
      proposedCampaigns,
      selectedCampaigns,
      proposedActionLanes,
      selectedActionLanes,
      currentActionLaneCampaignIndex,
      connectedProviders,
    };
    localStorage.setItem(getOnboardingStorageKey(user?.id), JSON.stringify(snapshot));
  }, [user?.id, currentStep, connectionCount, activeImportId, uploadedAssets, comprehensiveSynthesis, selectedLanes, wizardMessages, strategicDraft, proposedOfferings, proposedCampaigns, selectedCampaigns, proposedActionLanes, selectedActionLanes, currentActionLaneCampaignIndex, connectedProviders]);

  // --- Logic ---
  const nextStep = useCallback((step: Step) => {
    setUploadStatus('idle');
    setGenerationMessage(null);
    setCurrentStep(step);
    window.scrollTo(0, 0);
  }, []);

  const triggerStepNarration = async (step: Step) => {
    setIsConductorThinking(true);
    const narrationHeader = "[SYSTEM: NARRATION MODE - DO NOT ask for goal confirmation. DO NOT ask 'is this the objective?'. The objective is already set. Provide strategic commentary and next-step instructions only.]";
    
    let systemPrompt = "";
    if (step === 'relationships') {
      systemPrompt = `${narrationHeader} Welcome to the Orchestration flow. Explain that we need their LinkedIn ZIP (Settings > Data Privacy) to map professional leverage and identify warm entry points. Ask them to drop the ZIP.`;
    } else if (step === 'knowledge') {
      systemPrompt = `${narrationHeader} Network sensing complete. We've identified ${connectionCount || 'their'} professional nodes. Now moving to 'Expertise Grounding'. Ask them to provide strategic assets (PDFs, decks) to sharpen the outreach frameworks.`;
    } else if (step === 'intent') {
      setIsLoading(true);
      setGenerationMessage('Generating revenue lanes from your network and expertise...');
      setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: "Analyzing your network topography and IP frameworks to generate proposed Revenue Lanes..." }]);
      
      setTimeout(async () => {
        try {
          const res = await api.proposeOfferings({
            networkCount: connectionCount || strategicDraft?.connectionCount || 14640,
            networkPosture: strategicDraft?.posture?.text || '',
            frameworks: uploadedAssets.flatMap(a => a.frameworks) || [],
            interpretation: comprehensiveSynthesis || uploadedAssets.map(a => a.interpretation).join('\n\n') || ''
          });
          if (res.success && res.offerings?.length) {
            setProposedOfferings(res.offerings);
            setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: "I have analyzed your data and proposed the following Revenue Lanes. Which ones should we focus on? Feel free to chat with me below if you'd like to refine or pivot these directions." }]);
          }
        } finally {
          setIsLoading(false);
          setGenerationMessage(null);
        }
      }, 50);
      return;
    } else if (step === 'account' && !user) {
      setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: "Your strategy is ready to activate. Create a workspace account now so I can save this plan, attach connectors to the right owner, and continue into execution setup." }]);
    }

    if (systemPrompt) {
      const response = await api.converse({
        message: systemPrompt,
        ...(!user ? { guestSessionId } : {}),
        context: { currentStep: step, strategicDraft, connectionCount, selectedMission: selectedLanes.join(', ') }
      });
      setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: response.reply }]);
    }
    setIsConductorThinking(false);
  };

  // --- Narration and Auto-Advance ---
  useEffect(() => {
    if (currentStep === 'account' && user) {
      nextStep('relationships');
    }
  }, [currentStep, user, nextStep]);

  useEffect(() => {
    if (currentStep !== 'welcome' && currentStep !== 'briefing' && currentStep !== 'account' && currentStep !== 'discovery-synthesis') {
      void triggerStepNarration(currentStep);
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 'briefing' && wizardMessages.length === 0) {
      setWizardMessages([{ 
        role: 'assistant', 
        text: "System initialized. I am your Conductor. I synthesize your network and expertise into high-velocity opportunity. Let's begin by sensing your current professional posture." 
      }]);
    }
  }, [currentStep, wizardMessages.length]);

  const handleDiscoveryNext = async () => {
    if (currentStep === 'discovery-sensing') {
      if (spotlightIndex < spotlightData.length - 1) {
        const nextIdx = spotlightIndex + 1;
        setSpotlightIndex(nextIdx);
        const nextProvider = spotlightData[nextIdx];
        if (nextProvider.id === 'google') {
          setGoogleSubStep('drive');
          setWizardMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "Entering your Google ecosystem. Let's start with your Google Drive. I'm looking for assets that define your expertise." }]);
        } else {
          setWizardMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: nextProvider.conductorSpeech }]);
        }
      } else {
        setIsLoading(true);
        setGenerationMessage('Fusing discovery signals into your global strategic map...');
        setTimeout(() => {
          setIsLoading(false);
          setGenerationMessage(null);
          setCurrentStep('discovery-synthesis' as any);
        }, 2500);
      }
    } else if (currentStep === 'discovery-synthesis') {
      nextStep('knowledge');
    }
  };

  const startSequentialSensing = async () => {
    setIsSensingActive(true);
    setSensingLogs([]);
    const selectedIds = connectedProviders;

    for (const id of selectedIds) {
      const provider = { linkedin: 'LinkedIn', google: 'Google', microsoft: 'Outlook' }[id as 'linkedin' | 'google' | 'microsoft'];
      setProviderStatuses(prev => ({ ...prev, [id]: { status: 'syncing', message: 'Sensing network topography...' } }));
      setSensingLogs(prev => [...prev, { id: `log-${id}`, message: `Scanning ${provider} for relationship depth...`, type: 'info' }]);
      await new Promise(r => setTimeout(r, 1500));
      setProviderStatuses(prev => ({ ...prev, [id]: { status: 'completed', result: 'Verified' } }));
      setSensingLogs(prev => [...prev, { id: `success-${id}`, message: `${provider} sensing complete.`, type: 'success' }]);
    }

    const spotlights = connectedProviders.map(id => ({
      id,
      name: { linkedin: 'LinkedIn', google: 'Gmail', microsoft: 'Outlook' }[id as 'linkedin' | 'google' | 'microsoft'],
      metric: id === 'linkedin' ? '12,400' : '1,842',
      metricLabel: id === 'linkedin' ? 'Connections' : 'Nodes',
      insight: 'High-density professional topography detected.',
      conductorSpeech: `Analysis complete. I have mapped your ${id} ecosystem.`
    }));

    setSpotlightData(spotlights);
    setSpotlightIndex(0);
    setIsSensingActive(false);
    
    setTimeout(() => {
      const firstSpotlight = spotlights[0];
      if (firstSpotlight) {
        setWizardMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: firstSpotlight.conductorSpeech }]);
      }
    }, 1000);
  };

  const designActionLanes = async () => {
    setIsLoading(true);
    setGenerationMessage('Designing tactical execution lanes...');
    try {
      const res = await api.proposeActionLanes({
        selectedCampaigns: proposedCampaigns.filter(c => selectedCampaigns.includes(c.id)),
        comprehensiveSynthesis: comprehensiveSynthesis || ''
      });
      if (res.success) {
        setProposedActionLanes(res.actionLanes);
        setSelectedActionLanes(res.actionLanes.map((l: any) => l.id));
        setCurrentActionLaneCampaignIndex(0);
        setCurrentStep('actionLanes');
      }
    } finally {
      setIsLoading(false);
      setGenerationMessage(null);
    }
  };

  const handleConductorSend = async (text: string) => {
    const userMsg = { id: crypto.randomUUID(), role: 'user', text };
    setWizardMessages(prev => [...prev, userMsg]);
    setIsConductorThinking(true);
    try {
      const response = await api.converse({
        message: text,
        ...(!user ? { guestSessionId } : {}),
        context: { currentStep, strategicDraft }
      });
      setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: response.reply }]);
      if (response.onboardingPlan) setStrategicDraft(response.onboardingPlan);
    } finally {
      setIsConductorThinking(false);
    }
  };

  const seedState = () => {
    setUploadedAssets(MOCK_IP_ASSETS.map(a => ({ title: a.name, interpretation: a.type, summary: a.name, frameworks: [] })));
    setComprehensiveSynthesis(MOCK_SYNTHESIS);
    setProposedOfferings(MOCK_OFFERINGS);
    setSelectedLanes(MOCK_OFFERINGS.map(o => o.id));
    setProposedCampaigns(MOCK_CAMPAIGNS);
    setSelectedCampaigns(MOCK_CAMPAIGNS[0] ? [MOCK_CAMPAIGNS[0].id] : []);
    setCurrentStep('intent');
  };

  const value: OnboardingContextType = {
    currentStep, setCurrentStep, connectionCount, activeImportId, uploadedAssets, comprehensiveSynthesis,
    selectedLanes, wizardMessages, strategicDraft, proposedOfferings, proposedCampaigns, selectedCampaigns,
    proposedActionLanes, selectedActionLanes, currentActionLaneCampaignIndex, connectedProviders,
    providerStatuses, sensingLogs, isSensingActive, spotlightData, spotlightIndex, googleSubStep,
    discoveryCalibration, isLoading, uploadStatus, isConductorThinking, generationMessage,
    nextStep, triggerStepNarration, handleDiscoveryNext, startSequentialSensing, designActionLanes,
    handleConductorSend, seedState, setConnectedProviders, setDiscoveryCalibration, setUploadStatus,
    setActiveImportId, setWizardMessages, setSelectedCampaigns, setSelectedActionLanes,
    setCurrentActionLaneCampaignIndex, setSpotlightIndex, setGoogleSubStep, api, user,
    onComplete, setSelectedLanes, isWorking, isConductorExpanded, setIsConductorExpanded,
    onConnectLinkedIn: onConnectLinkedIn ? async () => {
      await onConnectLinkedIn();
      setConnectedProviders(prev => prev.includes('linkedin') ? prev : [...prev, 'linkedin']);
    } : undefined,
    onConnectGmail: onConnectGmail ? async () => {
      await onConnectGmail();
      setConnectedProviders(prev => prev.includes('google') ? prev : [...prev, 'google']);
    } : undefined,
    onConnectOutlook: onConnectOutlook ? async () => {
      await onConnectOutlook();
      setConnectedProviders(prev => prev.includes('microsoft') ? prev : [...prev, 'microsoft']);
    } : undefined,
    onConnectHubSpot: onConnectHubSpot ? async (token: string) => {
      await onConnectHubSpot(token);
      setConnectedProviders(prev => prev.includes('hubspot') ? prev : [...prev, 'hubspot']);
    } : undefined,
    onConnectShopify: onConnectShopify ? async (store: string, token: string) => {
      await onConnectShopify(store, token);
      setConnectedProviders(prev => prev.includes('shopify') ? prev : [...prev, 'shopify']);
    } : undefined,
    onConnectSalesforce: onConnectSalesforce ? async (token: string) => {
      await onConnectSalesforce(token);
      setConnectedProviders(prev => prev.includes('salesforce') ? prev : [...prev, 'salesforce']);
    } : undefined,
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};
