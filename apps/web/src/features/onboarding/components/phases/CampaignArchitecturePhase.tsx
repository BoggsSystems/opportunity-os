import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const CampaignArchitecturePhase: React.FC = () => {
  const { proposedCampaigns, selectedCampaigns, setSelectedCampaigns, designActionLanes, nextStep, isLoading } = useOnboarding();

  const handleToggle = (id: string) => {
    setSelectedCampaigns((prev: string[]) => 
      prev.includes(id) ? prev.filter((c: string) => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 07: Campaign Architecture</div>
        <h1>Now let's put these lanes into motion.</h1>
        <p>Each Revenue Lane needs a campaign — a focused, time-bound push to generate real conversations.</p>
      </div>

      <div className="campaign-selection-grid">
        {proposedCampaigns.map(campaign => {
          const isSelected = selectedCampaigns.includes(campaign.id);
          return (
            <div 
              key={campaign.id} 
              className={`campaign-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleToggle(campaign.id)}
            >
              <div className="campaign-icon">
                <Layers size={24} />
              </div>
              <div className="campaign-body">
                <h3>{campaign.title}</h3>
                <p>{campaign.description}</p>
                <div className="campaign-metrics">
                  <div className="c-metric">
                    <strong>Reach:</strong> {campaign.potentialReach}
                  </div>
                  <div className="c-metric">
                    <strong>Intensity:</strong> {campaign.intensity}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('intent')} disabled={isLoading}>Back</button>
        <button 
          className="onboarding-btn-primary" 
          onClick={() => void designActionLanes()} 
          disabled={selectedCampaigns.length === 0 || isLoading}
        >
          {isLoading ? 'Designing Tactics...' : 'Confirm Campaigns & Design Tactics'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
