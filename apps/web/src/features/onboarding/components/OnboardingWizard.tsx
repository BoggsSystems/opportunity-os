import React, { useState, useRef, useEffect, memo } from 'react';
import { 
  Users, Target, Rocket, ArrowRight, Upload, CheckCircle, 
  Database, ShieldCheck, RefreshCw, Zap, Maximize2, Minimize2, Layers, Mail, Network, PlayCircle,
  ShoppingBag, MessageSquare, Globe
} from 'lucide-react';
import { connectionService } from '../../connections/services/connection.service';
import { ImportSource } from '../../connections/types/connection.types';
import { importWebSocketService, ImportEvent } from '../../connections/services/importWebSocket.service';
import { AuthScreen } from '../../../components/auth/AuthScreen';
import { useUIStore } from '../../../store';
import { ApiClient } from '../../../lib/api';
import { ConductorChat } from '../../../components/conductor/ConductorChat';
import { MOCK_IP_ASSETS, MOCK_SYNTHESIS, MOCK_OFFERINGS, MOCK_CAMPAIGNS } from '../../../lib/onboarding-mocks';
import './OnboardingWizard.css';

interface OnboardingWizardProps {
  onComplete: () => void;
  user?: { id: string; email: string; fullName?: string | null; avatarUrl?: string | null };
  isWorking?: boolean;
  notice?: any;
  api: ApiClient;
  emailReadiness?: any;
  onAuth?: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, initialStrategy?: any) => Promise<void>;
  onConnectOutlook?: () => Promise<void>;
  onConnectGmail?: () => Promise<void>;
  onConnectLinkedIn?: () => Promise<void>;
  onConnectHubSpot?: (token: string) => Promise<void>;
  onConnectShopify?: (storeName: string, token: string) => Promise<void>;
  onConnectSalesforce?: (token: string) => Promise<void>;
  onSyncEmail?: () => Promise<void>;
}

type Step = 'briefing' | 'account' | 'intent' | 'relationships' | 'discovery-sensing' | 'discovery-synthesis' | 'knowledge' | 'campaigns' | 'analysis' | 'actionLanes' | 'connectivity' | 'channels' | 'activation' | 'workspaceIntro' | 'workspaceHandoff' | 'welcome';

const CONTINUE_ONBOARDING_AFTER_AUTH_KEY = 'opportunity-os:continue-onboarding-after-auth';
const WORKSPACE_ACTIVATION_PAYLOAD_KEY = 'opportunity-os:workspace-activation-payload';
const DEFAULT_SIGNUP_PASSWORD = 'Password123!';

const PROVIDERS = [
  { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin' },
  { id: 'google', name: 'Google', icon: 'google' },
  { id: 'microsoft', name: 'Outlook', icon: 'microsoft' },
];

type OnboardingSnapshot = {
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

const clearOnboardingSnapshot = (userId?: string) => {
  try {
    localStorage.removeItem(getOnboardingStorageKey(userId));
  } catch {
    // Ignore storage failures; onboarding can still complete in memory.
  }
};

export const OnboardingWizard: React.FC<OnboardingWizardProps> = memo(({ 
  onComplete, 
  user, 
  isWorking, 
  notice, 
  api, 
  emailReadiness: parentEmailReadiness, 
  onAuth, 
  onConnectOutlook, 
  onConnectGmail, 
  onConnectHubSpot,
  onConnectShopify,
  onConnectSalesforce,
  onSyncEmail 
}) => {
  console.log('🏗️ OnboardingWizard MOUNTED/RE-RENDERED');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredSnapshotRef = useRef<OnboardingSnapshot | null>(loadOnboardingSnapshot(user?.id));
  const restoredSnapshot = restoredSnapshotRef.current;
  const [isSensingActive, setIsSensingActive] = useState(false);
  const [sensingLogs, setSensingLogs] = useState<{ id: string; message: string; type: 'info' | 'insight' | 'success' }[]>([]);
  const [sensingSummary, setSensingSummary] = useState<{ totalNodes: number; strategicLanes: number; topInsights: string[] } | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState<number>(-1);
  const [spotlightData, setSpotlightData] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>(restoredSnapshot?.currentStep ?? 'briefing');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [importProgress, setImportProgress] = useState({
    percentage: 0,
    processedRecords: 0,
    totalRecords: 0,
    importedRecords: 0,
    duplicateRecords: 0,
  });
  const [finalAnalysis, setFinalAnalysis] = useState<any>(null);
  const [strategicDraft, setStrategicDraft] = useState<any>(restoredSnapshot?.strategicDraft ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [connectionCount, setConnectionCount] = useState<number>(restoredSnapshot?.connectionCount ?? 0);
  const [activeImportId, setActiveImportId] = useState<string | null>(restoredSnapshot?.activeImportId ?? null);
  const [uploadedAssets, setUploadedAssets] = useState<Array<{
    title: string;
    interpretation: string;
    summary: string;
    frameworks: string[];
  }>>(restoredSnapshot?.uploadedAssets ?? []);
  const [comprehensiveSynthesis, setComprehensiveSynthesis] = useState<string | null>(restoredSnapshot?.comprehensiveSynthesis ?? null);
  
  // Conductor Orchestration State
  const [selectedLanes, setSelectedLanes] = useState<string[]>(restoredSnapshot?.selectedLanes ?? []);
  const [conductorMessage, setConductorMessage] = useState<string | null>(null);
  const [isConductorThinking, setIsConductorThinking] = useState(false);
  const [refinementMode, setRefinementMode] = useState<'none' | 'pivot' | 'confirmed'>('none');
  const [pivotText, setPivotText] = useState('');
  const [wizardMessages, setWizardMessages] = useState<any[]>(restoredSnapshot?.wizardMessages ?? []);
  const [accountName, setAccountName] = useState('Test Operator');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState(DEFAULT_SIGNUP_PASSWORD);
  const [isLoading, setIsLoading] = useState(false);
  const [discoveryCalibration, setDiscoveryCalibration] = useState<Record<string, string>>({});
  const [googleSubStep, setGoogleSubStep] = useState<'drive' | 'gmail' | 'calendar' | null>(null);
  const [isSensing, setIsSensing] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const isAnyWorking = isWorking || isLoading;
  const [guestSessionId] = useState(() => crypto.randomUUID());
  
  const { setPodiumMode } = useUIStore();

  const [proposedOfferings, setProposedOfferings] = useState<any[]>(restoredSnapshot?.proposedOfferings ?? []);
  const [proposedCampaigns, setProposedCampaigns] = useState<any[]>(restoredSnapshot?.proposedCampaigns ?? []);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(restoredSnapshot?.selectedCampaigns ?? []);
  const [proposedActionLanes, setProposedActionLanes] = useState<any[]>(restoredSnapshot?.proposedActionLanes ?? []);
  const [selectedActionLanes, setSelectedActionLanes] = useState<string[]>(restoredSnapshot?.selectedActionLanes ?? []);
  const [currentActionLaneCampaignIndex, setCurrentActionLaneCampaignIndex] = useState(restoredSnapshot?.currentActionLaneCampaignIndex ?? 0);
  const [emailReadiness, setEmailReadiness] = useState<any>(parentEmailReadiness ?? null);
  const [showDevHarness, setShowDevHarness] = useState(false);
  const [isConductorExpanded, setIsConductorExpanded] = useState(false);
  const [activationSelection, setActivationSelection] = useState<{ campaignId: string; laneId: string; source: 'guided' | 'manual' } | null>(null);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>(restoredSnapshot?.connectedProviders ?? []);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, { status: 'idle' | 'pending' | 'syncing' | 'completed' | 'error'; message?: string; result?: string }>>({});
  const actionLaneNarrationKeysRef = useRef<Set<string>>(new Set());

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
    try {
      localStorage.setItem(getOnboardingStorageKey(user?.id), JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Failed to persist onboarding checkpoint:', error);
    }
  }, [
    user?.id,
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
  ]);
 
  const seedState = () => {
    setUploadedAssets(MOCK_IP_ASSETS.map(asset => ({
      title: asset.name,
      interpretation: asset.type,
      summary: asset.name,
      frameworks: [],
    })));
    setComprehensiveSynthesis(MOCK_SYNTHESIS);
    setProposedOfferings(MOCK_OFFERINGS);
    setSelectedLanes(MOCK_OFFERINGS.map(o => o.id));
    setProposedCampaigns(MOCK_CAMPAIGNS);
    setSelectedCampaigns(MOCK_CAMPAIGNS[0] ? [MOCK_CAMPAIGNS[0].id] : []);
    setCurrentActionLaneCampaignIndex(0);
    setStrategicDraft({
      posture: { text: "Strategic AI Lead", objectives: ["Efficiency", "Scale"], preferredTone: "Professional" },
      theses: [{ title: "AI Velocity", content: "AI is the new leverage.", tags: ["AI", "SDLC"] }]
    });
  };

  const continueAfterAccountCreation = async () => {
    if (user) {
      setCurrentStep('relationships');
      return;
    }
    if (!onAuth || !accountEmail || !accountPassword) return;

    localStorage.setItem(CONTINUE_ONBOARDING_AFTER_AUTH_KEY, 'true');
    await onAuth('signup', accountEmail, accountPassword, accountName || 'Test Operator');
  };

  const useGeneratedAccount = () => {
    setAccountName('Test Operator');
    setAccountPassword(DEFAULT_SIGNUP_PASSWORD);
    setAccountEmail(`web-test-${Date.now()}@example.com`);
  };

  const completeOnboarding = async () => {
    let persistedPlan: any = null;
    if (user) {
      try {
        persistedPlan = await api.finalizeOnboardingPlan({
          campaigns: proposedCampaigns,
          actionLanes: proposedActionLanes,
          selectedCampaignIds: selectedCampaigns,
          selectedActionLaneIds: selectedActionLanes,
          activationSelection,
          comprehensiveSynthesis,
        });
      } catch (error) {
        console.error('Failed to persist onboarding plan before workspace handoff:', error);
      }
    }

    if (activationSelection) {
      const campaign = proposedCampaigns.find(candidate => candidate.id === activationSelection.campaignId);
      const lane = proposedActionLanes.find(candidate => candidate.id === activationSelection.laneId);
      if (campaign && lane) {
        localStorage.setItem(WORKSPACE_ACTIVATION_PAYLOAD_KEY, JSON.stringify({
          campaign,
          lane,
          persisted: persistedPlan ? {
            campaignId: persistedPlan.firstActionCycle?.campaignId || persistedPlan.firstActionItem?.campaignId,
            actionLaneId: persistedPlan.firstActionCycle?.actionLaneId || persistedPlan.firstActionItem?.actionLaneId,
            actionCycleId: persistedPlan.firstActionCycle?.id,
            actionItemId: persistedPlan.firstActionItem?.id,
          } : null,
          selectedCampaignCount: selectedCampaigns.length,
          selectedActionLaneCount: selectedActionLanes.length,
          connectorReady: Boolean(emailReadiness?.ready),
          createdAt: new Date().toISOString(),
        }));
      }
    }
    clearOnboardingSnapshot(user?.id);
    clearOnboardingSnapshot();
    onComplete();
  };

  const handoffToWorkspace = () => {
    setCurrentStep('workspaceHandoff');
    setIsHandingOff(true);
    window.setTimeout(() => {
      void completeOnboarding();
    }, 1400);
  };

  // Dynamic Step Narration Trigger
  const triggerStepNarration = async (step: Step) => {
    console.log(`🎤 NARRATION: Triggering for step ${step}`);
    setIsConductorThinking(true);
    
    let systemPrompt = "";
    const narrationHeader = "[SYSTEM: NARRATION MODE - DO NOT ask for goal confirmation. DO NOT ask 'is this the objective?'. The objective is already set. Provide strategic commentary and next-step instructions only.]";
    
    if (step === 'relationships') {
      systemPrompt = `${narrationHeader} Welcome to the Orchestration flow. Explain that we need their LinkedIn ZIP (Settings > Data Privacy) to map professional leverage and identify warm entry points. Ask them to drop the ZIP.`;
    } else if (step === 'knowledge') {
      systemPrompt = `${narrationHeader} Network sensing complete. We've identified ${connectionCount || 'their'} professional nodes. Now moving to 'Expertise Grounding'. Ask them to provide strategic assets (PDFs, decks) to sharpen the outreach frameworks.`;
    } else if (step === 'intent') {
      setIsLoading(true);
      setGenerationMessage('Generating revenue lanes from your network and expertise...');
      setWizardMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: "Analyzing your network topography and IP frameworks to generate proposed Revenue Lanes..." 
      }]);
      
      // Yield to the event loop so React can paint the message and typing indicator
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
            setWizardMessages(prev => [...prev, { 
              id: crypto.randomUUID(), 
              role: 'assistant', 
              text: "I have analyzed your data and proposed the following Revenue Lanes. Which ones should we focus on? Feel free to chat with me below if you'd like to refine or pivot these directions." 
            }]);
          } else {
            setWizardMessages(prev => [...prev, { 
              id: crypto.randomUUID(), 
              role: 'assistant', 
              text: "Failed to generate lanes. Please try again." 
            }]);
          }
        } catch (e) {
          setWizardMessages(prev => [...prev, { 
            id: crypto.randomUUID(), 
            role: 'assistant', 
            text: "An error occurred while generating Revenue Lanes." 
          }]);
        } finally {
          setIsLoading(false);
          setGenerationMessage(null);
        }
        setIsConductorThinking(false);
      }, 50);
      return;
    } else if (step === 'campaigns') {
      setIsLoading(true);
      setGenerationMessage('Designing campaign blueprints for each selected revenue lane...');
      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: "You've locked in your Revenue Lanes. I'm now designing a campaign for each one — including who to target, what to say, and how long to run it. Give me a moment..."
      }]);

      setTimeout(async () => {
        try {
          const confirmedLanes = proposedOfferings.filter(o => selectedLanes.includes(o.id));
          const res = await api.proposeCampaigns({
            selectedLanes: confirmedLanes,
            networkCount: connectionCount || strategicDraft?.connectionCount || 14640,
            frameworks: uploadedAssets.flatMap(a => a.frameworks) || [],
            interpretation: comprehensiveSynthesis || uploadedAssets.map(a => a.interpretation).join('\n\n') || ''
          });
          if (res.success && res.campaigns?.length) {
            setProposedCampaigns(res.campaigns);
            setWizardMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: "Here are your initial campaign blueprints. Each one is designed to activate a specific Revenue Lane. Feel free to chat with me below to adjust any parameters — duration, target audience, messaging angle — or to add additional campaigns to a lane."
            }]);
          } else {
            setWizardMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: "Failed to generate campaigns. Please try again."
            }]);
          }
        } catch (e) {
          setWizardMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: "An error occurred while generating campaigns."
          }]);
        } finally {
          setIsLoading(false);
          setGenerationMessage(null);
        }
        setIsConductorThinking(false);
      }, 50);
      return;
    } else if (step === 'actionLanes') {
      setIsConductorThinking(false);
      return;
    } else if (step === 'connectivity') {
      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: "Excellent selection. To fuel these lanes, I need to establish the following technical connections."
      }]);
      setIsConductorThinking(false);
      return;
    } else if (step === 'account') {
      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: "Your strategy is ready to activate. Create a workspace account now so I can save this plan, attach connectors to the right owner, and continue into execution setup."
      }]);
      setIsConductorThinking(false);
      return;
    } else if (step === 'activation') {
      systemPrompt = `${narrationHeader} Action cycle selection is ready. Explain that the user should choose the first campaign lane or use the guided start button, and that nothing will be sent without approval.`;
    } else if (step === 'workspaceIntro') {
      systemPrompt = `${narrationHeader} The first action cycle has been selected. Introduce the workspace as a continuation of this wizard: the plan, first action cycle, and connector state are being carried forward. Explain what the user will see next.`;
    } else if (step === 'workspaceHandoff') {
      systemPrompt = `${narrationHeader} The workspace handoff is underway. Briefly explain that you are saving the strategy, preparing the first action cycle, and opening the workspace canvas.`;
    } else if (step === 'analysis') {
      systemPrompt = `${narrationHeader} Mission selected. Moving to 'Strategic Analysis'. Explain that you are now synthesizing their network leverage, their IP, and their chosen mission to build the final orchestration plan.`;
    }

    if (!systemPrompt) {
      setIsConductorThinking(false);
      return;
    }

    try {
      const response = await api.converse({
        message: systemPrompt,
        ...(!user ? { guestSessionId } : {}),
        context: {
          currentStep: step,
          strategicDraft,
          connectionCount,
          selectedMission: selectedLanes.join(', ')
        }
      });
      
      setWizardMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: response.reply 
      }]);
      setConductorMessage(response.reply);
    } catch (error) {
      console.error('Narration error:', error);
    } finally {
      setIsConductorThinking(false);
    }
  };

  useEffect(() => {
    if (currentStep === 'account' && user) {
      nextStep('intent');
    }
  }, [currentStep, user]);

  useEffect(() => {
    if (currentStep !== 'welcome' && currentStep !== 'briefing' && currentStep !== 'account' && currentStep !== 'discovery-synthesis') {
      triggerStepNarration(currentStep);
    }
  }, [currentStep]);

  // Initial Greeting
  useEffect(() => {
    if (currentStep === 'briefing' && wizardMessages.length === 0) {
      setWizardMessages([{ 
        role: 'assistant', 
        text: "System initialized. I am your Conductor. I synthesize your network and expertise into high-velocity opportunity. Let's begin by sensing your current professional posture." 
      }]);
    }
  }, [currentStep]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      importWebSocketService.disconnect();
    };
  }, []);

  // Handle real AI conversation
  const handleConductorSend = async (text: string) => {
    if (!text.trim()) return;
    
    console.log('🤖 CONSOLE: handleConductorSend called with:', text);
    
    // Add user message to UI immediately
    const userMsg = { id: crypto.randomUUID(), role: 'user', text };
    setWizardMessages(prev => [...prev, userMsg]);
    setIsConductorThinking(true);
    
    try {
      if (currentStep === 'intent') {
        // Split lanes into locked (selected) and unlocked
        const lockedLanes = proposedOfferings.filter(lane => selectedLanes.includes(lane.id));
        const unlockedLanes = proposedOfferings.filter(lane => !selectedLanes.includes(lane.id));

        const res = await api.refineOfferings({
          currentLanes: unlockedLanes, // Only send unlocked lanes to AI
          feedback: text,
          networkCount: connectionCount || strategicDraft?.connectionCount || 14640,
          networkPosture: strategicDraft?.posture?.text || '',
          frameworks: uploadedAssets.flatMap(a => a.frameworks) || [],
          interpretation: comprehensiveSynthesis || uploadedAssets.map(a => a.interpretation).join('\n\n') || ''
        });
        
        if (res.success && res.offerings?.length) {
          // Re-combine locked lanes with newly generated lanes
          setProposedOfferings([...lockedLanes, ...res.offerings]);
          setWizardMessages(prev => [...prev, { 
            id: crypto.randomUUID(), 
            role: 'assistant', 
            text: "I have updated the Revenue Lanes based on your feedback. Which ones should we focus on? Feel free to chat with me below if you'd like to refine or pivot these directions." 
          }]);
        } else {
          setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: "Failed to refine lanes. Please try again." }]);
        }
      } else if (currentStep === 'campaigns') {
        // Split campaigns into locked (selected) and unlocked
        const lockedCampaigns = proposedCampaigns.filter(c => selectedCampaigns.includes(c.id));
        const unlockedCampaigns = proposedCampaigns.filter(c => !selectedCampaigns.includes(c.id));
        const confirmedLanes = proposedOfferings.filter(o => selectedLanes.includes(o.id));

        const res = await api.refineCampaigns({
          currentCampaigns: unlockedCampaigns,
          feedback: text,
          selectedLanes: confirmedLanes,
          networkCount: connectionCount || strategicDraft?.connectionCount || 14640,
          frameworks: uploadedAssets.flatMap(a => a.frameworks) || [],
          interpretation: comprehensiveSynthesis || uploadedAssets.map(a => a.interpretation).join('\n\n') || ''
        });

        if (res.success && res.campaigns?.length) {
          setProposedCampaigns([...lockedCampaigns, ...res.campaigns]);
          setWizardMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: "I have updated the campaigns based on your feedback. Feel free to continue refining or select the ones you want to activate."
          }]);
        } else {
          setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: "Failed to refine campaigns. Please try again." }]);
        }
      } else {
        console.log('🤖 CONSOLE: Calling api.converse...', {
          guestSessionId: !user ? guestSessionId : 'authenticated',
          currentStep
        });
        
        const response = await api.converse({
          message: text,
          ...(!user ? { guestSessionId } : {}),
          context: {
            currentStep,
            refinementMode,
            strategicDraft
          }
        });
        
        console.log('🤖 CONSOLE: AI Response received:', response);
        
        const assistantMsg = { 
          id: crypto.randomUUID(), 
          role: 'assistant', 
          text: response.reply 
        };
        setWizardMessages(prev => [...prev, assistantMsg]);
        
        if (response.onboardingPlan) {
          setStrategicDraft(response.onboardingPlan);
        }
      }
    } catch (error) {
      console.error('🤖 CONSOLE: Conductor error:', error);
      setWizardMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: "I apologize, but I encountered a disruption in my strategic uplink. Could you repeat that?" 
      }]);
    } finally {
      setIsConductorThinking(false);
    }
  };

  // Consolidated Import Progress Subscription
  useEffect(() => {
    if (!activeImportId) return;

    console.log(`📡 Subscribing to import: ${activeImportId}`);
    importWebSocketService.subscribe(activeImportId, (event: ImportEvent) => {
      console.log('📡 Import event:', event.type);
      if (event.type === 'progress') {
        setImportProgress({
          percentage: event.data.percentage || 0,
          processedRecords: event.data.processedRecords || 0,
          totalRecords: event.data.totalRecords || 0,
          importedRecords: event.data.importedRecords || 0,
          duplicateRecords: event.data.duplicateRecords || 0,
        });
      } else if (event.type === 'completed') {
        setFinalAnalysis({
          total: event.data.totalRecords,
          imported: event.data.importedRecords,
          duplicates: event.data.duplicateRecords,
        });
        setWizardMessages(prev => [...prev, { 
          role: 'assistant', 
          text: 'This is my initial interpretation of your network leverage. Does this resonate, or should we refine the focus?' 
        }]);
        setUploadStatus('success');
      } else if (event.type === 'error') {
        console.error('❌ Import error:', event.data);
        setUploadStatus('error');
      }
    });

    return () => {
      importWebSocketService.disconnect();
    };
  }, [activeImportId]);

  // Handle transition from anonymous to authenticated
  useEffect(() => {
    if (user && currentStep === 'analysis') {
      console.log('🔐 Auth successful, transitioning wizard');
      if (pendingFile && !activeImportId) {
        setUploadStatus('uploading');
        const importRequest = {
          name: `Onboarding Import - ${new Date().toLocaleDateString()}`,
          source: ImportSource.LINKEDIN_EXPORT,
          description: `Post-auth automated ingest`
        };
        connectionService.ingestZip(importRequest, pendingFile)
          .then(result => {
            if (result.importId) {
              setActiveImportId(result.importId);
              setUploadStatus('processing');
            }
          })
          .catch(err => {
            console.error('❌ Background ingest FAILED:', err);
            setUploadStatus('error');
          });
      }
    }
  }, [user, currentStep, pendingFile, activeImportId]);

  const handleLaneToggle = (laneId: string) => {
    setSelectedLanes(prev => 
      prev.includes(laneId) 
        ? prev.filter(id => id !== laneId)
        : [...prev, laneId]
    );
  };

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaigns(prev =>
      prev.includes(campaignId)
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const selectedActionLaneCampaigns = proposedCampaigns.filter(campaign => selectedCampaigns.includes(campaign.id));

  const laneSupportsCampaign = (lane: any, campaignId: string) => {
    if (Array.isArray(lane.campaignIds)) return lane.campaignIds.includes(campaignId);
    if (lane.campaignId) return lane.campaignId === campaignId;
    return true;
  };

  const refreshEmailReadiness = async () => {
    const readiness = await api.getEmailReadiness();
    setEmailReadiness(readiness);
    return readiness;
  };

  const handleOutlookConnect = async () => {
    if (!onConnectOutlook) return;
    setIsLoading(true);
    try {
      await onConnectOutlook();
      const readiness = await refreshEmailReadiness();
      if (readiness?.ready) {
        const connectorLabel = readiness.connector?.connectorName || readiness.connector?.providerDisplayName || 'Outlook';
        setWizardMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `${connectorLabel} is connected. We can now use it for approved email actions in the action engine.`,
        }]);
      }
    } catch (error) {
      console.error('Outlook connection refresh failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep !== 'actionLanes') return;

    const activeCampaigns = selectedActionLaneCampaigns;
    const safeCampaignIndex = Math.min(currentActionLaneCampaignIndex, Math.max(activeCampaigns.length - 1, 0));
    const currentCampaign = activeCampaigns[safeCampaignIndex];
    if (!currentCampaign) return;

    const campaignLanes = proposedActionLanes.filter(lane => laneSupportsCampaign(lane, currentCampaign.id));
    if (campaignLanes.length === 0) return;

    const narrationKey = `action-lanes:${currentCampaign.id}:${campaignLanes.map(lane => lane.id).join('|')}`;
    if (
      actionLaneNarrationKeysRef.current.has(narrationKey) ||
      wizardMessages.some(message => message.contextKey === narrationKey)
    ) {
      return;
    }
    actionLaneNarrationKeysRef.current.add(narrationKey);

    const fallbackText = `For ${currentCampaign.title}, I am recommending ${campaignLanes.map(lane => lane.title).join(' and ')} because they match the target, goal, and current outreach posture of this campaign. Review these lanes as execution motions: keep the ones you want the engine to turn into concrete actions, or tell me what feels too aggressive, too manual, or missing.`;

    setIsConductorThinking(true);
    setTimeout(async () => {
      try {
        const response = await api.converse({
          message: `[SYSTEM: ACTION LANE REVIEW MODE] Start a focused conversation about the proposed action lanes for this specific campaign. Do not restate the whole onboarding flow. Explain why these lanes fit, call out tradeoffs, and ask the user what they want to adjust before moving to the next campaign. Keep it concise and practical.

Campaign:
- Title: ${currentCampaign.title}
- Revenue lane: ${currentCampaign.laneTitle || 'Not specified'}
- Description: ${currentCampaign.description || 'Not specified'}
- Target: ${currentCampaign.targetSegment || 'Not specified'}
- Goal: ${currentCampaign.goalMetric || 'Not specified'}

Suggested action lanes:
${campaignLanes.map(lane => `- ${lane.title}: ${lane.description || ''} Tactics: ${(lane.tactics || []).join('; ')}`).join('\n')}`,
          ...(!user ? { guestSessionId } : {}),
          context: {
            currentStep,
            campaign: currentCampaign,
            actionLanes: campaignLanes,
            selectedActionLanes,
            comprehensiveSynthesis,
          },
        });

        setWizardMessages(prev => {
          if (prev.some(message => message.contextKey === narrationKey)) return prev;
          return [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: response.reply || fallbackText,
            contextKey: narrationKey,
          }];
        });
        setConductorMessage(response.reply || fallbackText);
      } catch (error) {
        console.error('Action lane narration error:', error);
        setWizardMessages(prev => {
          if (prev.some(message => message.contextKey === narrationKey)) return prev;
          return [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: fallbackText,
            contextKey: narrationKey,
          }];
        });
        setConductorMessage(fallbackText);
      } finally {
        setIsConductorThinking(false);
      }
    }, 50);
  }, [
    currentStep,
    currentActionLaneCampaignIndex,
    selectedActionLaneCampaigns,
    proposedActionLanes,
    selectedActionLanes,
    wizardMessages,
    api,
    user,
    guestSessionId,
    comprehensiveSynthesis,
  ]);

  const nextStep = (step: Step) => {
    setUploadStatus('idle');
    setGenerationMessage(null);
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  const designActionLanes = async () => {
    setIsLoading(true);
    setGenerationMessage('Designing campaign-specific action lanes...');
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
    } catch (e) {
      console.error(e);
      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'I hit an issue while designing action lanes. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
      setGenerationMessage(null);
    }
  };

  const renderGenerationCards = (
    count: number,
    labels: string[] = ['Analyzing inputs', 'Mapping targets', 'Drafting recommendations']
  ) => (
    <div className="mission-grid generation-card-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="mission-card generation-card neural-pulse">
          <div className="card-content">
            <div className="generation-card-icon">
              <RefreshCw size={26} />
            </div>
            <h3>{labels[index] || 'Designing option'}</h3>
            <p>Building a recommendation from your profile, assets, and selected strategy.</p>
            <div className="generation-lines">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    try {
      if (!user) {
        // Anonymous Audit Case
        console.log('🔍 Starting anonymous audit...');
        const result = await connectionService.audit(file);
        setStrategicDraft(result);
        setConnectionCount(result.connectionCount || 0);
        setWizardMessages(prev => [...prev, { 
          role: 'assistant', 
          text: 'This is my initial interpretation of your network leverage. Does this resonate, or should we refine the focus?' 
        }]);
        setPendingFile(file);
        setUploadStatus('success');
        return;
      }

      // Authenticated Ingest Case
      const importRequest = {
        name: `Onboarding Import - ${new Date().toLocaleDateString()}`,
        source: ImportSource.LINKEDIN_EXPORT,
        description: `Initial network import`
      };
      
      console.log('🚀 Starting authenticated ingest...');
      const result = await connectionService.ingestZip(importRequest, file);
      setStrategicDraft(result.strategicDraft);
      setActiveImportId(result.importId);
      setPendingFile(file);
      setUploadStatus('processing'); 
    } catch (error) {
      console.error('❌ Error in handleFileSelect:', error);
      setUploadStatus('error');
    }
  };

  const handleKnowledgeSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = connectionService.validateFile(file);
    if (!validation.isValid) {
      console.error('❌ File validation FAILED:', validation.error);
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    try {
      // Pass previously uploaded assets as context so AI can synthesize across all documents
      const result = await connectionService.auditKnowledge(file, uploadedAssets);
      console.log('📚 Knowledge interpreted:', result);
      
      // Accumulate this asset into the array
      const newAsset = {
        title: result.title || file.name,
        interpretation: result.interpretation,
        summary: result.summary,
        frameworks: result.frameworks,
      };
      setUploadedAssets(prev => [...prev, newAsset]);
      
      // Update comprehensive synthesis (AI weaves all assets together)
      if (result.comprehensiveSynthesis) {
        setComprehensiveSynthesis(result.comprehensiveSynthesis);
      }

      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `I've synthesized "${newAsset.title}". It adds significant depth to your strategic IP, particularly regarding ${result.frameworks?.[0] || 'your core frameworks'}. You can add more assets to further sharpen the engine, or move forward to determine your mission.`
      }]);
      
      // Update strategic draft with new frameworks
      setStrategicDraft((prev: any) => ({
        ...prev,
        theses: [
          ...(prev?.theses || []),
          { title: `Asset: ${file.name}`, content: result.interpretation }
        ]
      }));
      
      setUploadStatus('success');
    } catch (error) {
      console.error('❌ Error in handleKnowledgeSelect:', error);
      setUploadStatus('error');
    }
  };

  const handleDiscoveryNext = () => {
    if (spotlightData && spotlightIndex < spotlightData.length - 1) {
      const nextIndex = spotlightIndex + 1;
      setSpotlightIndex(nextIndex);
      const nextProvider = spotlightData[nextIndex];

      // Handle Google transition or sub-steps
      if (nextProvider.id === 'google') {
        setGoogleSubStep('drive');
        setWizardMessages(prev => [
          ...prev,
          { id: Date.now().toString(), role: 'assistant', text: "Moving to your Google discovery. Let's look at your Google Drive assets first." }
        ]);
      } else {
        setGoogleSubStep(null);
        setWizardMessages(prev => [
          ...prev,
          { id: Date.now().toString(), role: 'assistant', text: nextProvider.conductorSpeech }
        ]);
      }
    } else {
      // Final Synthesis
      setCurrentStep('discovery-synthesis' as any);
      setWizardMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', text: "Discovery complete across all ecosystems. I've synthesized your unified professional topography. Let's review your combined strategic leverage." }
      ]);
    }
  };

  const handleGoogleSubNext = () => {
    if (googleSubStep === 'drive') {
      setGoogleSubStep('gmail');
      setWizardMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', text: "Google Drive scan complete. Now, mapping your Gmail relationship intensity." }
      ]);
    } else if (googleSubStep === 'gmail') {
      setGoogleSubStep('calendar');
      setWizardMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', text: "Gmail mapping complete. Finally, let's sync your Calendar moments to identify upcoming strategic opportunities." }
      ]);
    } else {
      handleDiscoveryNext();
    }
  };

  const startSequentialSensing = async () => {
    setIsSensingActive(true);
    setSensingLogs([
      { id: '1', message: 'Initializing orchestration environment...', type: 'info' }
    ]);

    const selectedIds = connectedProviders;

    for (const id of selectedIds) {
      const provider = PROVIDERS.find(p => p.id === id);
      if (!provider) continue;

      setProviderStatuses(prev => ({
        ...prev,
        [id]: { status: 'syncing', message: 'Sensing network topography...' }
      }));

      setSensingLogs(prev => [
        ...prev,
        { id: `log-${id}-1`, message: `Scanning ${provider.name} for relationship depth...`, type: 'info' }
      ]);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const insights = [
        `Identified 12 latent opportunities in ${provider.name} correspondence.`,
        `Cross-referenced 450 contacts with your professional roadmap.`,
        `Synthesized 8 high-trust nodes from recent interactions.`,
        `Mapped relationship topography for ${provider.name} ecosystem.`
      ];
      const randomInsight = insights[Math.floor(Math.random() * insights.length)];

      setSensingLogs((prev: any[]) => [
        ...prev,
        { id: `insight-${id}`, message: randomInsight, type: 'insight' }
      ]);

      setProviderStatuses(prev => ({
        ...prev,
        [id]: { status: 'completed', result: `Verified: ${Math.floor(Math.random() * 50) + 10} Strategic Nodes` }
      }));

      setSensingLogs((prev: any[]) => [
        ...prev,
        { id: `success-${id}`, message: `${provider.name} sensing complete.`, type: 'success' }
      ]);

      await new Promise(resolve => setTimeout(resolve, 800));
    }

    const providers = connectedProviders;
    const userName = user?.fullName?.split(' ')[0] || 'there';
    const spotlights = providers.map(id => {
      const provider = PROVIDERS.find(p => p.id === id);
      if (id === 'linkedin') return { id, name: 'LinkedIn', icon: provider?.icon, metric: '12,400', metricLabel: 'Connections Mapped', insight: 'High density in Series B Founders and Strategic Investors.', conductorSpeech: `Verified. Excellent to meet you, ${userName}. LinkedIn topography is high-density—I have mapped your connection nodes.`, tags: ['Network Topography', 'Strategic Density'] };
      if (id === 'google' || id === 'microsoft') return { id, name: id === 'google' ? 'Gmail' : 'Outlook', icon: provider?.icon, metric: '1,842', metricLabel: 'Relationship Nodes', insight: 'I\'ve surfaced 42 latent opportunities from your recent correspondence threads.', conductorSpeech: 'Correspondence analysis complete. I have identified latent relationship depth.', tags: ['Relationship Intensity', 'Latent Signals'] };
      return { id, name: provider?.name, icon: provider?.icon, metric: '840', metricLabel: 'Data Points', insight: 'Synthesizing context from this source...', conductorSpeech: 'System context processed.', tags: ['General Context'] };
    });

    setSpotlightData(spotlights);
    setSpotlightIndex(0);
    setIsSensingActive(false);

    setTimeout(() => {
      if (!spotlights || spotlights.length === 0) return;
      const firstSpotlight = spotlights[0];
      if (!firstSpotlight) return;
      
      const providerId = firstSpotlight.id;
      
      if (providerId === 'google') {
        setGoogleSubStep('drive');
        setWizardMessages((prev: any[]) => [
          ...prev,
          { id: Date.now().toString(), role: 'assistant', text: "Entering your Google ecosystem. Let's start with your Google Drive. I'm looking for assets that define your expertise—your book, your recent resumes, or strategic whitepapers." }
        ]);
      } else {
        setWizardMessages((prev: any[]) => [
          ...prev,
          { id: Date.now().toString(), role: 'assistant', text: firstSpotlight.conductorSpeech }
        ]);
      }
    }, 2000);
  };

  const renderProviderSpotlight = () => {
    if (!spotlightData || spotlightIndex >= spotlightData.length) return null;
    const provider = spotlightData[spotlightIndex];
    const isGoogle = provider.id === 'google';

    return (
      <div className="discovery-spotlight-container">
        <div className="discovery-progress-bar">
          {spotlightData.map((p: any, idx: number) => (
            <div 
              key={p.id} 
              className={`progress-segment ${idx <= spotlightIndex ? 'active' : ''} ${idx === spotlightIndex ? 'current' : ''}`}
            />
          ))}
        </div>

        <div className="spotlight-card interactive-calibration">
          <div className="spotlight-header">
            <div className={`provider-icon ${provider.id}`}>
               {provider.id === 'linkedin' && <Users size={24} />}
               {provider.id === 'google' && <Globe size={24} />}
               {provider.id === 'microsoft' && <Network size={24} />}
            </div>
            <div className="header-meta">
              <h2>Discovery Calibration: {isGoogle ? `Google ${googleSubStep?.toUpperCase()}` : provider.name}</h2>
              <p className="status-badge live">Live Sensing...</p>
            </div>
          </div>

          <div className="spotlight-content">
            <div className="hero-metrics">
              <div className="metric">
                <span className="value">{provider.metric}</span>
                <span className="label">{provider.metricLabel}</span>
              </div>
              <div className="data-pulse-animation">
                <div className="pulse-ring"></div>
                <Zap size={24} className="pulse-icon" />
              </div>
            </div>

            <div className="ai-interpretation">
              <h3>
                <MessageSquare size={16} />
                Conductor Interpretation
              </h3>
              <p>{provider.insight}</p>
            </div>

            <div className="strategic-calibration">
              <h3>
                <Zap size={16} />
                Strategic Calibration
              </h3>
              <p className="calibration-hint">
                {isGoogle && googleSubStep === 'drive' 
                  ? "Tell me which specific assets to prioritize (e.g., 'Look for my book PDF', 'Ignore old resumes')"
                  : "How should I refine this discovery? (e.g., 'Focus on founders', 'Prioritize recent threads')"}
              </p>
              <textarea 
                className="calibration-input"
                placeholder="Type your strategic steering here..."
                value={discoveryCalibration[isGoogle ? `google_${googleSubStep}` : provider.id] || ''}
                onChange={(e) => setDiscoveryCalibration(prev => ({
                  ...prev,
                  [isGoogle ? `google_${googleSubStep}` : provider.id]: e.target.value
                }))}
              />
            </div>
          </div>

          <div className="spotlight-actions">
            <button 
              className="onboarding-btn-primary"
              onClick={isGoogle ? handleGoogleSubNext : handleDiscoveryNext}
            >
              {isGoogle && googleSubStep !== 'calendar' 
                ? `Next: Google ${googleSubStep === 'drive' ? 'Gmail' : 'Calendar'}`
                : (spotlightIndex === spotlightData.length - 1 ? 'Finalize Discovery' : 'Next Discovery Stop')}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDiscoverySynthesis = () => {
    return (
      <div className="discovery-synthesis-container animate-in">
        <div className="synthesis-header">
          <div className="synthesis-badge">Ecosystem Synthesis Complete</div>
          <h1>Your Global Strategic Map</h1>
          <p>I have fused your professional identity, network topography, and relationship intensity into a unified posture.</p>
        </div>

        <div className="synthesis-grid">
          <div className="synthesis-card large leverage-map">
            <h3><Target size={20} /> Relationship Topography</h3>
            <div className="leverage-metrics">
              <div className="synthesis-metric">
                <span className="val">14,242</span>
                <span className="lab">Total Ecosystem Nodes</span>
              </div>
              <div className="synthesis-metric">
                <span className="val">842</span>
                <span className="lab">High-Intensity Relationships</span>
              </div>
            </div>
            <div className="synthesis-chart-placeholder">
              {/* This would be a visual representation of network density */}
              <div className="density-map">
                <div className="density-node primary"></div>
                <div className="density-node secondary"></div>
                <div className="density-node tertiary"></div>
              </div>
            </div>
          </div>

          <div className="synthesis-card expertise-saturation">
            <h3><Zap size={20} /> Strategic Saturation</h3>
            <div className="saturation-list">
              <div className="saturation-item">
                <div className="sat-label">Operations Strategy</div>
                <div className="sat-bar"><div className="fill" style={{ width: '92%' }}></div></div>
              </div>
              <div className="saturation-item">
                <div className="sat-label">Fintech Ecosystems</div>
                <div className="sat-bar"><div className="fill" style={{ width: '78%' }}></div></div>
              </div>
              <div className="saturation-item">
                <div className="sat-label">AI Implementation</div>
                <div className="sat-bar"><div className="fill" style={{ width: '65%' }}></div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="synthesis-conductor-note">
          <div className="conductor-avatar">
            <Rocket size={24} />
          </div>
          <div className="note-content">
            <h4>Conductor Synthesis</h4>
            <p>
              Your ecosystem reveals a "Strategic Architect" posture. You have deep technical roots but your current leverage is concentrated in high-level operational leadership. I recommend prioritizing your Series B network for your first outreach cycle.
            </p>
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('relationships')}>Back to Calibration</button>
          <button className="onboarding-btn-primary glow-btn" onClick={() => setCurrentStep('knowledge')}>
            Proceed to Knowledge Grounding <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderBriefing = () => (
    <div className="onboarding-content briefing-step">
      <div className="onboarding-header">
        <div className="conductor-badge">
          <span>THE CONDUCTOR</span>
        </div>
        <h1>Increase and Improve Your Outreach.</h1>
        <p className="hero-subtitle">I am your strategic execution partner. Let's turn your network and expertise into high-quality conversations.</p>
      </div>

      <div className="briefing-visual">
        <div className="feature-row">
          <div className="feature-item">
            <div className="feature-icon"><Database size={24} /></div>
            <div className="feature-text">
              <h4>Network Intelligence</h4>
              <p>Map every high-value node in your ecosystem automatically.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><Target size={24} /></div>
            <div className="feature-text">
              <h4>Expertise Grounding</h4>
              <p>Synthesize your unique perspective into every connection.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><Rocket size={24} /></div>
            <div className="feature-text">
              <h4>Scaled Execution</h4>
              <p>Deploy high-signal campaigns that actually get responses.</p>
            </div>
          </div>
        </div>
      </div>

      {!user && (
        <div className="mock-preview-ribbon">
          <div className="ribbon-text">
            <strong>Guest Mode:</strong> See how it works for a <span className="mock-persona">Founder</span> or <span className="mock-persona">Consultant</span>.
          </div>
          <div className="ribbon-cta">Sign up to generate your own personalized strategy.</div>
        </div>
      )}

      <div className="onboarding-footer">
        <div />
        <button className="onboarding-btn-primary glow-btn" onClick={() => nextStep('account')}>
          Initialize Workspace <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderIntent = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 04: Strategic Intent</div>
        <h1>Based on your profile, what is the objective?</h1>
        <p>I have mapped your network and expertise. Select a mission to initialize the campaign.</p>
      </div>

      {proposedOfferings.length === 0 && (
        <>
          <div className="generation-status-panel neural-pulse">
            <RefreshCw size={18} />
            <div>
              <strong>{generationMessage || 'Generating revenue lanes...'}</strong>
              <span>Scanning your relationship graph, experience signals, and uploaded assets for viable offers.</span>
            </div>
          </div>
          {renderGenerationCards(5, [
            'Reading network signals',
            'Finding market fit',
            'Packaging expertise',
            'Scoring evidence',
            'Drafting revenue lanes'
          ])}
        </>
      )}

      {proposedOfferings.length > 0 && (
      <div className="mission-grid">
        {proposedOfferings.map(mission => {
          const isSelected = selectedLanes.includes(mission.id);
          
          return (
            <div 
              key={mission.id} 
              className={`mission-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleLaneToggle(mission.id)}
              style={{ 
                paddingBottom: '2rem',
                border: isSelected ? '2px solid #0070ba' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: isSelected ? '0 0 15px rgba(0, 112, 186, 0.3)' : 'none',
                position: 'relative'
              }}
            >
              <div className="card-content">
                <div className="mission-icon">
                  {isSelected ? <CheckCircle size={32} color="#0070ba" /> : <Target size={32} />}
                </div>
                <h3>{mission.title}</h3>
                <p>{mission.description}</p>
                
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                  <strong>Evidence:</strong> {mission.evidence}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
      
      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('knowledge')} disabled={isLoading}>Back</button>
        <button 
          className="onboarding-btn-primary" 
          onClick={() => setCurrentStep('campaigns')}
          disabled={selectedLanes.length === 0 || isLoading}
          style={{ opacity: selectedLanes.length === 0 || isLoading ? 0.5 : 1, cursor: selectedLanes.length === 0 || isLoading ? 'not-allowed' : 'pointer' }}
        >
          Confirm Selected Lanes <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderRelationships = () => {
    const handleToggle = (id: string) => {
      setConnectedProviders(prev => 
        prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      );
    };

    return (
      <div className="onboarding-content">
        <div className="onboarding-header">
          <div className="phase-indicator">Phase 02: Sensing Hub</div>
          <h1>Connect your professional ecosystems.</h1>
          <p>Select the platforms where your professional topography is densest. I will sense these ecosystems to map your relationship graph.</p>
        </div>

        <div className="provider-selection-container">
          <div className="provider-grid">
            {PROVIDERS.map(provider => {
              const isSelected = connectedProviders.includes(provider.id);
              const Icon = provider.id === 'linkedin' ? Network : (provider.id === 'google' ? Mail : Globe);
              
              return (
                <div 
                  key={provider.id} 
                  className={`provider-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleToggle(provider.id)}
                >
                  <div className="provider-icon-wrapper">
                    <Icon size={20} />
                    {isSelected && <div className="provider-check"><CheckCircle size={10} /></div>}
                  </div>
                  <div className="provider-info">
                    <h4>{provider.name}</h4>
                    {isSelected && (
                      <div className="provider-status-tag pending">
                        <Zap size={10} /> <span>Ready to sense</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="auth-divider">
            <span>or use offline data</span>
          </div>

          <div className="single-bucket-container" style={{ marginTop: 0 }}>
            <div className="context-bucket" style={{ maxWidth: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                <div className="bucket-icon" style={{ margin: 0 }}><Upload size={24} /></div>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>LinkedIn Archive</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Upload a ZIP export if you prefer not to connect via OAuth.</p>
                </div>
                <button 
                  className="onboarding-btn-secondary" 
                  style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '8px' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadStatus === 'uploading' ? 'Ingesting...' : 'Upload ZIP'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('account')}>Back</button>
          <button 
            className="onboarding-btn-primary" 
            onClick={() => {
              if (connectedProviders.length > 0) {
                setCurrentStep('discovery-sensing' as any);
                void startSequentialSensing();
              } else if (uploadStatus === 'success') {
                setCurrentStep('knowledge');
              }
            }}
            disabled={connectedProviders.length === 0 && uploadStatus !== 'success'}
          >
            Initialize Sensing Sequence <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderKnowledge = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 03: Knowledge</div>
        <h1>What have you built?</h1>
        <p>Upload your book PDF, decks, resume, or portfolio. I'll extract your core frameworks to ground our outreach.</p>
      </div>

      {/* Initial state: large dropzone when no assets uploaded */}
      {uploadedAssets.length === 0 && uploadStatus !== 'uploading' && (
        <div className="single-bucket-container">
          <div className="context-bucket large">
            <div className="bucket-icon"><Database size={48} /></div>
            <h3>Knowledge Source</h3>
            <p>Book PDF, Decks, Resume, Portfolio</p>
            <div className="drop-zone secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} />
              <span>Drop Strategic Assets here</span>
              <p className="drop-hint">PDF, PPTX, or Keynote</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {uploadStatus === 'uploading' && (
        <div className="single-bucket-container">
          <div className="context-bucket large">
            <div className="bucket-icon"><Database size={48} /></div>
            <h3>Knowledge Source</h3>
            <div className="drop-zone secondary neural-pulse">
              <Upload size={32} />
              <span>Extracting frameworks...</span>
            </div>
          </div>
        </div>
      )}

      {/* Iterative state: show synthesis + uploaded assets + add-more button */}
      {uploadedAssets.length > 0 && uploadStatus !== 'uploading' && (
        <>
          {/* Comprehensive Synthesis Block */}
          {comprehensiveSynthesis && (
            <div className="impression-card" style={{ marginBottom: '1.5rem' }}>
              <div className="impression-hero">
                Comprehensive Intelligence Synthesis
                <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>
                  ({uploadedAssets.length} asset{uploadedAssets.length > 1 ? 's' : ''} analyzed)
                </span>
              </div>
              <div className="impression-interpretation" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>{comprehensiveSynthesis}</p>
              </div>
            </div>
          )}

          {/* List of uploaded assets */}
          {uploadedAssets.map((asset, idx) => (
            <div key={idx} className="impression-card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <CheckCircle size={20} color="#0070ba" />
                <h4 style={{ margin: 0, fontSize: '1rem' }}>{asset.title}</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                {asset.summary || asset.interpretation?.substring(0, 200) + '...'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {asset.frameworks.map((fw, fIdx) => (
                  <span key={fIdx} className="vital-badge" style={{ fontSize: '0.75rem' }}>{fw}</span>
                ))}
              </div>
            </div>
          ))}

          {/* Add another asset button */}
          <div 
            className="drop-zone secondary" 
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              margin: '1rem 0', 
              padding: '1rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.75rem',
              cursor: 'pointer',
              border: '1px dashed rgba(0, 112, 186, 0.4)',
              borderRadius: '8px',
              background: 'rgba(0, 112, 186, 0.05)'
            }}
          >
            <Upload size={18} />
            <span style={{ fontSize: '0.9rem' }}>Add another strategic asset</span>
          </div>
        </>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('relationships')}>Back</button>
        <button 
          className={`onboarding-btn-primary ${uploadedAssets.length > 0 ? 'neural-pulse' : ''}`} 
          onClick={() => nextStep('intent')}
          disabled={uploadedAssets.length === 0}
        >
          {uploadedAssets.length > 0 ? 'Determine Mission' : 'Upload an asset to continue'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderCampaigns = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 05: Campaign Architecture</div>
        <h1>Now let's put these lanes into motion.</h1>
        <p>Each Revenue Lane needs a campaign — a focused, time-bound push to generate real conversations.</p>
      </div>

      {/* Loading state when no campaigns yet */}
      {proposedCampaigns.length === 0 && (
        <>
          <div className="generation-status-panel neural-pulse">
            <RefreshCw size={18} />
            <div>
              <strong>{generationMessage || 'Designing campaign blueprints...'}</strong>
              <span>Analyzing selected revenue lanes, targets, messaging hooks, and campaign goals.</span>
            </div>
          </div>
          {renderGenerationCards(3, [
            'Selecting audience',
            'Defining message angle',
            'Setting campaign goals'
          ])}
        </>
      )}

      {/* Campaign Cards */}
      {proposedCampaigns.length > 0 && (
        <div className="mission-grid">
          {proposedCampaigns.map(campaign => {
            const isSelected = selectedCampaigns.includes(campaign.id);

            return (
              <div
                key={campaign.id}
                className={`mission-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCampaignToggle(campaign.id)}
                style={{
                  paddingBottom: '1.5rem',
                  border: isSelected ? '2px solid #0070ba' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isSelected ? '0 0 15px rgba(0, 112, 186, 0.3)' : 'none',
                  cursor: 'pointer'
                }}
              >
                <div className="card-content">
                  <div className="mission-icon">
                    {isSelected ? <CheckCircle size={28} color="#0070ba" /> : <Rocket size={28} />}
                  </div>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>{campaign.title}</h3>
                  <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: '#475569' }}>{campaign.description}</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: '#64748b' }}>
                    <div><strong style={{ color: '#334155' }}>Lane:</strong> {campaign.laneTitle}</div>
                    <div><strong style={{ color: '#334155' }}>Duration:</strong> {campaign.duration}</div>
                    <div><strong style={{ color: '#334155' }}>Target:</strong> {campaign.targetSegment}</div>
                    <div><strong style={{ color: '#334155' }}>Channel:</strong> {campaign.channel}</div>
                    <div><strong style={{ color: '#334155' }}>Hook:</strong> {campaign.messagingHook}</div>
                    <div><strong style={{ color: '#334155' }}>Goal:</strong> {campaign.goalMetric}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {proposedCampaigns.length > 0 && isLoading && generationMessage && (
        <div className="generation-status-panel neural-pulse">
          <RefreshCw size={18} />
          <div>
            <strong>{generationMessage}</strong>
            <span>Building one action-lane set per campaign so the next step is scoped and reviewable.</span>
          </div>
        </div>
      )}

      {proposedCampaigns.length > 0 && isLoading && generationMessage && renderGenerationCards(
        Math.min(Math.max(selectedCampaigns.length, 3), 6),
        [
          'Designing email lane',
          'Designing LinkedIn DM lane',
          'Designing content lane',
          'Planning warm intros',
          'Mapping follow-ups',
          'Preparing action wizard'
        ]
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('intent')} disabled={isLoading}>Back</button>
        <button
          className="onboarding-btn-primary"
          onClick={designActionLanes}
          disabled={selectedCampaigns.length === 0 || isLoading}
          style={{ opacity: selectedCampaigns.length === 0 || isLoading ? 0.5 : 1, cursor: selectedCampaigns.length === 0 || isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading && generationMessage ? 'Designing Action Lanes...' : 'Activate Campaigns'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderAnalysis = () => {
    const selectedLanesCount = selectedLanes.length;
    const activeCampaignsCount = selectedCampaigns.length;

    return (
      <div className="onboarding-content">
        <div className="onboarding-header">
          <div className="phase-indicator">Phase 06: Strategic Analysis</div>
          <h1>Intelligence Report: Strategy Primed.</h1>
          <p>I've synthesized your network, expertise, and target campaigns.</p>
        </div>

        <div className="analysis-summary">
          <div className="leverage-card">
            <div className="leverage-icon"><Zap size={24} /></div>
            <div className="leverage-text">
              <h4>Strategy Architecture Complete</h4>
              <p>We are launching <strong>{activeCampaignsCount} campaigns</strong> across <strong>{selectedLanesCount} revenue lanes</strong>.</p>
            </div>
          </div>

          <div className="stats-mini-grid">
            <div className="stat-mini"><div className="val">{connectionCount || 14640}</div><div className="lbl">Network Nodes</div></div>
            <div className="stat-mini"><div className="val">{uploadedAssets.length}</div><div className="lbl">IP Assets</div></div>
          </div>
          
          {comprehensiveSynthesis && (
            <div className="impression-card" style={{ marginTop: '1rem', padding: '1.25rem', border: '1px solid rgba(0, 112, 186, 0.2)' }}>
              <h4 style={{ color: '#0070ba', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Comprehensive Synthesis</h4>
              <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#475569' }}>{comprehensiveSynthesis}</p>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('campaigns')}>Back</button>
          <button className="onboarding-btn-primary" onClick={designActionLanes} disabled={isLoading}>
            {isLoading && generationMessage ? 'Designing...' : 'Design Tactical Arsenal'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderActionLanes = () => {
    const activeCampaigns = selectedActionLaneCampaigns;
    const safeCampaignIndex = Math.min(currentActionLaneCampaignIndex, Math.max(activeCampaigns.length - 1, 0));
    const currentCampaign = activeCampaigns[safeCampaignIndex];
    const campaignLanes = currentCampaign
      ? proposedActionLanes.filter(lane => laneSupportsCampaign(lane, currentCampaign.id))
      : [];
    const selectedCampaignLaneCount = campaignLanes.filter(lane => selectedActionLanes.includes(lane.id)).length;
    const isFirstCampaign = safeCampaignIndex === 0;
    const isLastCampaign = safeCampaignIndex >= activeCampaigns.length - 1;

    return (
      <div className="onboarding-content">
        <div className="onboarding-header">
          <div className="phase-indicator">
            Phase 06a: Tactical Arsenal {activeCampaigns.length > 0 ? `- Campaign ${safeCampaignIndex + 1} of ${activeCampaigns.length}` : ''}
          </div>
          <h1>Choose action lanes for this campaign.</h1>
          <p>Approve the execution motions for one campaign before moving to the next.</p>
        </div>

        {currentCampaign && (
          <div className="campaign-lane-context">
            <div className="campaign-lane-kicker">{currentCampaign.laneTitle || 'Campaign'}</div>
            <h3>{currentCampaign.title}</h3>
            <p>{currentCampaign.description}</p>
            <div className="campaign-lane-meta">
              <span>Target: {currentCampaign.targetSegment || 'Defined audience'}</span>
              <span>Goal: {currentCampaign.goalMetric || 'Qualified progress'}</span>
              <span>Selected lanes: {selectedCampaignLaneCount}</span>
            </div>
          </div>
        )}

        {currentCampaign && campaignLanes.length === 0 && (
          <div className="empty-tactical-state">
            No action lanes were generated for this campaign yet. Go back and regenerate the tactical arsenal.
          </div>
        )}

        <div className="mission-grid campaign-lane-grid" style={{ marginBottom: '2rem' }}>
          {campaignLanes.map(lane => {
            const isSelected = selectedActionLanes.includes(lane.id);
            return (
              <div 
                key={lane.id} 
                className={`mission-card ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  if (isSelected) setSelectedActionLanes(prev => prev.filter(id => id !== lane.id));
                  else setSelectedActionLanes(prev => [...prev, lane.id]);
                }}
              >
                <div className="card-content">
                  <div className="mission-icon">
                    {isSelected ? <CheckCircle size={28} color="#0070ba" /> : <Layers size={28} />}
                  </div>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>{lane.title}</h3>
                  <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: '#475569' }}>{lane.description}</p>

                  <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'left' }}>
                    <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                      {lane.tactics?.map((t: string, i: number) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="onboarding-footer">
          <button
            className="onboarding-btn-secondary"
            onClick={() => {
              if (isFirstCampaign) setCurrentStep('campaigns');
              else setCurrentActionLaneCampaignIndex(safeCampaignIndex - 1);
            }}
          >
            {isFirstCampaign ? 'Back' : 'Previous Campaign'}
          </button>
          <button 
            className="onboarding-btn-primary" 
            onClick={() => {
              if (isLastCampaign) setCurrentStep(user ? 'connectivity' : 'account');
              else setCurrentActionLaneCampaignIndex(safeCampaignIndex + 1);
            }}
            disabled={!currentCampaign || selectedCampaignLaneCount === 0}
          >
            {isLastCampaign ? (user ? 'Connectivity Hub' : 'Create Workspace') : 'Next Campaign'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderConnectivity = () => {
    const activeLanes = proposedActionLanes.filter(l => selectedActionLanes.includes(l.id));
    const requiredConnectors = Array.from(new Set(activeLanes.flatMap(l => l.requiredConnectors || [])));
    
    return (
      <div className="onboarding-content">
        <div className="onboarding-header">
          <div className="phase-indicator">Phase 06b: Connectivity Hub</div>
          <h1>Establish your data bridges.</h1>
          <p>To fuel your selected tactical arsenal, we need to establish these technical connections.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', margin: '2rem 0', width: '100%', maxWidth: '500px' }}>
          {requiredConnectors.includes('outlook') && (
            <div className={`connector-status-card ${emailReadiness?.ready && emailReadiness.connector?.providerName === 'outlook' ? 'connected' : ''}`}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div className="connector-status-icon">
                  {emailReadiness?.ready && emailReadiness.connector?.providerName === 'outlook' ? <CheckCircle size={24} /> : <Mail size={24} />}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Outlook Connection</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Powers: {activeLanes.filter(l => l.requiredConnectors?.includes('outlook')).map(l => l.title).join(', ')}
                  </p>
                </div>
              </div>

              {!(emailReadiness?.ready && emailReadiness.connector?.providerName === 'outlook') ? (
                <button 
                  className="onboarding-btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', border: '1px solid #0070ba' }}
                  onClick={handleOutlookConnect}
                  disabled={isAnyWorking}
                >
                  {isAnyWorking ? 'Connecting...' : 'Connect Outlook'}
                </button>
              ) : (
                <div className="connector-live-state">
                  <CheckCircle size={16} />
                  <p><strong>Connected:</strong> {emailReadiness.connector?.connectorName || emailReadiness.connector?.providerDisplayName || 'Outlook is ready'}</p>
                </div>
              )}
            </div>
          )}

          {requiredConnectors.includes('gmail') && (
            <div className={`connector-status-card ${emailReadiness?.ready && emailReadiness.connector?.providerName === 'gmail' ? 'connected' : ''}`}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div className="connector-status-icon">
                  {emailReadiness?.ready && emailReadiness.connector?.providerName === 'gmail' ? <CheckCircle size={24} /> : <Mail size={24} />}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Gmail Connection</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Powers: {activeLanes.filter(l => l.requiredConnectors?.includes('gmail')).map(l => l.title).join(', ')}
                  </p>
                </div>
              </div>

              {!(emailReadiness?.ready && emailReadiness.connector?.providerName === 'gmail') ? (
                <button 
                  className="onboarding-btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', border: '1px solid #ea4335' }}
                  onClick={onConnectGmail}
                  disabled={isAnyWorking}
                >
                  {isAnyWorking ? 'Connecting...' : 'Connect Gmail'}
                </button>
              ) : (
                <div className="connector-live-state">
                  <CheckCircle size={16} color="#10b981" />
                  <p><strong>Connected:</strong> {emailReadiness.connector?.connectorName || emailReadiness.connector?.providerDisplayName || 'Gmail is ready'}</p>
                </div>
              )}
            </div>
          )}

          {requiredConnectors.includes('linkedin') && (
            <div className="mission-card" style={{ padding: '1.5rem', width: '100%', opacity: 0.8 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(0, 112, 186, 0.05)', color: '#64748b' }}>
                  <Network size={24} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#64748b' }}>LinkedIn Data Bridge</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Detected via browser session.</p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                    <CheckCircle size={16} /> Active
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('actionLanes')}>Back</button>
          <button 
            className="onboarding-btn-primary" 
            onClick={() => setCurrentStep('activation')}
            disabled={
              (requiredConnectors.includes('outlook') && !(emailReadiness?.ready && emailReadiness.connector?.providerName === 'outlook')) ||
              (requiredConnectors.includes('gmail') && !(emailReadiness?.ready && emailReadiness.connector?.providerName === 'gmail'))
            }
          >
            Ignition: Initialize Action Engine <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderSignedInIndicator = () => {
    if (!user) return null;

    return (
      <div className="signed-in-indicator">
        {user.avatarUrl ? (
          <img className="signed-in-avatar" src={user.avatarUrl} alt="" />
        ) : (
          <div className="signed-in-status-dot" />
        )}
        <span className="signed-in-label">
          Signed in as <strong>{user.fullName || user.email}</strong>
        </span>
      </div>
    );
  };

  const renderAccountGate = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 01: Identity</div>
        <h1>Initialize your system.</h1>
        <p>Create a secure workspace account to begin the network audit and strategy generation flow.</p>
      </div>

      <div className="account-gate-card">
        {user ? (
          <div className="account-signed-in-view">
            <div className="account-gate-summary" style={{ borderBottom: 'none', marginBottom: 0 }}>
              <div className="connector-status-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <h3>Account Ready</h3>
                <p>You are signed in as <strong>{user.fullName || user.email}</strong>. Your private workspace is secure and ready for discovery.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="account-gate-summary">
              <div className="connector-status-icon">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3>Secure Orchestration</h3>
                <p>Your data is processed within your private workspace. We'll start by mapping your professional topography.</p>
              </div>
            </div>

        <form
          className="account-gate-form"
          onSubmit={(event) => {
            event.preventDefault();
            void continueAfterAccountCreation();
          }}
        >
          <label>
            Name
            <input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Your name" />
          </label>
          <label>
            Email
            <input value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="you@example.com" type="email" />
          </label>
          <label>
            Password
            <input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} type="password" />
          </label>
          <button className="onboarding-btn-primary account-submit" disabled={isAnyWorking || !accountEmail || !accountPassword} type="submit">
            {isAnyWorking ? 'Creating Workspace...' : 'Create Account and Continue'} <ArrowRight size={18} />
          </button>
          <button className="onboarding-btn-secondary account-test-user" disabled={isAnyWorking} onClick={useGeneratedAccount} type="button">
            Generate Test User
          </button>

          <div className="auth-divider">
            <span>or sign in with</span>
          </div>

          <div className="social-auth-grid">
            <button 
              className="google-button" 
              type="button"
              onClick={() => {
                const url = new URL(`${api.baseUrl}/auth/google`);
                if (guestSessionId) url.searchParams.append('guestSessionId', guestSessionId);
                window.location.href = url.toString();
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
              Google
            </button>
            <button 
              className="microsoft-button" 
              type="button"
              onClick={() => {
                const url = new URL(`${api.baseUrl}/auth/microsoft`);
                if (guestSessionId) url.searchParams.append('guestSessionId', guestSessionId);
                window.location.href = url.toString();
              }}
            >
              <span aria-hidden="true" className="microsoft-mark">
                <span /><span /><span /><span />
              </span>
              Microsoft
            </button>
            <button 
              className="linkedin-button" 
              type="button"
              onClick={() => {
                const url = new URL(`${api.baseUrl}/auth/linkedin`);
                if (guestSessionId) url.searchParams.append('guestSessionId', guestSessionId);
                window.location.href = url.toString();
              }}
            >
              <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="" />
              LinkedIn
            </button>
          </div>
        </form>
          </>
        )}
      </div>

      <div className="cycle-note">
        <Target size={18} />
        <div>
          <strong>Next step</strong>
          <span>We'll perform a deep audit of your network leverage to identify high-signal opportunities.</span>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('briefing')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => void continueAfterAccountCreation()} disabled={isAnyWorking || !accountEmail || !accountPassword}>
          Secure Account & Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderActivation = () => {
    const activeCampaigns = proposedCampaigns.filter(c => selectedCampaigns.includes(c.id));
    const campaignLaneGroups = activeCampaigns.map(campaign => ({
      campaign,
      lanes: proposedActionLanes.filter(lane => selectedActionLanes.includes(lane.id) && laneSupportsCampaign(lane, campaign.id)),
    })).filter(group => group.lanes.length > 0);
    const firstGroup = campaignLaneGroups[0];
    const selectedGroup = activationSelection
      ? campaignLaneGroups.find(group => group.campaign.id === activationSelection.campaignId)
      : null;
    const selectedLane = activationSelection && selectedGroup
      ? selectedGroup.lanes.find(lane => lane.id === activationSelection.laneId)
      : null;

    const beginActionCycle = (campaignId?: string, laneId?: string, source: 'guided' | 'manual' = 'guided') => {
      const campaign = campaignLaneGroups.find(group => group.campaign.id === campaignId)?.campaign || firstGroup?.campaign;
      const lane = campaignLaneGroups.find(group => group.campaign.id === campaign?.id)?.lanes.find(candidate => candidate.id === laneId)
        || campaignLaneGroups.find(group => group.campaign.id === campaign?.id)?.lanes[0];
      if (!campaign || !lane) return;

      setActivationSelection({ campaignId: campaign.id, laneId: lane.id, source });
      setWizardMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `First action cycle queued for ${campaign.title} via ${lane.title}. Next, the engine should explain why this lane is the right starting point, identify the first concrete action, and ask for approval before anything is sent or logged.`,
      }]);
    };
    
    return (
      <div className="onboarding-content">
        <div className="onboarding-header">
          <div className="phase-indicator">Phase 07: Activation</div>
          <h1>Action cycles are ready.</h1>
          <p>Review the approved campaign lanes, then start the first cycle when you are ready. Nothing is sent without approval.</p>
        </div>

        <div className="activation-command-center">
          <button
            type="button"
            className={`cycle-play-button ${activationSelection?.source === 'guided' ? 'engaged' : ''}`}
            onClick={() => beginActionCycle()}
            disabled={!firstGroup}
          >
            <span className="cycle-ring" />
            <PlayCircle size={44} />
          </button>
          <div>
            <h3>Start First Action Cycle</h3>
            <p>Let the engine choose the first campaign lane, explain the choice, and stage the first action for your approval.</p>
          </div>
        </div>

        {selectedLane && selectedGroup && (
          <div className="cycle-selection-panel">
            <div className="campaign-lane-kicker">Queued action cycle</div>
            <h3>{selectedGroup.campaign.title}</h3>
            <p>
              Starting with <strong>{selectedLane.title}</strong>. The next screen should generate the first concrete action,
              explain the rationale, and keep you in the approval loop.
            </p>
          </div>
        )}

        <div className="activation-campaign-list">
          {campaignLaneGroups.map(({ campaign, lanes }, campaignIndex) => (
            <div key={campaign.id} className="activation-campaign-card">
              <div className="activation-campaign-header">
                <div>
                  <div className="campaign-lane-kicker">Campaign {campaignIndex + 1}</div>
                  <h3>{campaign.title}</h3>
                  <p>{campaign.description}</p>
                </div>
                <span>{lanes.length} lanes</span>
              </div>

              <div className="activation-lane-list">
                {lanes.map(lane => {
                  const isQueued = activationSelection?.campaignId === campaign.id && activationSelection?.laneId === lane.id;
                  return (
                    <button
                      key={lane.id}
                      type="button"
                      className={`activation-lane-row ${isQueued ? 'queued' : ''}`}
                      onClick={() => beginActionCycle(campaign.id, lane.id, 'manual')}
                    >
                      <Layers size={18} />
                      <span>
                        <strong>{lane.title}</strong>
                        <small>{lane.description}</small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {campaignLaneGroups.length === 0 && (
            <div className="empty-tactical-state">
              No approved action lanes are available yet. Go back and approve at least one action lane before activation.
            </div>
          )}
        </div>

        <div className="cycle-note">
          <Target size={18} />
          <div>
            <strong>Next step</strong>
            <span>After you choose a starting lane, I will introduce the workspace and carry this selected action cycle forward.</span>
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('connectivity')}>Back</button>
          <button className="onboarding-btn-primary" onClick={() => setCurrentStep('workspaceIntro')} disabled={campaignLaneGroups.length === 0 || !activationSelection}>
            Continue to Workspace Intro <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderWorkspaceIntro = () => {
    const selectedCampaign = activationSelection
      ? proposedCampaigns.find(campaign => campaign.id === activationSelection.campaignId)
      : null;
    const selectedLane = activationSelection
      ? proposedActionLanes.find(lane => lane.id === activationSelection.laneId)
      : null;

    return (
      <div className="onboarding-content">
        <div className="onboarding-header">
          <div className="phase-indicator">Phase 08: Workspace Handoff</div>
          <h1>Your workspace is about to open.</h1>
          <p>The strategy, connector state, and selected first action cycle will continue into the workspace canvas.</p>
        </div>

        <div className="workspace-intro-panel">
          <div className="workspace-intro-row">
            <div className="connector-status-icon"><Target size={24} /></div>
            <div>
              <div className="campaign-lane-kicker">First action cycle</div>
              <h3>{selectedCampaign?.title || 'Selected campaign'}</h3>
              <p>{selectedLane ? `Starting through ${selectedLane.title}.` : 'The first selected lane will be staged for review.'}</p>
            </div>
          </div>
          <div className="workspace-intro-grid">
            <div><strong>{selectedCampaigns.length}</strong><span>Campaigns</span></div>
            <div><strong>{selectedActionLanes.length}</strong><span>Action lanes</span></div>
            <div><strong>{emailReadiness?.ready ? 'Ready' : 'Pending'}</strong><span>Outlook</span></div>
          </div>
        </div>

        <div className="cycle-note">
          <Zap size={18} />
          <div>
            <strong>What changes next</strong>
            <span>The wizard becomes your operating workspace: canvas on top, Conductor beneath it, and the first action cycle ready for explanation and approval.</span>
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('activation')}>Back</button>
          <button className="onboarding-btn-primary" onClick={handoffToWorkspace}>
            Open Workspace <Rocket size={18} />
          </button>
        </div>
      </div>
    );
  };

  const renderWorkspaceHandoff = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Opening Workspace</div>
        <h1>Carrying your plan forward.</h1>
        <p>I am saving the strategy, preparing the first action cycle, and opening the workspace canvas.</p>
      </div>

      <div className="handoff-progress">
        <div className="handoff-orbit">
          <span />
          <Rocket size={38} />
        </div>
        <div className="handoff-steps">
          <div><CheckCircle size={16} /> Strategy saved</div>
          <div><CheckCircle size={16} /> Connectors attached</div>
          <div><RefreshCw size={16} className={isHandingOff ? 'spin' : ''} /> Opening first action cycle</div>
        </div>
      </div>
    </div>
  );

  const renderWelcome = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Welcome to Opportunity OS.</h1>
        <p>Your intelligence partner for high-impact outreach.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}><Rocket size={80} color="#3b82f6" /></div>
      <div className="onboarding-footer">
        <div /><button className="onboarding-btn-primary" onClick={() => setCurrentStep('briefing')}>Initialize System <ArrowRight size={18} /></button>
      </div>
    </div>
  );

  const renderDevHarness = () => {
    if (import.meta.env['MODE'] === 'production') return null;
    
    return (
      <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 9999 }}>
        <button 
          onClick={() => setShowDevHarness(!showDevHarness)}
          style={{ 
            background: '#1e293b', 
            color: 'white', 
            border: 'none', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Zap size={20} />
        </button>
        
        {showDevHarness && (
          <div style={{ 
            position: 'absolute', 
            bottom: '50px', 
            left: '0', 
            background: '#1e293b', 
            padding: '1rem', 
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            width: '240px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <h4 style={{ color: '#94a3b8', margin: '0 0 0.5rem 0', fontSize: '0.8rem', textTransform: 'uppercase' }}>Dev Harness</h4>
            <button onClick={seedState} style={{ padding: '0.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
              Seed Full Strategy
            </button>
            <div style={{ borderTop: '1px solid #334155', margin: '0.5rem 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            {(['briefing', 'intent', 'relationships', 'knowledge', 'campaigns', 'analysis', 'account', 'connectivity', 'activation', 'workspaceIntro', 'workspaceHandoff'] as Step[]).map(s => (
                <button 
                  key={s} 
                  onClick={() => setCurrentStep(s)}
                  style={{ 
                    padding: '0.4rem', 
                    background: currentStep === s ? '#0f172a' : '#334155', 
                    color: '#475569', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="onboarding-overlay">
      {renderDevHarness()}
      <div className="onboarding-background-mesh" />
      <div className="onboarding-wizard-container">
        <div className="onboarding-progress-header">
          <div className="progress-dots">
            {['briefing', 'account', 'relationships', 'discovery-sensing', 'discovery-synthesis', 'knowledge', 'intent', 'campaigns', 'actionLanes', 'connectivity', 'activation', 'workspaceIntro', 'workspaceHandoff'].map((s) => (
              <div key={s} className={`dot ${currentStep === s ? 'active' : ''}`} />
            ))}
          </div>
          {renderSignedInIndicator()}
        </div>
        
        {currentStep === 'briefing' && renderBriefing()}
        {currentStep === 'intent' && renderIntent()}
        {currentStep === 'relationships' && renderRelationships()}
        {currentStep === 'discovery-sensing' && renderProviderSpotlight()}
        {currentStep === 'discovery-synthesis' && renderDiscoverySynthesis()}
        {currentStep === 'knowledge' && renderKnowledge()}
        {currentStep === 'campaigns' && renderCampaigns()}
        {currentStep === 'actionLanes' && renderActionLanes()}
        {currentStep === 'account' && renderAccountGate()}
        {currentStep === 'connectivity' && renderConnectivity()}
        {currentStep === 'activation' && renderActivation()}
        {currentStep === 'workspaceIntro' && renderWorkspaceIntro()}
        {currentStep === 'workspaceHandoff' && renderWorkspaceHandoff()}
        {currentStep === 'welcome' && renderWelcome()}

        {currentStep !== 'welcome' && (
          <div className={`conductor-window persistent ${isConductorExpanded ? 'expanded' : ''}`}>
            <div className="window-header">
              <div className="status-indicator"><div className="pulse-dot" /><span>Conductor Online</span></div>
              <button 
                className="conductor-expand-btn"
                onClick={() => setIsConductorExpanded(!isConductorExpanded)}
                title={isConductorExpanded ? "Minimize" : "Expand AI Window"}
              >
                {isConductorExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
            <div className="window-body">
              <ConductorChat
                messages={wizardMessages.map(m => ({
                  id: m.id || crypto.randomUUID(),
                  role: m.role === 'conductor' ? 'assistant' : m.role,
                  text: m.content || m.text
                }))}
                isWorking={isConductorThinking}
                onSend={handleConductorSend}
                variant="wizard"
                placeholder="Talk to the Conductor..."
              />
            </div>
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef}
          style={{ display: 'none' }} 
          accept=".zip,.pdf"
          onChange={currentStep === 'knowledge' ? handleKnowledgeSelect : handleFileSelect}
        />
      </div>
    </div>
  );
});
