import React from 'react';
import { PlayCircle, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const ActivationPhase: React.FC = () => {
  const { nextStep } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 10: Activation</div>
        <h1>Action cycles are ready.</h1>
        <p>Review the approved campaign lanes, then start the first cycle when you are ready. Nothing is sent without approval.</p>
      </div>

      <div className="activation-launchpad">
        <div className="launch-card">
          <PlayCircle size={48} className="launch-icon" />
          <h2>Ready for Ignition</h2>
          <p>I have queued 12 high-priority actions for your first cycle. Once you hand off to the workspace, you can review and approve each one.</p>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('connectivity')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('workspaceIntro')}>
          Initialize Handoff <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
