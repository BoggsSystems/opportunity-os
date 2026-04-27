import React, { useState, useRef, useEffect, memo } from 'react';
import { 
  Users, Target, Rocket, ArrowRight, Upload, CheckCircle, 
  Database, ShieldCheck, Award, Eye, PenTool, Briefcase, 
  Mail, Search, RefreshCw, Zap, ChevronRight 
} from 'lucide-react';
import { connectionService } from '../../connections/services/connection.service';
import { ImportSource } from '../../connections/types/connection.types';
import { importWebSocketService, ImportEvent } from '../../connections/services/importWebSocket.service';
import { AuthScreen } from '../../../components/auth/AuthScreen';
import { useUIStore } from '../../../store';
import './OnboardingWizard.css';

interface OnboardingWizardProps {
  onComplete: () => void;
  user?: { id: string; email: string };
  isWorking?: boolean;
  notice?: any;
  onAuth?: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, initialStrategy?: any) => Promise<void>;
}

type Step = 'briefing' | 'intent' | 'relationships' | 'knowledge' | 'analysis' | 'activation' | 'welcome';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = memo(({ onComplete, user, isWorking, notice, onAuth }) => {
  console.log('🏗️ OnboardingWizard MOUNTED/RE-RENDERED');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState<Step>('briefing');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [importProgress, setImportProgress] = useState({
    percentage: 0,
    processedRecords: 0,
    totalRecords: 0,
    importedRecords: 0,
    duplicateRecords: 0,
  });
  const [finalAnalysis, setFinalAnalysis] = useState<any>(null);
  const [strategicDraft, setStrategicDraft] = useState<any>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [connectionCount, setConnectionCount] = useState<number>(0);
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  
  // Conductor Orchestration State
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [conductorMessage, setConductorMessage] = useState<string | null>(null);
  const [isConductorThinking, setIsConductorThinking] = useState(false);
  
  const { setPodiumMode } = useUIStore();

  const missions = [
    { id: 'clients', title: 'Scale New Clients', description: 'Consultants and founders looking for direct revenue growth.', icon: Users },
    { id: 'ip', title: 'Monetize My Book / IP', description: 'Authors and creators looking to sell their knowledge.', icon: Award },
    { id: 'dream', title: 'Target Dream Companies', description: 'Map your "Way In" to specific targets via your network.', icon: Target },
    { id: 'hidden', title: 'Surface Hidden Roles', description: 'Find "Hiring Clusters" before roles are even posted.', icon: Eye },
    { id: 'partners', title: 'Build Strategic Partnerships', description: 'Find collaborators, investors, or advisors.', icon: Briefcase },
    { id: 'authority', title: 'Establish Thought Leadership', description: 'Build your audience and authority through assets.', icon: Rocket },
  ];

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      importWebSocketService.disconnect();
    };
  }, []);

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

  const handleMissionSelect = (missionId: string) => {
    setExpandedCard(missionId);
    setIsConductorThinking(true);
    
    // Simulate Conductor responding
    setTimeout(() => {
      const mission = missions.find(m => m.id === missionId);
      setConductorMessage(`Excellent choice. Since we're focusing on ${mission?.title.toLowerCase()}, let's talk about your strategic 'Hook'. Are you looking for high-velocity outreach or deep-dive personalization?`);
      setIsConductorThinking(false);
    }, 1200);
  };

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
      setUploadStatus('processing'); // Wait for WebSocket to set success
    } catch (error) {
      console.error('❌ Error in handleFileSelect:', error);
      setUploadStatus('error');
    }
  };

  const renderBriefing = () => (
    <div className="onboarding-content briefing-step">
      <div className="onboarding-header">
        <div className="conductor-badge">
          <div className="badge-pulse" />
          <span>The Conductor</span>
        </div>
        <h1>Increase and Improve Your Outreach.</h1>
        <p>I am your strategic execution partner. Let's turn your network and expertise into high-quality conversations.</p>
      </div>

      <div className="cycle-diagram-container">
        <div className="cycle-diagram">
          <svg className="cycle-connectors" viewBox="0 0 400 400">
            <defs>
              <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path d="M 200,80 Q 300,100 320,200" className="connector-path-bg" />
            <path d="M 320,200 Q 300,300 200,320" className="connector-path-bg" />
            <path d="M 200,320 Q 100,300 80,200" className="connector-path-bg" />
            <path d="M 80,200 Q 100,100 200,80" className="connector-path-bg" />
            <path d="M 200,80 Q 300,100 320,200" className="connector-path-glow path-1" />
            <path d="M 320,200 Q 300,300 200,320" className="connector-path-glow path-2" />
            <path d="M 200,320 Q 100,300 80,200" className="connector-path-glow path-3" />
            <path d="M 80,200 Q 100,100 200,80" className="connector-path-glow path-4" />
          </svg>

          <div className="cycle-core">
            <div className="core-inner"><div className="core-hexa"><div className="core-icon">C</div></div></div>
            <div className="core-glow" />
          </div>

          <div className="cycle-node node-intelligence">
            <div className="node-icon"><Database size={24} /></div>
            <div className="node-content"><h4>1. Intelligence</h4><p>Gathering global market insights and data.</p></div>
          </div>
          <div className="cycle-node node-strategy">
            <div className="node-icon"><Target size={24} /></div>
            <div className="node-content"><h4>2. Strategy</h4><p>Synthesizing intelligence into actionable plans.</p></div>
          </div>
          <div className="cycle-node node-execution">
            <div className="node-icon"><Rocket size={24} /></div>
            <div className="node-content"><h4>3. Execution</h4><p>Deploying resources to achieve strategic objectives.</p></div>
          </div>
        </div>
      </div>

      <div className="onboarding-footer">
        <div />
        <button className="onboarding-btn-primary glow-btn" onClick={() => setCurrentStep('intent')}>
          Begin Mission <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderIntent = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>What is your primary mission today?</h1>
        <p>I will tailor your sensing and orchestration to this objective.</p>
      </div>

      <div className={`mission-grid ${expandedCard ? 'has-expanded' : ''}`}>
        {missions.map(mission => {
          const isExpanded = expandedCard === mission.id;
          const isHidden = expandedCard && !isExpanded;
          const Icon = mission.icon;
          
          return (
            <div 
              key={mission.id} 
              className={`mission-card ${isExpanded ? 'expanded' : ''} ${isHidden ? 'hidden' : ''}`}
              onClick={() => !expandedCard && handleMissionSelect(mission.id)}
            >
              <div className="card-content">
                <div className="mission-icon"><Icon size={32} /></div>
                <h3>{mission.title}</h3>
                <p>{mission.description}</p>
                
                {isExpanded && (
                  <div className="conductor-chat-section">
                    <div className="conductor-message">
                      {isConductorThinking ? <div className="typing-indicator"><span></span><span></span><span></span></div> : <p>{conductorMessage}</p>}
                    </div>
                    {!isConductorThinking && (
                      <div className="chat-actions">
                        <button className="chat-btn" onClick={() => setCurrentStep('relationships')}>High Velocity <ArrowRight size={14} /></button>
                        <button className="chat-btn" onClick={() => setCurrentStep('relationships')}>Deep Dive <ArrowRight size={14} /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {!expandedCard && (
        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('briefing')}>Back</button>
          <div />
        </div>
      )}
    </div>
  );

  const renderRelationships = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 03: Relationships</div>
        <h1>Who do you know?</h1>
        <p>Upload your LinkedIn ZIP archive. I'll map your network topography and identify high-value nodes.</p>
      </div>

      <div className="single-bucket-container">
        <div className="context-bucket large">
          <div className="bucket-icon"><Users size={48} /></div>
          <h3>Relationship Source</h3>
          <p>LinkedIn Data Export (ZIP)</p>
          <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
            <Upload size={32} />
            <span>Drop LinkedIn ZIP here</span>
            <p className="drop-hint">I'll map your network in seconds</p>
          </div>
        </div>
      </div>

      {uploadStatus !== 'idle' && (
        <div className="sensing-feedback">
          <div className="sensing-status">
            <RefreshCw className="spin" size={18} />
            <span>Sensing: {uploadStatus === 'uploading' ? 'Ingesting network...' : `Mapping ${connectionCount || 'nodes'}...`}</span>
          </div>
          <div className="sensing-progress">
             <div className="progress-bar-fill" style={{ width: `${importProgress.percentage || 25}%` }} />
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('intent')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => setCurrentStep('knowledge')} disabled={uploadStatus !== 'success' && uploadStatus !== 'idle'}>
          Confirm Relationships <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderKnowledge = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 04: Knowledge</div>
        <h1>What have you built?</h1>
        <p>Upload your book PDF, decks, or portfolio. I'll extract your core frameworks to ground our outreach.</p>
      </div>

      <div className="single-bucket-container">
        <div className="context-bucket large">
          <div className="bucket-icon"><Database size={48} /></div>
          <h3>Knowledge Source</h3>
          <p>Book PDF, Decks, Portfolio</p>
          <div className="drop-zone secondary">
            <Upload size={32} />
            <span>Drop Strategic Assets here</span>
            <p className="drop-hint">PDF, PPTX, or Keynote</p>
          </div>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('relationships')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => setCurrentStep('analysis')}>
          Confirm Knowledge <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderAnalysis = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Intelligence Report: Strategy Primed.</h1>
        <p>I've synthesized your network and your expertise.</p>
      </div>

      <div className="analysis-summary">
        <div className="leverage-card">
          <div className="leverage-icon"><Zap size={24} /></div>
          <div className="leverage-text">
            <h4>Primary Leverage Identified</h4>
            <p>Your "AI-Native Engineering" framework aligns with <strong>850 CTOs</strong> in your network.</p>
          </div>
        </div>

        <div className="stats-mini-grid">
          <div className="stat-mini"><div className="val">{connectionCount || 14640}</div><div className="lbl">Network Nodes</div></div>
          <div className="stat-mini"><div className="val">42</div><div className="lbl">Target Clusters</div></div>
        </div>
      </div>

      {!user ? (
        <div className="signup-integration">
          <h3>Claim this Strategy</h3>
          <p>Create your secure vault to initialize the workspace and campaign.</p>
          <AuthScreen onAuth={onAuth} isWorking={isWorking} notice={notice} initialStrategy={strategicDraft} />
        </div>
      ) : (
        <div className="onboarding-footer">
          <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('knowledge')}>Back</button>
          <button className="onboarding-btn-primary" onClick={() => setCurrentStep('activation')}>
            Generate Campaign <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );

  const renderActivation = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Campaign Ready. Let's start the outreach.</h1>
        <p>I've drafted your first mission based on your book mission.</p>
      </div>

      <div className="campaign-preview-card">
        <div className="preview-header"><Target size={20} /><h4>Mission: Monetize AI-Native IP</h4></div>
        <div className="preview-body">
          <div className="preview-prospect"><div className="avatar" /><div className="details"><strong>Alex Chen</strong><span>CTO at TechScale</span></div></div>
          <div className="preview-draft">
            <p>"Hey Alex, I noticed TechScale is scaling its AI-native engineering team. I recently published a framework on the 'New Physics of Velocity' that might save you some headaches..."</p>
          </div>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('analysis')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => onComplete()}>
          Initialize Workspace <Rocket size={18} />
        </button>
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

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-background-mesh" />
      <div className="onboarding-card">
        <div className="onboarding-steps">
          {['briefing', 'intent', 'relationships', 'knowledge', 'analysis', 'activation'].map((s) => (
            <div key={s} className={`onboarding-step-dot ${currentStep === s ? 'active' : ''}`} />
          ))}
        </div>
        
        {currentStep === 'briefing' && renderBriefing()}
        {currentStep === 'intent' && renderIntent()}
        {currentStep === 'relationships' && renderRelationships()}
        {currentStep === 'knowledge' && renderKnowledge()}
        {currentStep === 'analysis' && renderAnalysis()}
        {currentStep === 'activation' && renderActivation()}
        {currentStep === 'welcome' && renderWelcome()}

        <input 
          type="file" 
          ref={fileInputRef}
          style={{ display: 'none' }} 
          accept=".zip,.pdf"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
});
