import React from 'react';
import { Rocket, CheckCircle, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const TacticalArsenalPhase: React.FC = () => {
  const { 
    proposedCampaigns, selectedCampaigns, proposedActionLanes, 
    selectedActionLanes, setSelectedActionLanes, currentActionLaneCampaignIndex,
    setCurrentActionLaneCampaignIndex, nextStep 
  } = useOnboarding();

  const activeCampaigns = proposedCampaigns.filter(c => selectedCampaigns.includes(c.id));
  const currentCampaign = activeCampaigns[currentActionLaneCampaignIndex];
  
  const handleToggle = (id: string) => {
    setSelectedActionLanes((prev: string[]) => 
      prev.includes(id) ? prev.filter((l: string) => l !== id) : [...prev, id]
    );
  };

  if (!currentCampaign) return null;

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">
          Phase 08a: Tactical Arsenal - Campaign {currentActionLaneCampaignIndex + 1} of {activeCampaigns.length}
        </div>
        <h1>Choose action lanes for this campaign.</h1>
        <p>Approve the execution motions for <strong>{currentCampaign.title}</strong>.</p>
      </div>

      <div className="action-lane-grid">
        {proposedActionLanes.filter((lane: any) => lane.campaignId === currentCampaign.id).map((lane: any) => {
          const isSelected = selectedActionLanes.includes(lane.id);
          return (
            <div 
              key={lane.id} 
              className={`action-lane-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleToggle(lane.id)}
            >
              <div className="lane-header">
                <Rocket size={20} />
                <h3>{lane.title}</h3>
                {isSelected && <CheckCircle size={16} className="lane-check" />}
              </div>
              <p>{lane.description}</p>
            </div>
          );
        })}
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('campaigns')}>Back</button>
        <button 
          className="onboarding-btn-primary" 
          onClick={() => {
            if (currentActionLaneCampaignIndex < activeCampaigns.length - 1) {
              setCurrentActionLaneCampaignIndex((prev: number) => prev + 1);
            } else {
              nextStep('connectivity');
            }
          }}
          disabled={selectedActionLanes.length === 0}
        >
          {currentActionLaneCampaignIndex < activeCampaigns.length - 1 ? 'Next Campaign' : 'Confirm Arsenal & Connect Tools'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
