import React from 'react';
import { Rocket, RefreshCw } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const WorkspaceHandoffPhase: React.FC = () => {
  const { onComplete, isLoading } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 11: Workspace Handoff</div>
        <h1>Your workspace is about to open.</h1>
        <p>The strategy, connector state, and selected first action cycle will continue into the workspace canvas.</p>
      </div>

      <div className="handoff-card animate-in">
        <div className="handoff-status">
          <RefreshCw size={24} className="spin" />
          <span>Synchronizing strategy to workspace...</span>
        </div>
        <div className="handoff-progress-bar">
          <div className="fill" style={{ width: '80%' }}></div>
        </div>
      </div>

      <div className="onboarding-footer">
        <div />
        <button 
          className="onboarding-btn-primary" 
          onClick={onComplete}
          disabled={isLoading}
        >
          Open Workspace <Rocket size={18} />
        </button>
      </div>
    </div>
  );
};
