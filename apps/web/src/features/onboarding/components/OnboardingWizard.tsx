import React, { memo } from 'react';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { OnboardingProvider, useOnboarding, Step } from './OnboardingContext';
import { PhaseSwitcher } from './PhaseSwitcher';
import { ConductorChat } from '../../../components/conductor/ConductorChat';
import { ApiClient } from '../../../lib/api';
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

export const OnboardingWizardContent: React.FC = () => {
  const { 
    currentStep, isConductorExpanded, setIsConductorExpanded,
    wizardMessages, isConductorThinking, handleConductorSend,
    user
  } = useOnboarding();

  const renderSignedInIndicator = () => {
    if (!user) {
      return (
        <button 
          className="dev-reset-btn" 
          onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
          title="Reset Onboarding State"
        >
          <RotateCcw size={14} /> <span>Reset</span>
        </button>
      );
    }
    return (
      <div className="indicator-group">
        <div className="signed-in-indicator">
          <div className="signed-in-status-dot" />
          <span className="signed-in-label">
            Signed in as <strong>{user.fullName || user.email}</strong>
          </span>
        </div>
        <button 
          className="dev-reset-btn" 
          onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
          title="Reset Onboarding State"
        >
          <RotateCcw size={14} /> <span>Reset</span>
        </button>
      </div>
    );
  };

  const dots: Step[] = [
    'briefing', 'account', 'relationships', 'discovery-sensing', 
    'discovery-synthesis', 'knowledge', 'intent', 'campaigns', 
    'actionLanes', 'connectivity', 'activation', 'workspaceIntro', 'workspaceHandoff'
  ];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-background-mesh" />
      <div className="onboarding-wizard-container">
        <div className="onboarding-progress-header">
          <div className="progress-dots">
            {dots.map((s) => (
              <div key={s} className={`dot ${currentStep === s ? 'active' : ''}`} />
            ))}
          </div>
          {renderSignedInIndicator()}
        </div>
        
        <PhaseSwitcher />

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
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const OnboardingWizard: React.FC<OnboardingWizardProps> = memo((props) => {
  return (
    <OnboardingProvider {...props}>
      <OnboardingWizardContent />
    </OnboardingProvider>
  );
});
