import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const CampaignArchitecturePhase: React.FC = () => {
  const { 
    proposedCampaigns, selectedCampaigns, setSelectedCampaigns, 
    designActionLanes, nextStep, isLoading,
    proposedOfferings, selectedLanes, currentOfferingIndex, generateNextCampaign
  } = useOnboarding();

  const currentOfferingId = selectedLanes[currentOfferingIndex];
  const currentOffering = proposedOfferings.find(o => o.id === currentOfferingId);
  
  // Find if we have already generated a campaign for this offering
  // (Assuming 1:1 for now)
  const currentCampaign = proposedCampaigns.find(c => c.offeringId === currentOfferingId);

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

      <div className="sequential-architecture-hub">
        {!currentCampaign && currentOffering && (
          <div className="architecture-pending-card">
            <div className="offering-context-badge">CURRENT MISSION</div>
            <h2>{currentOffering.title}</h2>
            <p>{currentOffering.description}</p>
            
            <button 
              className="onboarding-btn-primary architecture-trigger"
              onClick={generateNextCampaign}
              disabled={isLoading}
            >
              {isLoading ? 'Architecting Mission...' : 'Initialize Tactical Architecture'}
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {currentCampaign && (
          <div className="campaign-preview-card active-mission animate-in">
            <div className="preview-header">
              <div className="mission-tag">MISSION ARCHITECTED</div>
              <h3>{currentCampaign.title}</h3>
            </div>
            <p className="campaign-strategy">{currentCampaign.description}</p>
            
            <div className="preview-metrics">
              <div className="p-metric">
                <span className="label">Messaging Hook</span>
                <span className="value">{currentCampaign.messagingHook}</span>
              </div>
              <div className="p-metric">
                <span className="label">Mission Goal</span>
                <span className="value">{currentCampaign.goalMetric}</span>
              </div>
            </div>

            <div className="preview-footer">
              <p>The Commander has finalized this tactical lane. Proceed to the next objective.</p>
            </div>
          </div>
        )}

        {currentOfferingIndex >= selectedLanes.length && proposedCampaigns.length > 0 && (
          <div className="architecture-complete-state">
            <div className="success-icon">✓</div>
            <h2>All Missions Architected</h2>
            <p>Your strategic map is fully populated with {proposedCampaigns.length} tactical campaigns.</p>
          </div>
        )}
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('intent')} disabled={isLoading}>Back</button>
        
        {currentOfferingIndex < selectedLanes.length ? (
          <div className="step-count">Mission {currentOfferingIndex + 1} of {selectedLanes.length}</div>
        ) : (
          <button 
            className="onboarding-btn-primary" 
            onClick={() => void designActionLanes()} 
            disabled={proposedCampaigns.length === 0 || isLoading}
          >
            {isLoading ? 'Designing Tactics...' : 'Finalize Strategy & Design Tactics'} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
