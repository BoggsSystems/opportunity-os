import React from 'react';
import { Database, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const ActionPlanSynthesisPhase: React.FC = () => {
  const { nextStep } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 08: Action Plan Synthesis</div>
        <h1>Action plans are ready to review.</h1>
        <p>I've turned your selected campaign channels into executable action plans.</p>
      </div>

      <div className="analysis-report animate-in">
        <div className="report-card">
          <div className="report-icon"><Database size={24} /></div>
          <div className="report-text">
            <h3>Action Plan Synthesis Complete</h3>
            <p>I have identified the specific actions that can turn your campaign channels into concrete daily results.</p>
          </div>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('campaigns')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('actionLanes')}>
          Review Channel Actions <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
