import React from 'react';
import { Database, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const TacticalCalibrationPhase: React.FC = () => {
  const { nextStep } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 08: Channel Workflow Calibration</div>
        <h1>Execution channels are ready to review.</h1>
        <p>I've turned your selected campaign channels into workflow options.</p>
      </div>

      <div className="analysis-report animate-in">
        <div className="report-card">
          <div className="report-icon"><Database size={24} /></div>
          <div className="report-text">
            <h3>Channel Workflow Synthesis Complete</h3>
            <p>I have identified executable workflows that can turn your campaign channels into concrete daily actions.</p>
          </div>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('campaigns')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('actionLanes')}>
          Review Execution Channels <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
