import React from 'react';
import { Users, Globe, Network, Zap, MessageSquare, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const SensingCalibrationPhase: React.FC = () => {
  const { 
    spotlightData, spotlightIndex, googleSubStep, discoveryCalibration,
    setDiscoveryCalibration, handleDiscoveryNext
  } = useOnboarding();

  if (!spotlightData || spotlightIndex >= spotlightData.length) return null;
  const provider = spotlightData[spotlightIndex];
  const isGoogle = provider.id === 'google';

  return (
    <div className="onboarding-content">
      <div className="discovery-spotlight-container">
        <div className="discovery-progress-bar">
          {spotlightData.map((p: any, idx: number) => (
            <div 
              key={p.id} 
              className={`progress-segment ${idx <= spotlightIndex ? 'active' : ''} ${idx === spotlightIndex ? 'current' : ''}`}
            />
          ))}
        </div>

        <div className="spotlight-card interactive-calibration">
          <div className="spotlight-header">
            <div className={`provider-icon ${provider.id}`}>
               {provider.id === 'linkedin' && <Users size={24} />}
               {provider.id === 'google' && <Globe size={24} />}
               {provider.id === 'microsoft' && <Network size={24} />}
            </div>
            <div className="header-meta">
              <div className="phase-indicator">Phase 03: Discovery Calibration</div>
              <h2>{isGoogle ? `Google ${googleSubStep?.toUpperCase()}` : provider.name}</h2>
              <p className="status-badge live">Live Sensing...</p>
            </div>
          </div>

          <div className="spotlight-content">
            <div className="hero-metrics">
              <div className="metric">
                <span className="value">{provider.metric}</span>
                <span className="label">{provider.metricLabel}</span>
              </div>
              <div className="data-pulse-animation">
                <div className="pulse-ring"></div>
                <Zap size={24} className="pulse-icon" />
              </div>
            </div>

            <div className="ai-interpretation">
              <h3>
                <MessageSquare size={16} />
                Conductor Interpretation
              </h3>
              <p>{provider.insight}</p>
            </div>

            <div className="strategic-calibration">
              <h3>
                <Zap size={16} />
                Strategic Calibration
              </h3>
              <p className="calibration-hint">
                {isGoogle && googleSubStep === 'drive' 
                  ? "Tell me which specific assets to prioritize (e.g., 'Look for my book PDF', 'Ignore old resumes')"
                  : "How should I refine this discovery? (e.g., 'Focus on founders', 'Prioritize recent threads')"}
              </p>
              <textarea 
                className="calibration-input"
                placeholder="Type your strategic steering here..."
                value={discoveryCalibration[isGoogle ? `google_${googleSubStep}` : provider.id] || ''}
                onChange={(e) => setDiscoveryCalibration((prev: Record<string, string>) => ({
                  ...prev,
                  [isGoogle ? `google_${googleSubStep}` : provider.id]: e.target.value
                }))}
              />
            </div>
          </div>

          <div className="spotlight-actions">
            <button className="onboarding-btn-primary" onClick={handleDiscoveryNext}>
              {spotlightIndex < spotlightData.length - 1 ? 'Calibrate & Next Provider' : 'Complete Calibration'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
