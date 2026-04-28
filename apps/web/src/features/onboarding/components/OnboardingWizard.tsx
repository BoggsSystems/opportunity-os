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
import { ApiClient } from '../../../lib/api';
import { ConductorChat } from '../../../components/conductor/ConductorChat';
import './OnboardingWizard.css';

interface OnboardingWizardProps {
  onComplete: () => void;
  user?: { id: string; email: string };
  isWorking?: boolean;
  notice?: any;
  api: ApiClient;
  onAuth?: (mode: 'login' | 'signup', email: string, password: string, fullName?: string, initialStrategy?: any) => Promise<void>;
}

type Step = 'briefing' | 'intent' | 'relationships' | 'knowledge' | 'analysis' | 'activation' | 'welcome';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = memo(({ onComplete, user, isWorking, notice, api, onAuth }) => {
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
  const [knowledgeResult, setKnowledgeResult] = useState<{
    title: string;
    interpretation: string;
    summary: string;
    frameworks: string[];
  } | null>(null);
  
  // Conductor Orchestration State
  const [selectedLanes, setSelectedLanes] = useState<string[]>([]);
  const [conductorMessage, setConductorMessage] = useState<string | null>(null);
  const [isConductorThinking, setIsConductorThinking] = useState(false);
  const [refinementMode, setRefinementMode] = useState<'none' | 'pivot' | 'confirmed'>('none');
  const [pivotText, setPivotText] = useState('');
  const [wizardMessages, setWizardMessages] = useState<any[]>([]);
  const [guestSessionId] = useState(() => crypto.randomUUID());
  
  const { setPodiumMode } = useUIStore();

  const [proposedOfferings, setProposedOfferings] = useState<any[]>([]);

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
      try {
        setWizardMessages(prev => [...prev, { 
          id: crypto.randomUUID(), 
          role: 'assistant', 
          text: "Analyzing your network topography and IP frameworks to generate proposed Revenue Lanes..." 
        }]);
        const res = await api.proposeOfferings({
          networkCount: connectionCount || strategicDraft?.connectionCount || 14640,
          networkPosture: strategicDraft?.posture?.text || '',
          frameworks: knowledgeResult?.frameworks || [],
          interpretation: knowledgeResult?.interpretation || ''
        });
        if (res.success && res.offerings?.length) {
          setProposedOfferings(res.offerings);
          setWizardMessages(prev => [...prev, { 
            id: crypto.randomUUID(), 
            role: 'assistant', 
            text: "I have analyzed your data and proposed the following Revenue Lanes. Which ones should we focus on?" 
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
      }
      setIsConductorThinking(false);
      return;
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
        guestSessionId: !user ? guestSessionId : undefined,
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

  // Step-specific Narration Trigger
  useEffect(() => {
    if (currentStep !== 'welcome' && currentStep !== 'briefing') {
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
        const res = await api.refineOfferings({
          currentLanes: proposedOfferings,
          feedback: text,
          networkCount: connectionCount || strategicDraft?.connectionCount || 14640,
          networkPosture: strategicDraft?.posture?.text || '',
          frameworks: knowledgeResult?.frameworks || [],
          interpretation: knowledgeResult?.interpretation || ''
        });
        
        if (res.success && res.offerings?.length) {
          setProposedOfferings(res.offerings);
          setWizardMessages(prev => [...prev, { 
            id: crypto.randomUUID(), 
            role: 'assistant', 
            text: "I have updated the Revenue Lanes based on your feedback. Which one should we execute?" 
          }]);
        } else {
          setWizardMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: "Failed to refine lanes. Please try again." }]);
        }
      } else {
        console.log('🤖 CONSOLE: Calling api.converse...', {
          guestSessionId: !user ? guestSessionId : 'authenticated',
          currentStep
        });
        
        const response = await api.converse({
          message: text,
          guestSessionId: (!user ? guestSessionId : undefined) as string | undefined,
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
        setWizardMessages([{ 
          role: 'conductor', 
          content: 'This is my initial interpretation of your network leverage. Does this resonate, or should we refine the focus?' 
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

  const nextStep = (step: Step) => {
    setUploadStatus('idle');
    setCurrentStep(step);
    window.scrollTo(0, 0);
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
        setWizardMessages([{ 
          role: 'conductor', 
          content: 'This is my initial interpretation of your network leverage. Does this resonate, or should we refine the focus?' 
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
      // For Phase 4, we use the onboarding/knowledge endpoint (anonymous or auth handled by backend)
      const result = await connectionService.auditKnowledge(file);
      console.log('📚 Knowledge interpreted:', result);
      
      setKnowledgeResult(result);
      
      // Update strategic draft with new frameworks
      setStrategicDraft((prev: any) => ({
        ...prev,
        theses: [
          ...(prev?.theses || []),
          { title: "Asset-Grounded Outreach", content: result.interpretation }
        ]
      }));
      
      setUploadStatus('success');
    } catch (error) {
      console.error('❌ Error in handleKnowledgeSelect:', error);
      setUploadStatus('error');
    }
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

      <div className="onboarding-footer">
        <div />
        <button className="onboarding-btn-primary glow-btn" onClick={() => nextStep('relationships')}>
          Begin Orchestration <ArrowRight size={18} />
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
      
      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('knowledge')}>Back</button>
        <button 
          className="onboarding-btn-primary" 
          onClick={() => setCurrentStep('analysis')}
          disabled={selectedLanes.length === 0}
          style={{ opacity: selectedLanes.length === 0 ? 0.5 : 1, cursor: selectedLanes.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          Confirm Selected Lanes <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderRelationships = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 02: Relationships</div>
        <h1>Who do you know?</h1>
        <p>Upload your LinkedIn ZIP archive. I'll map your network topography and identify high-value nodes.</p>
      </div>

      {uploadStatus !== 'success' && (
        <div className="single-bucket-container">
          <div className="context-bucket large">
            <div className="bucket-icon"><Users size={48} /></div>
            <h3>Relationship Source</h3>
            <p>LinkedIn Data Export (ZIP)</p>
            <div className={`drop-zone ${uploadStatus === 'uploading' ? 'neural-pulse' : ''}`} onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} />
              <span>{uploadStatus === 'uploading' ? 'Ingesting network...' : 'Drop LinkedIn ZIP here'}</span>
              <p className="drop-hint">I'll map your network in seconds</p>
            </div>
          </div>
        </div>
      )}

      {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
        <div className="sensing-feedback">
          <div className="sensing-status">
            <RefreshCw className="spin" size={18} />
            <span>Sensing: {
              currentStep === 'knowledge' 
                ? 'Extracting frameworks...' 
                : (uploadStatus === 'uploading' ? 'Ingesting network...' : `Mapping ${connectionCount || 'nodes'}...`)
            }</span>
          </div>
          <div className="sensing-progress">
             <div className="progress-bar-fill" style={{ width: `${importProgress.percentage}%` }} />
          </div>
        </div>
      )}
      
      {uploadStatus === 'success' && strategicDraft && (
        <div className="impression-card">
          <div className="impression-hero">
            {strategicDraft.posture?.preferredTone === 'Strategic' ? 'The Strategic Architect' : 'The Growth Catalyst'}
          </div>
          <div className="impression-text">
            {strategicDraft.posture?.text || "Your network reveals a high-density cluster of decision-makers in your target industry."}
          </div>
          <div className="impression-vitals">
            <div className="vital-badge">
              <Users size={14} style={{ marginRight: '6px' }} />
              {connectionCount || strategicDraft.connectionCount || 14640} Connections
            </div>
            <div className="vital-badge">
              <ShieldCheck size={14} style={{ marginRight: '6px' }} />
              High Trust
            </div>
            <div className="vital-badge">
              <Zap size={14} style={{ marginRight: '6px' }} />
              84% Match
            </div>
          </div>
          
          {strategicDraft.theses && strategicDraft.theses.length > 0 && (
            <div className="thesis-preview">
              <h4>Primary Theses Identified</h4>
              {strategicDraft.theses.slice(0, 2).map((thesis: any, i: number) => (
                <div key={i} className="thesis-item">
                  <CheckCircle size={16} color="#0070ba" />
                  <span>{thesis.title}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('briefing')}>Back</button>
        <button 
          className={`onboarding-btn-primary ${uploadStatus === 'success' ? 'neural-pulse' : ''}`} 
          onClick={() => nextStep('knowledge')} 
          disabled={uploadStatus !== 'success'}
        >
          {uploadStatus === 'success' ? 'Ground this in Knowledge' : 'Awaiting Map...'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderKnowledge = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 03: Knowledge</div>
        <h1>What have you built?</h1>
        <p>Upload your book PDF, decks, or portfolio. I'll extract your core frameworks to ground our outreach.</p>
      </div>

      {uploadStatus !== 'success' && (
        <div className="single-bucket-container">
          <div className="context-bucket large">
            <div className="bucket-icon"><Database size={48} /></div>
            <h3>Knowledge Source</h3>
            <p>Book PDF, Decks, Portfolio</p>
            <div className={`drop-zone secondary ${uploadStatus === 'uploading' ? 'neural-pulse' : ''}`} onClick={() => fileInputRef.current?.click()}>
              <Upload size={32} />
              <span>{uploadStatus === 'uploading' ? 'Extrating frameworks...' : 'Drop Strategic Assets here'}</span>
              <p className="drop-hint">PDF, PPTX, or Keynote</p>
            </div>
          </div>
        </div>
      )}

      {uploadStatus === 'success' && currentStep === 'knowledge' && (
        <div className="impression-card">
          <div className="impression-hero">Knowledge Synthesis Complete</div>
          <div className="impression-text">
            {knowledgeResult?.summary || "I've extracted your core frameworks. These will serve as the \"Strategic Hook\" for our outreach campaigns."}
          </div>
          
          {knowledgeResult?.interpretation && (
             <div className="impression-interpretation" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '0.5rem', color: '#0070ba' }}>Strategic Interpretation</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>{knowledgeResult.interpretation}</p>
             </div>
          )}

          <div className="impression-vitals" style={{ marginTop: '1.5rem' }}>
            <div className="vital-badge">{knowledgeResult?.frameworks?.length || 3} Frameworks Detected</div>
            <div className="vital-badge">Strategic Leverage Map</div>
          </div>
          
          <div className="thesis-preview">
            <h4>Extracted IP Components</h4>
            {knowledgeResult?.frameworks?.length ? (
              knowledgeResult.frameworks.map((framework, idx) => (
                <div key={idx} className="thesis-item"><CheckCircle size={16} color="#0070ba" /> <span>{framework}</span></div>
              ))
            ) : (
              <>
                <div className="thesis-item"><CheckCircle size={16} color="#0070ba" /> <span>Physics of Velocity</span></div>
                <div className="thesis-item"><CheckCircle size={16} color="#0070ba" /> <span>Strategic Leverage Point</span></div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('relationships')}>Back</button>
        <button 
          className={`onboarding-btn-primary ${uploadStatus === 'success' ? 'neural-pulse' : ''}`} 
          onClick={() => nextStep('intent')}
          disabled={uploadStatus !== 'success'}
        >
          {uploadStatus === 'success' ? 'Determine Mission' : 'Extracting IP...'} <ArrowRight size={18} />
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
          <AuthScreen apiBaseUrl={api.baseUrl} onAuth={onAuth ?? (async () => {})} isWorking={isWorking ?? false} notice={notice} initialStrategy={strategicDraft} />
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
      <div className="onboarding-wizard-container">
        <div className="onboarding-progress-header">
          <div className="progress-dots">
            {['briefing', 'intent', 'relationships', 'knowledge', 'analysis', 'activation'].map((s) => (
              <div key={s} className={`dot ${currentStep === s ? 'active' : ''}`} />
            ))}
          </div>
        </div>
        
        {currentStep === 'briefing' && renderBriefing()}
        {currentStep === 'intent' && renderIntent()}
        {currentStep === 'relationships' && renderRelationships()}
        {currentStep === 'knowledge' && renderKnowledge()}
        {currentStep === 'analysis' && renderAnalysis()}
        {currentStep === 'activation' && renderActivation()}
        {currentStep === 'welcome' && renderWelcome()}

        {currentStep !== 'welcome' && (
          <div className="conductor-window persistent">
            <div className="window-header">
              <div className="status-indicator"><div className="pulse-dot" /><span>Conductor Online</span></div>
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
