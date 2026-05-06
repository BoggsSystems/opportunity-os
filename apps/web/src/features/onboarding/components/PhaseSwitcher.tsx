import React from 'react';
import { useOnboarding } from './OnboardingContext';
import { BriefingPhase } from './phases/BriefingPhase';
import { IdentityPhase } from './phases/IdentityPhase';
import { SensingHubPhase } from './phases/SensingHubPhase';
import { SensingCalibrationPhase } from './phases/SensingCalibrationPhase';
import { DiscoverySynthesisPhase } from './phases/DiscoverySynthesisPhase';
import { KnowledgePhase } from './phases/KnowledgePhase';
import { LinkedInArchivePhase } from './phases/LinkedInArchivePhase';
import { ManualAssetsPhase } from './phases/ManualAssetsPhase';
import { StrategicIntentPhase } from './phases/StrategicIntentPhase';
import { CampaignArchitecturePhase } from './phases/CampaignArchitecturePhase';
import { ActionPlanSynthesisPhase } from './phases/ActionPlanSynthesisPhase';
import { ChannelActionsPhase } from './phases/ChannelActionsPhase';
import { ConnectivityPhase } from './phases/ConnectivityPhase';
import { ActivationPhase } from './phases/ActivationPhase';
import { WorkspaceHandoffPhase } from './phases/WorkspaceHandoffPhase';
import { WelcomePhase } from './phases/WelcomePhase';

export const PhaseSwitcher: React.FC = () => {
  const { currentStep } = useOnboarding();

  switch (currentStep) {
    case 'welcome':
      return <WelcomePhase />;
    case 'briefing':
      return <BriefingPhase />;
    case 'account':
      return <IdentityPhase />;
    case 'relationships':
      return <SensingHubPhase />;
    case 'discovery-sensing':
      return <SensingCalibrationPhase />;
    case 'linkedin-archive':
      return <LinkedInArchivePhase />;
    case 'manual-assets':
      return <ManualAssetsPhase />;
    case 'discovery-synthesis':
      return <DiscoverySynthesisPhase />;
    case 'knowledge':
      return <KnowledgePhase />;
    case 'intent':
      return <StrategicIntentPhase />;
    case 'campaigns':
      return <CampaignArchitecturePhase />;
    case 'analysis':
      return <ActionPlanSynthesisPhase />;
    case 'actionLanes':
      return <ChannelActionsPhase />;
    case 'connectivity':
      return <ConnectivityPhase />;
    case 'activation':
      return <ActivationPhase />;
    case 'workspaceIntro':
      return <ActivationPhase />; // Or a dedicated intro if needed
    case 'workspaceHandoff':
      return <WorkspaceHandoffPhase />;
    default:
      return <BriefingPhase />;
  }
};
