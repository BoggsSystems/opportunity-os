import React, { useState, useRef, useEffect } from 'react';
import { Users, Target, Rocket, ArrowRight, Upload, CheckCircle, Database } from 'lucide-react';
import { connectionService } from '../../connections/services/connection.service';
import { ImportSource } from '../../connections/types/connection.types';
import { importWebSocketService, ImportEvent } from '../../connections/services/importWebSocket.service';
import './OnboardingWizard.css';

interface OnboardingWizardProps {
  onComplete: () => void;
  user: { id: string; email: string };
}

type Step = 'welcome' | 'goal' | 'import' | 'reveal';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, user }) => {
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    
    try {
      const validation = connectionService.validateFile(file);
      if (!validation.isValid) {
        setUploadStatus('error');
        alert(validation.error);
        return;
      }

      const importRequest = {
        name: `Onboarding Import - ${new Date().toLocaleDateString()}`,
        source: ImportSource.LINKEDIN_EXPORT,
        description: `Initial network import for ${user.email}`
      };

      const importData = await connectionService.createImport(importRequest, file, user.id);
      setUploadStatus('processing');

      // Subscribe to real-time updates
      importWebSocketService.subscribe(importData.id, (event: ImportEvent) => {
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
            // Mocked insights for the "Aha!" moment
            targetCompanies: Math.max(5, Math.floor(event.data.importedRecords * 0.3)),
            highValueContacts: Math.max(10, Math.floor(event.data.importedRecords * 0.15))
          });
          setUploadStatus('success');
          setCurrentStep('reveal');
        } else if (event.type === 'error') {
          setUploadStatus('error');
          alert('Import failed. Please try again.');
        }
      });

    } catch (error) {
      console.error('Import failed:', error);
      setUploadStatus('error');
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
        <button className="onboarding-btn-primary" onClick={() => setCurrentStep('goal')}>
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

  const renderImport = () => (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Turbocharge Your Workspace.</h1>
        <p>Upload your LinkedIn Connections CSV to map your territory.</p>
      </div>
      
      <div 
        className={`import-zone ${uploadStatus !== 'idle' ? 'uploading' : ''}`}
        onClick={() => uploadStatus === 'idle' && fileInputRef.current?.click()}
      >
        <div className="import-icon">
          {uploadStatus === 'idle' ? <Users size={32} /> : <Upload className="animate-spin" size={32} />}
        </div>
        
        {uploadStatus === 'idle' ? (
          <>
            <h3>Click to upload Connections.csv</h3>
            <p>Your data stays private and secure.</p>
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

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".csv"
        onChange={handleFileSelect}
      />

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => setCurrentStep('goal')} disabled={uploadStatus !== 'idle'}>Back</button>
        <button className="onboarding-btn-secondary" onClick={() => onComplete()} disabled={uploadStatus !== 'idle'}>Skip for now</button>
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
          <div className={`onboarding-step-dot ${currentStep === 'goal' ? 'active' : ''}`} />
          <div className={`onboarding-step-dot ${currentStep === 'import' ? 'active' : ''}`} />
          <div className={`onboarding-step-dot ${currentStep === 'reveal' ? 'active' : ''}`} />
        </div>
        
        {currentStep === 'welcome' && renderWelcome()}
        {currentStep === 'goal' && renderGoal()}
        {currentStep === 'import' && renderImport()}
        {currentStep === 'reveal' && renderReveal()}
      </div>
    </div>
  );
};
