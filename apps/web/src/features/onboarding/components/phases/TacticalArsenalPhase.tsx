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
  const currentCampaignChannels = Array.isArray(currentCampaign?.configuration?.channels)
    ? currentCampaign.configuration.channels
    : [];

  const workflowsForCurrentCampaign = proposedActionLanes.filter((lane: any) => {
    if (lane.campaignId === currentCampaign?.id) return true;
    if (Array.isArray(lane.campaignIds)) return lane.campaignIds.includes(currentCampaign?.id);
    return false;
  });
  const hasSelectedCurrentWorkflow = workflowsForCurrentCampaign.some((lane: any) => selectedActionLanes.includes(lane.id));
  
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
          Phase 08a: Execution Channels - Campaign {currentActionLaneCampaignIndex + 1} of {activeCampaigns.length}
        </div>
        <h1>Configure execution channels for this campaign.</h1>
        <p>Turn the selected campaign channels into workflows the action engine can execute for <strong>{currentCampaign.title}</strong>.</p>
      </div>

      {currentCampaignChannels.length > 0 && (
        <div className="selected-channel-strip">
          <span>Selected campaign channels</span>
          <div>
            {currentCampaignChannels.map((channel: string) => (
              <strong key={channel}>{channel}</strong>
            ))}
          </div>
        </div>
      )}

      {workflowsForCurrentCampaign.length === 0 ? (
        <div className="empty-tactical-state">
          No execution channel workflows were generated for this campaign. Go back and regenerate workflows from the campaign channels.
        </div>
      ) : (
        <div className="action-lane-grid">
          {workflowsForCurrentCampaign.map((lane: any) => {
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
      )}

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
          disabled={!hasSelectedCurrentWorkflow}
        >
          {currentActionLaneCampaignIndex < activeCampaigns.length - 1 ? 'Next Campaign' : 'Confirm Channels & Connect Tools'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
