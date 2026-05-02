import React from 'react';
import { Users, Globe, Network, CheckCircle, Zap, ArrowRight, Upload } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const SensingHubPhase: React.FC = () => {
  const { 
    connectedProviders, setConnectedProviders, 
    setCurrentStep, startSequentialSensing, uploadStatus, 
    onConnectLinkedIn, nextStep 
  } = useOnboarding();

  const handleToggle = (id: string) => {
    setConnectedProviders((prev: string[]) => 
      prev.includes(id) ? prev.filter((p: string) => p !== id) : [...prev, id]
    );
  };

  const PROVIDERS = [
    { id: 'linkedin', name: 'LinkedIn', icon: Users },
    { id: 'google', name: 'Google', icon: Globe },
    { id: 'microsoft', name: 'Outlook', icon: Network },
  ];

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 02: Sensing Hub</div>
        <h1>Connect your professional ecosystems.</h1>
        <p>Select the platforms where your professional topography is densest. I will sense these ecosystems to map your relationship graph.</p>
      </div>

      <div className="provider-selection-container">
        <div className="provider-grid">
          {PROVIDERS.map((provider) => {
            const isSelected = connectedProviders.includes(provider.id);
            const Icon = provider.icon;
            
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

        {connectedProviders.includes('linkedin') && (
          <div className="manual-upload-section animate-in">
            <div className="auth-divider">
              <span>Legacy Fallback</span>
            </div>
            <p className="fallback-hint">If direct sensing is restricted, drop your LinkedIn ZIP here.</p>
            <div className={`drop-zone compact ${uploadStatus === 'success' ? 'success' : ''}`}>
              <Upload size={18} />
              <span>{uploadStatus === 'success' ? 'ZIP Processed' : 'Drop LinkedIn ZIP'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('account')}>Back</button>
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
