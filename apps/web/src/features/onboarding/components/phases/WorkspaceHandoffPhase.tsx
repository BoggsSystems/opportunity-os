import React from 'react';
import { Rocket, RefreshCw } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const WorkspaceHandoffPhase: React.FC = () => {
  const { onComplete, isWorking } = useOnboarding();
  const statusText = isWorking
    ? 'Synchronizing strategy to workspace...'
    : 'Workspace handoff is ready. Open the workspace when you are ready.';

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 11: Workspace Handoff</div>
        <h1>Your workspace is about to open.</h1>
        <p>The strategy, connector state, and selected first action cycle will continue into the workspace canvas.</p>
      </div>

      <div className="handoff-card animate-in">
        <div className="handoff-status">
          <RefreshCw size={24} className={isWorking ? 'spin' : ''} />
          <span>{statusText}</span>
        </div>
        <div className="handoff-progress-bar">
          <div className="fill" style={{ width: isWorking ? '80%' : '100%' }}></div>
        </div>
      </div>

      <div className="onboarding-footer">
        <div />
        <button 
          className="onboarding-btn-primary" 
          onClick={onComplete}
          disabled={isWorking}
        >
          {isWorking ? 'Opening Workspace...' : 'Open Workspace'} <Rocket size={18} />
        </button>
      </div>
    </div>
  );
};
