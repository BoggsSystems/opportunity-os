import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const WelcomePhase: React.FC = () => {
  const { setCurrentStep } = useOnboarding();

  return (
    <div className="onboarding-content center-content">
      <div className="welcome-hero">
        <div className="logo-placeholder large">OOS</div>
        <h1>Welcome to the Global Network Orchestrator.</h1>
        <p>I am the Conductor. I will sense your professional topography and initialize your strategic outreach engine.</p>
        <button className="onboarding-btn-primary" onClick={() => setCurrentStep('briefing')}>
          Initialize System <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
