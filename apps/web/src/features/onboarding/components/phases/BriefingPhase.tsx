import React from 'react';
import { Target, Zap, Rocket, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const BriefingPhase: React.FC = () => {
  const { nextStep } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <h1>Welcome to Opportunity OS.</h1>
        <p>I am your Conductor. We're about to map your professional topography and initialize your tactical outreach engine.</p>
      </div>

      <div className="briefing-cards">
        <div className="briefing-card">
          <div className="icon-wrapper sensing"><Target size={24} /></div>
          <h3>Sequential Sensing</h3>
          <p>We'll scan your professional ecosystems to identify warm paths and relationship depth.</p>
        </div>
        <div className="briefing-card">
          <div className="icon-wrapper analysis"><Zap size={24} /></div>
          <h3>Strategic Synthesis</h3>
          <p>I'll fuse your network and expertise into high-fidelity revenue lanes and tactical plans.</p>
        </div>
        <div className="briefing-card">
          <div className="icon-wrapper execution"><Rocket size={24} /></div>
          <h3>Automated Outreach</h3>
          <p>Once calibrated, the engine will handle the heavy lifting of personalized engagement.</p>
        </div>
      </div>

      <div className="onboarding-footer">
        <div />
        <button className="onboarding-btn-primary" onClick={() => nextStep('account')}>
          Begin Orchestration <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
