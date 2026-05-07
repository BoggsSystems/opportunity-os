import React from 'react';
import { Rocket, CheckCircle, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const ChannelActionsPhase: React.FC = () => {
  const { 
    proposedCampaigns, selectedCampaigns, proposedActionLanes, 
    selectedActionLanes, setSelectedActionLanes, currentActionLaneCampaignIndex,
    setCurrentActionLaneCampaignIndex, nextStep, designActionLanes, isLoading
  } = useOnboarding();
  const autoGenerationAttemptedRef = React.useRef(false);

  const activeCampaigns = proposedCampaigns.filter(c => selectedCampaigns.includes(c.id));
  const currentCampaign = activeCampaigns[currentActionLaneCampaignIndex];
  const currentCampaignChannels = Array.isArray(currentCampaign?.configuration?.channels)
    ? currentCampaign.configuration.channels
    : [];

  const actionsForCurrentCampaign = proposedActionLanes.filter((lane: any) => {
    if (lane.campaignId === currentCampaign?.id) return true;
    if (Array.isArray(lane.campaignIds)) return lane.campaignIds.includes(currentCampaign?.id);
    return false;
  });
  const hasSelectedCurrentAction = actionsForCurrentCampaign.some((lane: any) => selectedActionLanes.includes(lane.id));

  React.useEffect(() => {
    console.info('[ChannelActionsPhase] state', {
      selectedCampaignIds: selectedCampaigns,
      activeCampaignCount: activeCampaigns.length,
      currentCampaignId: currentCampaign?.id,
      currentCampaignTitle: currentCampaign?.title,
      currentCampaignChannels,
      proposedActionLaneCount: proposedActionLanes.length,
      actionsForCurrentCampaignCount: actionsForCurrentCampaign.length,
      selectedActionLaneCount: selectedActionLanes.length,
      isLoading,
    });

    if (
      currentCampaign &&
      currentCampaignChannels.length > 0 &&
      actionsForCurrentCampaign.length === 0 &&
      !isLoading &&
      !autoGenerationAttemptedRef.current
    ) {
      autoGenerationAttemptedRef.current = true;
      console.warn('[ChannelActionsPhase] Missing channel actions for selected campaign; regenerating once.', {
        campaignId: currentCampaign.id,
        channels: currentCampaignChannels,
      });
      void designActionLanes();
    }
  }, [
    activeCampaigns.length,
    actionsForCurrentCampaign.length,
    currentCampaign,
    currentCampaignChannels,
    designActionLanes,
    isLoading,
    proposedActionLanes.length,
    selectedActionLanes.length,
    selectedCampaigns,
  ]);
  
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
          Phase 08a: Channel Actions - Campaign {currentActionLaneCampaignIndex + 1} of {activeCampaigns.length}
        </div>
        <h1>Configure actions for this campaign.</h1>
        <p>Turn the selected campaign channels into specific actions the engine will execute for <strong>{currentCampaign.title}</strong>.</p>
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

      {actionsForCurrentCampaign.length === 0 ? (
        <div className="empty-tactical-state">
          <p>No actions were generated for this campaign. I am checking the selected channels and can regenerate them here.</p>
          <button
            className="onboarding-btn-secondary"
            type="button"
            onClick={() => {
              autoGenerationAttemptedRef.current = true;
              void designActionLanes();
            }}
            disabled={isLoading}
          >
            Regenerate Channel Actions
          </button>
        </div>
      ) : (
        <div className="action-lane-grid">
          {actionsForCurrentCampaign.map((lane: any) => {
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
          disabled={!hasSelectedCurrentAction}
        >
          {currentActionLaneCampaignIndex < activeCampaigns.length - 1 ? 'Next Campaign' : 'Confirm Actions & Connect Tools'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
