import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Users, Target, Rocket, ArrowRight, Upload, CheckCircle, Database } from 'lucide-react';
import { connectionService } from '../../connections/services/connection.service';
import { ImportSource } from '../../connections/types/connection.types';
import { importWebSocketService, ImportEvent } from '../../connections/services/importWebSocket.service';
import './OnboardingWizard.css';

interface OnboardingWizardProps {
  onComplete: () => void;
  user: { id: string; email: string };
}

type Step = 'welcome' | 'archive' | 'strategy' | 'goal' | 'import' | 'reveal';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = memo(({ onComplete, user }) => {
  console.log('🏗️ OnboardingWizard MOUNTED/RE-RENDERED');
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
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
  

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      importWebSocketService.disconnect();
    };
  }, []);

  const goals = [
    { id: 'sales', title: 'Drive More Sales', description: 'Find new customers and manage high-value deals in your network.' },
    { id: 'partners', title: 'Find Strategic Partners', description: 'Identify key stakeholders at companies you want to partner with.' },
    { id: 'recruiting', title: 'Talent Acquisition', description: 'Leverage your 1st-degree connections to find top engineering or sales talent.' },
    { id: 'career', title: 'Career Acceleration', description: 'Map out your next move by finding leaders at your target companies.' },
  ];


  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    window.alert('Selection detected in browser!');
    const file = event.target.files?.[0];
    console.log('📂 handleFileSelect TRIGGERED:', file?.name, file?.type, file?.size);
    if (!file) {
      console.warn('⚠️ No file in event.target.files');
      return;
    }

    setUploadStatus('uploading');
    console.log('⏳ Status set to UPLOADING');
    
    try {
      console.log('🔍 Validating file...');
      const validation = connectionService.validateFile(file);
      if (!validation.isValid) {
        console.error('❌ Validation failed:', validation.error);
        setUploadStatus('error');
        alert(`Validation Error: ${validation.error}`);
        return;
      }

      const importRequest = {
        name: `Onboarding Import - ${new Date().toLocaleDateString()}`,
        source: ImportSource.LINKEDIN_EXPORT,
        description: `Initial network import for ${user.email}`
      };
      
      console.log('🚀 Sending to server...');
      if (file.name.endsWith('.zip')) {
        console.log('📦 Identified as ZIP, calling ingestZip');
        const result = await connectionService.ingestZip(importRequest, file);
        console.log('✅ ZIP Ingest successful response:', result);
        setStrategicDraft(result.strategicDraft);
        
        // We still subscribe to the connections part of the import in the background
        importWebSocketService.subscribe(result.importId, (event: ImportEvent) => {
          console.log('📡 Import WebSocket event:', event.type);
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
              targetCompanies: Math.max(5, Math.floor(event.data.importedRecords * 0.3)),
              highValueContacts: Math.max(10, Math.floor(event.data.importedRecords * 0.15))
            });
          }
        });

        setUploadStatus('success');
        setCurrentStep('strategy');
        console.log('⏭️ Transitioned to STRATEGY step');
        return;
      }

      console.log('📄 Identified as CSV/Other, calling createImport');
      const importData = await connectionService.createImport(importRequest, file, user.id);
      console.log('✅ Import created:', importData.id);
      setUploadStatus('processing');

      // Subscribe to real-time updates
      importWebSocketService.subscribe(importData.id, (event: ImportEvent) => {
        console.log('📡 CSV Import WebSocket event:', event.type);
        if (event.type === 'progress') {
          setImportProgress({
            percentage: event.data.percentage || 0,
            processedRecords: event.data.processedRecords || 0,
            totalRecords: event.data.totalRecords || 0,
            importedRecords: event.data.importedRecords || 0,
            duplicateRecords: event.data.duplicateRecords || 0,
          });
        } else if (event.type === 'completed') {
          console.log('🏁 CSV Import completed');
          setFinalAnalysis({
            total: event.data.totalRecords,
            imported: event.data.importedRecords,
            duplicates: event.data.duplicateRecords,
            targetCompanies: Math.max(5, Math.floor(event.data.importedRecords * 0.3)),
            highValueContacts: Math.max(10, Math.floor(event.data.importedRecords * 0.15))
          });
          setUploadStatus('success');
          setCurrentStep('reveal');
        } else if (event.type === 'error') {
          console.error('❌ Import WebSocket error');
          setUploadStatus('error');
          alert('Import failed in background. Please try again.');
        }
      });

    } catch (error) {
      console.error('❌ CRITICAL ERROR in handleFileSelect:', error);
      setUploadStatus('error');
      alert(`Critical error: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`);
    } finally {
      console.log('🏁 handleFileSelect FINISHED');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderWelcome = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Welcome to the Future of Strategy.</h1>
        <p>Opportunity OS transforms your professional network into a high-precision execution engine.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
        <Rocket size={80} color="#3b82f6" />
      </div>
      <div className="onboarding-footer">
        <div />
        <button className="onboarding-btn-primary" onClick={() => setCurrentStep('archive')}>
          Initialize System <ArrowRight size={18} style={{ marginLeft: 8 }} />
        </button>
      </div>
    </div>
  );

  const renderGoal = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Define Your Mission.</h1>
        <p>Choose your primary focus to help the Conductor prioritize your opportunities.</p>
      </div>
      <div className="goal-selection">
        {goals.map(goal => (
          <div 
            key={goal.id} 
            className={`goal-card ${selectedGoal === goal.id ? 'active' : ''}`}
            onClick={() => setSelectedGoal(goal.id)}
          >
            <h3>{goal.title}</h3>
            <p>{goal.description}</p>
          </div>
        ))}
      </div>
      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('welcome')}>Back</button>
        <button 
          className="onboarding-btn-primary" 
          disabled={!selectedGoal} 
          onClick={() => setCurrentStep('import')}
        >
          Next Step <ArrowRight size={18} style={{ marginLeft: 8 }} />
        </button>
      </div>
    </div>
  );

  const renderArchiveUpload = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Inject Your Professional Portfolio.</h1>
        <p>Upload your full LinkedIn data archive (ZIP). I'll audit your history to extract your core offerings and strategic posture.</p>
      </div>
      
      <div className={`import-zone ${uploadStatus === 'uploading' || uploadStatus === 'processing' ? 'uploading' : ''} ${uploadStatus === 'error' ? 'error' : ''}`} style={{ position: 'relative' }}>

        <div className="import-icon">
          {uploadStatus === 'idle' || uploadStatus === 'error' ? <Rocket size={32} /> : <Upload className="animate-spin" size={32} />}
        </div>
        
        {uploadStatus === 'idle' ? (
          <>
            <h3>Click to upload LinkedInDataExport.zip</h3>
            <p>Your history is the foundation of our strategy.</p>
          </>
        ) : uploadStatus === 'error' ? (
          <>
            <h3 style={{ color: '#ef4444' }}>Analysis Failed</h3>
            <p>Something went wrong during the audit. Please try again or skip to manual setup.</p>
          </>
        ) : (
          <div className="progress-container">
            <h3>{uploadStatus === 'uploading' ? 'Analyzing Archive...' : 'Auditing History...'}</h3>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${importProgress.percentage || 25}%` }} />
            </div>
            <p style={{ marginTop: 10, fontSize: '0.9rem', color: '#94a3b8' }}>Extracting offerings and identifying themes...</p>
          </div>
        )}
      </div>



      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('welcome')} disabled={uploadStatus !== 'idle'}>Back</button>
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('goal')} disabled={uploadStatus !== 'idle'}>Skip archive</button>
      </div>
    </div>
  );

  const renderImport = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Initialize Your Network.</h1>
        <p>Now, let's map your territory. Upload your LinkedIn Connections CSV to populate the Canvas.</p>
      </div>
      
      <div className={`import-zone ${uploadStatus !== 'idle' ? 'uploading' : ''}`} style={{ position: 'relative' }}>

        <div className="import-icon">
          {uploadStatus === 'idle' ? <Users size={32} /> : <Upload className="animate-spin" size={32} />}
        </div>
        
        {uploadStatus === 'idle' ? (
          <>
            <h3>Click to upload Connections.csv</h3>
            <p>Your connections are the nodes of your execution engine.</p>
          </>
        ) : (
          <div className="progress-container">
            <h3>{uploadStatus === 'uploading' ? 'Uploading File...' : 'Analyzing Network...'}</h3>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${importProgress.percentage}%` }} />
            </div>
            <div className="progress-stats">
              <span>{importProgress.processedRecords} of {importProgress.totalRecords} records</span>
              <span>{importProgress.percentage}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('goal')} disabled={uploadStatus !== 'idle'}>Back</button>
        <button className="onboarding-btn-secondary" onClick={() => onComplete()} disabled={uploadStatus !== 'idle'}>Skip network map</button>
      </div>
    </div>
  );

  const renderStrategy = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Your Strategic Engine is Active.</h1>
        <p>I've audited your LinkedIn profile and mapped out your core expertise. How does this look?</p>
      </div>

      <div className="strategy-review">
        <section className="strategy-section">
          <div className="section-header">
            <Users size={20} color="#3b82f6" />
            <h3>Proposed Posture</h3>
          </div>
          <div className="posture-card">
            <p>{strategicDraft?.posture?.text}</p>
            <div className="objectives-list">
              {strategicDraft?.posture?.objectives?.map((obj: string, i: number) => (
                <span key={i} className="objective-tag">{obj}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="strategy-section">
          <div className="section-header">
            <Rocket size={20} color="#10b981" />
            <h3>Identified Offerings</h3>
          </div>
          <div className="offerings-grid">
            {strategicDraft?.offerings?.map((off: any, i: number) => (
              <div key={i} className="mini-offering-card">
                <h4>{off.title}</h4>
                <p>{off.description}</p>
                <span className="type-badge">{off.type}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="strategy-section">
          <div className="section-header">
            <Database size={20} color="#f59e0b" />
            <h3>Strategic Theses</h3>
          </div>
          <div className="theses-list">
            {strategicDraft?.theses?.map((thesis: any, i: number) => (
              <div key={i} className="mini-thesis-card">
                <h4>{thesis.title}</h4>
                <p>{thesis.content.substring(0, 100)}...</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('archive')}>Back</button>
        <button 
          className="onboarding-btn-primary" 
          onClick={() => setCurrentStep('goal')}
        >
          Confirm Strategy <ArrowRight size={18} style={{ marginLeft: 8 }} />
        </button>
      </div>
    </div>
  );

  const renderReveal = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>System Armed.</h1>
        <p>We've analyzed your network. You're ready to execute.</p>
      </div>
      
      <div className="analysis-grid">
        <div className="analysis-card">
          <div className="value">{finalAnalysis?.imported || 0}</div>
          <div className="label">New Connections</div>
        </div>
        <div className="analysis-card">
          <div className="value">{finalAnalysis?.targetCompanies || 0}</div>
          <div className="label">Target Companies</div>
        </div>
        <div className="analysis-card">
          <div className="value">{finalAnalysis?.highValueContacts || 0}</div>
          <div className="label">High-Value Contacts</div>
        </div>
        <div className="analysis-card">
          <div className="value">{finalAnalysis?.duplicates || 0}</div>
          <div className="label">Sync Deduplicated</div>
        </div>
      </div>

      <div className="onboarding-footer" style={{ marginTop: '40px' }}>
        <div />
        <button className="onboarding-btn-primary" onClick={() => onComplete()}>
          Enter Workspace <CheckCircle size={18} style={{ marginLeft: 8 }} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-background-mesh" />
      <div className="onboarding-card">
        <div className="onboarding-steps">
          <div className={`onboarding-step-dot ${currentStep === 'welcome' ? 'active' : ''}`} />
          <div className={`onboarding-step-dot ${currentStep === 'archive' ? 'active' : ''}`} />
          <div className={`onboarding-step-dot ${currentStep === 'strategy' ? 'active' : ''}`} />
          <div className={`onboarding-step-dot ${currentStep === 'goal' ? 'active' : ''}`} />
          <div className={`onboarding-step-dot ${currentStep === 'import' ? 'active' : ''}`} />
          <div className={`onboarding-step-dot ${currentStep === 'reveal' ? 'active' : ''}`} />
        </div>
        
        {currentStep === 'welcome' && renderWelcome()}
        {currentStep === 'archive' && renderArchiveUpload()}
        {currentStep === 'strategy' && renderStrategy()}
        {currentStep === 'goal' && renderGoal()}
        {currentStep === 'import' && renderImport()}
        {currentStep === 'reveal' && renderReveal()}

        {/* PERMANENT STABLE INPUTS - Hidden but always present in DOM */}
        {currentStep === 'archive' && (
          <input 
            type="file" 
            style={{
              position: 'absolute',
              top: '200px', // Roughly over the drop zone
              left: '50px',
              right: '50px',
              height: '300px',
              opacity: 0.3,
              cursor: 'pointer',
              zIndex: 100,
              background: 'rgba(255, 0, 0, 0.2)'
            }} 
            accept=".zip"
            onChange={handleFileSelect}
            disabled={uploadStatus !== 'idle' && uploadStatus !== 'error'}
          />
        )}
        {currentStep === 'import' && (
          <input 
            type="file" 
            style={{
              position: 'absolute',
              top: '200px',
              left: '50px',
              right: '50px',
              height: '300px',
              opacity: 0.3,
              cursor: 'pointer',
              zIndex: 100,
              background: 'rgba(255, 0, 0, 0.2)'
            }} 
            accept=".csv"
            onChange={handleFileSelect}
            disabled={uploadStatus !== 'idle'}
          />
        )}
      </div>
    </div>
  );
});
