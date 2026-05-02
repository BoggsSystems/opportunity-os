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
  user?: { id: string; email: string; fullName?: string; avatarUrl?: string };
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

type Step = 'briefing' | 'account' | 'intent' | 'relationships' | 'discovery-synthesis' | 'knowledge' | 'campaigns' | 'analysis' | 'actionLanes' | 'connectivity' | 'channels' | 'activation' | 'workspaceIntro' | 'workspaceHandoff' | 'welcome';

const CONTINUE_ONBOARDING_AFTER_AUTH_KEY = 'opportunity-os:continue-onboarding-after-auth';
const WORKSPACE_ACTIVATION_PAYLOAD_KEY = 'opportunity-os:workspace-activation-payload';
const DEFAULT_SIGNUP_PASSWORD = 'Password123!';

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
  const [isLoading, setIsLoading] = useState(false);

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
  ]);

  const handleDiscoveryNext = () => {
    if (spotlightData && spotlightIndex < spotlightData.length - 1) {
      const nextIndex = spotlightIndex + 1;
      setSpotlightIndex(nextIndex);
      const nextProvider = spotlightData[nextIndex];

      // Handle Google transition or sub-steps
      if (nextProvider.id === 'google') {
        setGoogleSubStep('drive');
        setConductorMessages(prev => [
          ...prev,
          { id: Date.now().toString(), text: "Moving to your Google discovery. Let's look at your Google Drive assets first.", type: 'ai' }
        ]);
      } else {
        setGoogleSubStep(null);
        setConductorMessages(prev => [
          ...prev,
          { id: Date.now().toString(), text: nextProvider.conductorSpeech, type: 'ai' }
        ]);
      }
    } else {
      // Final Synthesis
      setCurrentStep('discovery-synthesis' as any);
      setConductorMessages(prev => [
        ...prev,
        { id: Date.now().toString(), text: "Discovery complete across all ecosystems. I've synthesized your unified professional topography. Let's review your combined strategic leverage.", type: 'ai' }
      ]);
    }
  };

  const handleGoogleSubNext = () => {
    if (googleSubStep === 'drive') {
      setGoogleSubStep('gmail');
      setConductorMessages(prev => [
        ...prev,
        { id: Date.now().toString(), text: "Google Drive scan complete. Now, mapping your Gmail relationship intensity.", type: 'ai' }
      ]);
    } else if (googleSubStep === 'gmail') {
      setGoogleSubStep('calendar');
      setConductorMessages(prev => [
        ...prev,
        { id: Date.now().toString(), text: "Gmail mapping complete. Finally, let's sync your Calendar moments to identify upcoming strategic opportunities.", type: 'ai' }
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

      setSensingLogs(prev => [
        ...prev,
        { id: `insight-${id}`, message: randomInsight, type: 'insight' }
      ]);

      setProviderStatuses(prev => ({
        ...prev,
        [id]: { status: 'completed', result: `Verified: ${Math.floor(Math.random() * 50) + 10} Strategic Nodes` }
      }));

      setSensingLogs(prev => [
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
      const providerId = spotlights[0].id;
      if (providerId === 'google') {
        setGoogleSubStep('drive');
        setConductorMessages(prev => [
          ...prev,
          { id: Date.now().toString(), text: "Entering your Google ecosystem. Let's start with your Google Drive. I'm looking for assets that define your expertise—your book, your recent resumes, or strategic whitepapers.", type: 'ai' }
        ]);
      } else {
        setConductorMessages(prev => [
          ...prev,
          { id: Date.now().toString(), text: spotlights[0].conductorSpeech, type: 'ai' }
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
          {spotlightData.map((p, idx) => (
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
                  onClick={onConnectOutlook}
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
            {['briefing', 'account', 'relationships', 'knowledge', 'intent', 'campaigns', 'actionLanes', 'connectivity', 'activation', 'workspaceIntro', 'workspaceHandoff'].map((s) => (
              <div key={s} className={`dot ${currentStep === s ? 'active' : ''}`} />
            ))}
          </div>
          {renderSignedInIndicator()}
        </div>
        
        {currentStep === 'briefing' && renderBriefing()}
        {currentStep === 'intent' && renderIntent()}
        {currentStep === 'relationships' && renderRelationships()}
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
