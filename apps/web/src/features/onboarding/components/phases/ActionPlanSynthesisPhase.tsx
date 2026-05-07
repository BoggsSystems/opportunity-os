import React from 'react';
import { AlertCircle, ArrowRight, CheckCircle, Database, RefreshCw } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const ActionPlanSynthesisPhase: React.FC = () => {
  const {
    nextStep,
    designActionLanes,
    proposedActionLanes,
    selectedCampaigns,
    isLoading,
    generationMessage,
  } = useOnboarding();
  const hasActionPlans = proposedActionLanes.length > 0;
  const hasCampaignsToPlan = selectedCampaigns.length > 0;
  const attemptedGenerationRef = React.useRef(false);

  React.useEffect(() => {
    if (hasActionPlans || isLoading || !hasCampaignsToPlan || attemptedGenerationRef.current) return;
    attemptedGenerationRef.current = true;
    void designActionLanes();
  }, [designActionLanes, hasActionPlans, hasCampaignsToPlan, isLoading]);

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 08: Action Plan Synthesis</div>
        <h1>{hasActionPlans ? 'Action plans are ready to review.' : 'Synthesizing your action plans.'}</h1>
        <p>
          {hasActionPlans
            ? "I've turned your selected campaign channels into executable action plans."
            : 'I am turning your campaign channels into concrete execution motions for the action engine.'}
        </p>
      </div>

      <div className="analysis-report animate-in">
        {isLoading && !hasActionPlans ? (
          <div className="report-card action-plan-synthesis-card loading">
            <div className="report-icon"><RefreshCw size={24} className="spin" /></div>
            <div className="report-text">
              <h3>{generationMessage || 'Synthesizing channel actions...'}</h3>
              <p>I am mapping each selected channel to a specific action plan, required tools, and first executable motions.</p>
              <div className="action-plan-synthesis-steps">
                <span>Reading campaign dimensions</span>
                <span>Mapping channels to action types</span>
                <span>Preparing reviewable execution plans</span>
              </div>
            </div>
          </div>
        ) : hasActionPlans ? (
          <div className="report-card action-plan-synthesis-card complete">
            <div className="report-icon"><CheckCircle size={24} /></div>
            <div className="report-text">
              <h3>Action Plan Synthesis Complete</h3>
              <p>I identified {proposedActionLanes.length} specific action plan{proposedActionLanes.length === 1 ? '' : 's'} that can turn your campaign channels into concrete daily results.</p>
            </div>
          </div>
        ) : (
          <div className="report-card action-plan-synthesis-card blocked">
            <div className="report-icon"><AlertCircle size={24} /></div>
            <div className="report-text">
              <h3>Action plans are not ready yet</h3>
              <p>
                {hasCampaignsToPlan
                  ? 'The synthesis did not produce reviewable action plans yet. You can retry the action plan synthesis.'
                  : 'I need at least one selected campaign with channels before I can synthesize action plans.'}
              </p>
              {hasCampaignsToPlan && (
                <button
                  className="onboarding-btn-secondary"
                  type="button"
                  onClick={() => {
                    attemptedGenerationRef.current = true;
                    void designActionLanes();
                  }}
                >
                  Retry Action Plan Synthesis
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('campaigns')} disabled={isLoading}>Back</button>
        <button
          className="onboarding-btn-primary"
          onClick={() => nextStep('actionLanes')}
          disabled={!hasActionPlans || isLoading}
        >
          {isLoading && !hasActionPlans ? 'Synthesizing...' : 'Review Channel Actions'} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
