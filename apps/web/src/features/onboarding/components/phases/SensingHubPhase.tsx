import React from 'react';
import { Users, Globe, Network, CheckCircle, Zap, ArrowRight, Upload } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const SensingHubPhase: React.FC = () => {
  const { 
    connectedProviders, setConnectedProviders, providerStatuses,
    setCurrentStep, startSequentialSensing, uploadStatus, 
    onConnectLinkedIn, onConnectGmail, onConnectOutlook,
    onConnectHubSpot, onConnectShopify, onConnectSalesforce,
    nextStep 
  } = useOnboarding();

  const handleToggle = (id: string) => {
    setConnectedProviders((prev: string[]) => 
      prev.includes(id) ? prev.filter((p: string) => p !== id) : [...prev, id]
    );
  };

  const PROVIDERS = [
    { 
      id: 'linkedin', 
      name: 'LinkedIn', 
      icon: 'https://cdn-icons-png.flaticon.com/512/174/174857.png',
      onConnect: onConnectLinkedIn 
    },
    { 
      id: 'google', 
      name: 'Google', 
      icon: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
      onConnect: onConnectGmail 
    },
    { 
      id: 'microsoft', 
      name: 'Outlook', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg', // Placeholder for branded mark
      isMicrosoft: true,
      onConnect: onConnectOutlook 
    },
    { 
      id: 'hubspot', 
      name: 'HubSpot', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/HubSpot_Logo.svg',
      onConnect: () => onConnectHubSpot?.('') 
    },
    { 
      id: 'shopify', 
      name: 'Shopify', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg',
      onConnect: () => onConnectShopify?.('', '') 
    },
    { 
      id: 'salesforce', 
      name: 'Salesforce', 
      icon: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg',
      onConnect: () => onConnectSalesforce?.('') 
    },
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
          {PROVIDERS.map((provider: any) => {
            const isSelected = connectedProviders.includes(provider.id);
            const status = providerStatuses[provider.id];
            const isSyncing = status?.status === 'syncing';
            const isCompleted = status?.status === 'completed';
            
            return (
              <div 
                key={provider.id} 
                className={`provider-card ${isSelected ? 'selected' : ''} ${isSyncing ? 'syncing' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => {
                  if (provider.onConnect) {
                    void provider.onConnect();
                  } else {
                    handleToggle(provider.id);
                  }
                }}
              >
                <div className="provider-icon-wrapper">
                  {provider.isMicrosoft ? (
                    <span aria-hidden="true" className="microsoft-mark compact">
                      <span /><span /><span /><span />
                    </span>
                  ) : (
                    <img src={provider.icon} alt="" className="provider-brand-icon" />
                  )}
                  {isSelected && <div className="provider-check"><CheckCircle size={10} /></div>}
                </div>
                <div className="provider-info">
                  <h4>{provider.name}</h4>
                  {isSyncing ? (
                    <div className="provider-status-tag syncing">
                      <Zap size={10} className="spin" /> <span>Connecting...</span>
                    </div>
                  ) : isCompleted ? (
                    <div className="provider-status-tag completed">
                      <CheckCircle size={10} /> <span>Connected</span>
                    </div>
                  ) : isSelected ? (
                    <div className="provider-status-tag pending">
                      <Zap size={10} /> <span>Ready to Connect</span>
                    </div>
                  ) : null}
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
