import React from 'react';
import { Database, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const TacticalCalibrationPhase: React.FC = () => {
  const { nextStep } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 08: Tactical Calibration</div>
        <h1>Intelligence Report: Strategy Primed.</h1>
        <p>I've synthesized your network, expertise, and target campaigns.</p>
      </div>

      <div className="analysis-report animate-in">
        <div className="report-card">
          <div className="report-icon"><Database size={24} /></div>
          <div className="report-text">
            <h3>Tactical Synthesis Complete</h3>
            <p>I have identified 3 distinct tactical lanes for your 'Series B Strategic Outreach' campaign. Each lane is optimized for maximum conversion based on your historical interaction density.</p>
          </div>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('campaigns')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('actionLanes')}>
          Review Tactical Arsenal <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
