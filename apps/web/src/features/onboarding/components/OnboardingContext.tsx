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
  allConnectors: any[];
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
  storageSuggestions: any[];
  setStorageSuggestions: (suggestions: any[]) => void;
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  onComplete: () => void;
  isWorking: boolean;
  isConductorExpanded: boolean;
  ingestionStatus: {
    assetName?: string;
    step: string;
    percentage: number;
    message?: string;
  } | null;
  isIngestionModalOpen: boolean;
  ingestionBatchId: string | null;
  setIsIngestionModalOpen: (open: boolean) => void;

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
  onConnectGoogle?: (() => Promise<void>) | undefined;
  onConnectLinkedIn?: (() => Promise<void>) | undefined;
  onConnectHubSpot?: ((token: string) => Promise<void>) | undefined;
  onConnectShopify?: ((storeName: string, token: string) => Promise<void>) | undefined;
  onConnectSalesforce?: ((token: string) => Promise<void>) | undefined;
  onSyncEmail?: (() => Promise<void>) | undefined;
  handleStorageSearch: (query: string) => Promise<void>;
  handleImportAssets: () => Promise<void>;
  triggerStorageScan: (folderId?: string) => Promise<void>;
  initiateProviderSensing: (providerId?: string) => Promise<void>;
  isImporting: boolean;
  
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
  onConnectGoogle?: () => Promise<void>;
  onConnectLinkedIn?: () => Promise<void>;
  onConnectHubSpot?: (token: string) => Promise<void>;
  onConnectShopify?: (storeName: string, token: string) => Promise<void>;
  onConnectSalesforce?: (token: string) => Promise<void>;
  onSyncEmail?: () => Promise<void>;
  onComplete: () => void;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ 
  children, api, user,
  onAuth, onConnectOutlook, onConnectGoogle, onConnectLinkedIn,
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
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [allConnectors, setAllConnectors] = useState<any[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, any>>({});
  const [sensingLogs, setSensingLogs] = useState<any[]>([]);
  const [isSensingActive, setIsSensingActive] = useState(false);
  const [spotlightData, setSpotlightData] = useState<any[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [storageSuggestions, setStorageSuggestions] = useState<any[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [googleSubStep, setGoogleSubStep] = useState<'drive' | 'gmail' | null>(null);
  const [discoveryCalibration, setDiscoveryCalibration] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [isConductorThinking, setIsConductorThinking] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [isConductorExpanded, setIsConductorExpanded] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [ingestionBatchId, setIngestionBatchId] = useState<string | null>(null);
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState<{
    assetName?: string;
    step: string;
    percentage: number;
    message?: string;
  } | null>(null);
  const isWorking = isLoading || isImporting; // Alias for compatibility

  const [guestSessionId] = useState(() => crypto.randomUUID());

  // --- Sync with Real Connectors ---
  useEffect(() => {
    console.log('🔄 OnboardingContext: User changed or mounted', user?.id);
    if (user?.id) {
      api.get<any[]>('/connectors').then(connectors => {
        console.log('📊 OnboardingContext: Fetched connectors:', connectors.length);
        if (Array.isArray(connectors)) {
          const active = connectors
            .filter(c => c.status === 'connected' || c.status === 'syncing')
            .map(c => {
              const name = c.providerName || c.capabilityProvider?.providerName || '';
              return name;
            });
          
          setAllConnectors(connectors);

          if (active.length > 0) {
            console.log('✅ OnboardingContext: Found active providers:', active);
            setConnectedProviders(prev => {
              const next = new Set([...prev, ...active]);
              return Array.from(next);
            });
          }

          const statuses: Record<string, any> = {};
          connectors.forEach(c => {
            const name = c.providerName || c.capabilityProvider?.providerName || '';
            let id = name;
            if (name === 'google_oauth' || name === 'gmail' || name === 'google_calendar' || name === 'google_drive') id = 'google';
            else if (name === 'microsoft' || name === 'outlook' || name === 'onedrive') id = 'microsoft';
            
            if (c.status === 'connected') {
              statuses[id] = { status: 'completed', result: 'Verified' };
            } else if (c.status === 'syncing') {
              statuses[id] = { status: 'syncing', message: 'Sensing...' };
            }
          });
          setProviderStatuses(prev => ({ ...prev, ...statuses }));
        }
      }).catch(err => {
        console.error('❌ OnboardingContext: Failed to fetch connectors:', err);
      });
    }
  }, [user, api]);

  // --- Ensure Spotlight Data exists even if sensing hasn't run ---
  useEffect(() => {
    if (connectedProviders.length > 0 && spotlightData.length === 0) {
      const spotlights = connectedProviders.map(id => ({
        id,
        name: { linkedin: 'LinkedIn', google: 'Google', microsoft: 'Outlook' }[id as 'linkedin' | 'google' | 'microsoft'] || id,
        metric: '0',
        metricLabel: id === 'linkedin' ? 'Connections' : 'Nodes',
        breakdown: [
          { label: id === 'linkedin' ? 'Connections' : 'Contacts', value: '0' },
          { label: 'Companies', value: '0' },
          { label: id === 'linkedin' ? 'Signals' : 'Threads', value: '0' }
        ],
        insight: 'Awaiting discovery sensing...',
        conductorSpeech: `Entering your ${id} ecosystem. Ready to begin calibration.`
      }));
      setSpotlightData(spotlights);
      
      if (spotlights[0]?.id === 'google' && !googleSubStep) {
        setGoogleSubStep('drive');
      }
    }
  }, [connectedProviders, spotlightData.length, googleSubStep]);
  
  // --- Ingestion WebSocket Listener ---
  useEffect(() => {
    if (ingestionBatchId) {
      console.log(`🔌 [Frontend] Subscribing to ingestion events for batch: ${ingestionBatchId}`);
      
      const handleEvent = (event: ImportEvent) => {
        console.log(`📊 [Frontend] Received event: ${event.type} for batch: ${(event as any).batchId || (event as any).importId}`);
        if (event.type === 'shredding-progress') {
          if (event.batchId === ingestionBatchId) {
            console.log(`✅ [Frontend] Updating progress: ${event.step} (${event.percentage}%)`);
            setIngestionStatus({
              assetName: event.assetName,
              step: event.step,
              percentage: event.percentage,
              message: event.message
            });
          }
        } else if (event.type === 'shredding-completed') {
          if (event.batchId === ingestionBatchId) {
            setIngestionStatus({
              step: 'Complete',
              percentage: 100,
              message: 'Strategic Analysis Finalized.'
            });
            // We don't close the modal automatically; user clicks a button
          }
        } else if (event.type === 'shredding-error') {
          if (event.batchId === ingestionBatchId) {
            setIngestionStatus({
              step: 'Error',
              percentage: 0,
              message: `Ingestion Failed: ${event.error?.message || 'Unknown error'}`
            });
          }
        }
      };

      importWebSocketService.subscribe(ingestionBatchId, handleEvent);
      return () => {
        importWebSocketService.unsubscribe(ingestionBatchId);
      };
    }
  }, [ingestionBatchId]);

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
      const currentSpotlight = spotlightData[spotlightIndex];
      
      // Handle Google Sub-steps (Drive -> Gmail)
      if (currentSpotlight?.id === 'google' && googleSubStep === 'drive') {
        // TRIGGER SHREDDING for selected assets before moving to Gmail
        if (selectedAssetIds.length > 0) {
          setIsLoading(true);
          setGenerationMessage('Director is shredding your strategic assets into the Vault...');
          try {
            // In a real scenario, we'd send the list of IDs to a bulk shredding endpoint
            // For now, we'll simulate the call or hit the shred endpoint if we had a single one
            await api.post('/intelligence/shred', { 
              assetIds: selectedAssetIds,
              sourceType: 'connector_asset',
              providerName: 'google_drive',
            });
          } catch (e) {
            console.warn('Shredding trigger failed, but continuing...', e);
          } finally {
            setIsLoading(false);
            setGenerationMessage(null);
          }
        }
        
        setGoogleSubStep('gmail');
        setWizardMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "Strategic assets captured. Now mapping your Gmail topography to identify key professional threads and relationships." }]);
        return;
      }

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

  const resolveStorageProvider = (providerId?: string) => {
    if (providerId === 'google' || providerId === 'google_drive') return 'google_drive';
    if (providerId === 'microsoft' || providerId === 'onedrive') return 'onedrive';
    return undefined;
  };

  const currentStorageProvider = () => {
    const currentProviderId = spotlightData[spotlightIndex]?.id;
    return resolveStorageProvider(currentProviderId);
  };

  const initiateProviderSensing = async (targetProviderId?: string) => {
    setIsSensingActive(true);
    setSensingLogs([]);
    const selectedIds = targetProviderId ? [targetProviderId] : connectedProviders;

    for (const id of selectedIds) {
      const provider = { linkedin: 'LinkedIn', google: 'Google', microsoft: 'Outlook' }[id as 'linkedin' | 'google' | 'microsoft'];
      setProviderStatuses(prev => ({ ...prev, [id]: { status: 'syncing', message: 'Sensing network topography...' } }));
      setSensingLogs(prev => [...prev, { id: `log-${id}`, message: `Scanning ${provider} for relationship depth...`, type: 'info' }]);
      
      // TRIGGER REAL SYNC
      // 1. Storage Sensing (The focus for Drive)
      try {
        if (id === 'google' || id === 'microsoft') {
          const providerKey = resolveStorageProvider(id);
          const assets = await api.listStorageAssets(providerKey);
          setStorageSuggestions(assets);
          setSelectedAssetIds(assets.map((s: any) => s.id));
          if (assets.length > 0) {
            setSensingLogs(prev => [...prev, { id: `suggestions-${id}`, message: `Conductor identified ${assets.length} strategic assets.`, type: 'info' }]);
          }
        }
      } catch (err: any) {
        console.error(`💾 Storage sensing failed for ${provider}:`, err);
        setSensingLogs(prev => [...prev, { id: `err-storage-${id}`, message: `Storage scan partial for ${provider}: ${err.message || 'Error'}`, type: 'error' }]);
      }

      setProviderStatuses(prev => ({ ...prev, [id]: { status: 'completed', result: 'Verified' } }));
      setSensingLogs(prev => [...prev, { id: `success-${id}`, message: `${provider} sensing complete.`, type: 'success' }]);
    }

    // Fetch real stats from the database
    let stats = { personCount: 0, companyCount: 0, threadCount: 0, totalNodes: 0 };
    try {
      const liveStats = await api.get<any>('/discovery/stats');
      if (liveStats && typeof liveStats.totalNodes === 'number') {
        stats = liveStats;
        console.log('📊 OnboardingContext: Live discovery stats fetched:', stats);
      }
    } catch (err) {
      console.warn('⚠️ OnboardingContext: Failed to fetch live stats:', err);
    }

    const PRIORITY: Record<string, number> = {
      'google_drive': 1,
      'gmail': 2,
      'linkedin': 3,
      'google_calendar': 4,
      'outlook': 5,
      'onedrive': 6
    };

    const sortedProviders = [...connectedProviders].sort((a, b) => {
      return (PRIORITY[a] || 99) - (PRIORITY[b] || 99);
    });

    const spotlights = sortedProviders.map(id => {
      const isLinkedIn = id === 'linkedin';
      const isDrive = id === 'google_drive';
      
      const nameMap: Record<string, string> = {
        linkedin: 'LinkedIn',
        gmail: 'Gmail',
        google_drive: 'Google Drive',
        google_calendar: 'Google Calendar',
        outlook: 'Outlook',
        onedrive: 'OneDrive'
      };

      return {
        id,
        name: nameMap[id] || id,
        metric: isDrive ? storageSuggestions.length.toLocaleString() : stats.totalNodes.toLocaleString(),
        metricLabel: isLinkedIn ? 'Connections' : isDrive ? 'Nodes' : 'Items',
        breakdown: [
          { label: isLinkedIn ? 'Connections' : isDrive ? 'Strategic Docs' : 'Contacts', value: isDrive ? storageSuggestions.length.toLocaleString() : stats.personCount.toLocaleString() },
          { label: 'Companies', value: stats.companyCount.toLocaleString() },
          { label: isLinkedIn ? 'Signals' : isDrive ? 'Assets' : 'Threads', value: isDrive ? '0' : stats.threadCount.toLocaleString() }
        ],
        insight: stats.totalNodes > 0 || storageSuggestions.length > 0
          ? `Detected a robust network topography with ${stats.personCount} strategic contacts. Ready to map relationship depth.` 
          : 'No significant topography detected yet. Proceeding with strategic intent.',
        conductorSpeech: stats.totalNodes > 0 || storageSuggestions.length > 0
          ? `Analysis complete. I have mapped your ${nameMap[id] || id} ecosystem and identified high-velocity entry points.`
          : `I've scanned your ${nameMap[id] || id} ecosystem. It appears to be a fresh canvas. We'll build your strategic map from the ground up.`
      };
    });

    setSpotlightData(spotlights);
    setSpotlightIndex(0);
    setIsSensingActive(false);

    // Initial introduction is handled by the useEffect below
  };

  // Auto-talk when spotlight moves or sequence starts
  useEffect(() => {
    if (currentStep === 'discovery-sensing' && spotlightData && spotlightData[spotlightIndex]) {
      const provider = spotlightData[spotlightIndex];
      const messageText = provider.conductorSpeech || `I'm ready to analyze your ${provider.name} ecosystem. Let's see what topography we can map here.`;
      
      // Check if we've already sent this message to avoid duplicates
      setWizardMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.text === messageText) return prev;
        return [...prev, { 
          id: crypto.randomUUID(), 
          role: 'assistant', 
          text: messageText 
        }];
      });
    }
  }, [spotlightIndex, currentStep, spotlightData]);

  const startSequentialSensing = async () => {
    await initiateProviderSensing();
  };

  const handleStorageSearch = async (query: string) => {
    const providerKey = currentStorageProvider();
    if (!query) {
      // Re-fetch default suggestions if query is empty
      const suggestions = await api.listStorageFiles(providerKey ? { provider: providerKey } : {});
      setStorageSuggestions(suggestions);
      return;
    }
    
    setIsLoading(true);
    try {
      const results = await api.searchStorage(query, providerKey);
      setStorageSuggestions(results);
    } catch (err) {
      console.error('❌ Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportAssets = async () => {
    if (selectedAssetIds.length === 0) return;
    
    setIsImporting(true);
    setGenerationMessage('Director is analyzing your strategic assets...');
    
    // OPEN MODAL IMMEDIATELY
    setIsIngestionModalOpen(true);
    setIngestionStatus({
      step: 'Initiating',
      percentage: 0,
      message: 'Commanding Strategic Analysis...'
    });

    setSensingLogs(prev => [...prev, { 
      id: `import-start-${Date.now()}`, 
      message: `Analyzing ${selectedAssetIds.length} strategic assets...`, 
      type: 'info' 
    }]);

    try {
      const res = await api.post<any>('/intelligence/shred', { 
        assetIds: selectedAssetIds,
        sourceType: 'connector_asset',
        providerName: currentStorageProvider(),
        synthesisOnly: true, // RUN COMMANDER, NOT SHREDDER
      });

      if (res.batchId) {
        setIngestionBatchId(res.batchId);
        // Modal is already open, status will update via WebSocket
      }
      
      setSensingLogs(prev => [...prev, { 
        id: `import-complete-${Date.now()}`, 
        message: "Strategic Analysis Handed to Commander.", 
        type: 'success' 
      }]);

    } catch (e: any) {
      console.error('❌ [OnboardingContext] Import failed:', e);
      setSensingLogs(prev => [...prev, { 
        id: `import-error-${Date.now()}`, 
        message: "Calibration interrupted. Some assets could not be fully ingested.", 
        type: 'error' 
      }]);
    } finally {
      setIsImporting(false);
    }
  };

  const triggerStorageScan = async (folderId?: string) => {
    setIsLoading(true);
    console.log('🔍 [OnboardingContext] triggerStorageScan initiated', { folderId });
    setSensingLogs(prev => [...prev, { id: `manual-scan-${Date.now()}`, message: "Initiating deep cloud scan for strategic assets...", type: 'info' }]);
    try {
      const providerKey = currentStorageProvider();
      console.log('🔍 [OnboardingContext] Resolved providerKey:', providerKey);
      
      if (!providerKey) {
        throw new Error('Provider context not resolved. Please ensure you are on a valid discovery step.');
      }
      
      const assets = await api.listStorageAssets(providerKey, folderId);
      console.log('✅ [OnboardingContext] Assets received:', assets.length, 'items');
      
      setStorageSuggestions(assets);
      
      if (!folderId) {
        setSelectedAssetIds(assets.filter(a => a.mimeType !== 'application/vnd.google-apps.folder').map((s: any) => s.id));
      }

      if (assets.length > 0) {
        setSensingLogs(prev => [...prev, { id: `manual-success-${Date.now()}`, message: `Deep scan identified ${assets.length} items.`, type: 'success' }]);
      } else {
        setSensingLogs(prev => [...prev, { id: `manual-empty-${Date.now()}`, message: "Deep scan complete. No new high-signal assets identified.", type: 'info' }]);
      }
    } catch (err: any) {
      console.error("❌ [OnboardingContext] Manual storage scan failed:", err);
      setSensingLogs(prev => [...prev, { id: `manual-err-${Date.now()}`, message: `Scan stalled: ${err.message || 'Check connection'}`, type: 'error' }]);
    } finally {
      setIsLoading(false);
    }
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
    proposedActionLanes, selectedActionLanes, currentActionLaneCampaignIndex, connectedProviders, allConnectors,
    providerStatuses, sensingLogs, isSensingActive, spotlightData, spotlightIndex, googleSubStep,
    discoveryCalibration, isLoading, uploadStatus, isConductorThinking, generationMessage,
    storageSuggestions, setStorageSuggestions, selectedAssetIds, setSelectedAssetIds,
    nextStep, triggerStepNarration, handleDiscoveryNext, startSequentialSensing, designActionLanes,
    handleConductorSend, seedState, setConnectedProviders, setDiscoveryCalibration, setUploadStatus,
    setActiveImportId, setWizardMessages, setSelectedCampaigns, setSelectedActionLanes,
    setCurrentActionLaneCampaignIndex, setSpotlightIndex, setGoogleSubStep, api, user,
    onComplete, setSelectedLanes, isWorking, isConductorExpanded, setIsConductorExpanded,
    handleStorageSearch, handleImportAssets, triggerStorageScan, initiateProviderSensing, isImporting,
    ingestionStatus, isIngestionModalOpen, ingestionBatchId, setIsIngestionModalOpen,
    onConnectLinkedIn: onConnectLinkedIn ? async () => {
      await onConnectLinkedIn();
      setConnectedProviders(prev => prev.includes('linkedin') ? prev : [...prev, 'linkedin']);
    } : undefined,
    onConnectGoogle: onConnectGoogle ? async () => {
      await onConnectGoogle();
      // We don't manually update the array here anymore; we rely on the re-fetch of connectors
      // to populate the raw gmail, google_drive, and google_calendar names.
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
