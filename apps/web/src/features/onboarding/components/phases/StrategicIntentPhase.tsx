import React from 'react';
import { RefreshCw, ArrowRight, Target, CheckCircle, Circle } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const StrategicIntentPhase: React.FC = () => {
  const { 
    proposedOfferings, selectedLanes, setSelectedLanes, 
    generationMessage, nextStep, isLoading,
    handleConductorSend 
  } = useOnboarding();

  const handleLaneToggle = (id: string) => {
    setSelectedLanes((prev: string[]) => 
      prev.includes(id) ? prev.filter((l: string) => l !== id) : [...prev, id]
    );
  };

  const renderGenerationCards = (count: number, labels: string[]) => {
    return (
      <div className="generation-cards-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="gen-card skeleton">
            <div className="skeleton-line short" />
            <div className="skeleton-line long" />
            <div className="gen-card-footer">
              <span className="gen-label">{labels[i % labels.length]}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 06: Strategic Intent</div>
        <h1>Based on your profile, what is the objective?</h1>
        <p>I have mapped your network and expertise. Select a mission to initialize the campaign.</p>
      </div>

      {proposedOfferings.length === 0 && (
        <>
          <div className="generation-status-panel neural-pulse">
            <RefreshCw size={18} />
            <div>
              <strong>{generationMessage || 'Generating revenue lanes...'}</strong>
              <span>Scanning your relationship graph, experience signals, and uploaded assets for viable offers.</span>
            </div>
          </div>
          {renderGenerationCards(5, [
            'Reading network signals',
            'Finding market fit',
            'Packaging expertise',
            'Scoring evidence',
            'Drafting revenue lanes'
          ])}
        </>
      )}

      {proposedOfferings.length > 0 && (
        <div className="mission-grid">
          {proposedOfferings.map(mission => {
            const isSelected = selectedLanes.includes(mission.id);
            return (
              <div 
                key={mission.id} 
                className={`mission-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleLaneToggle(mission.id)}
              >
                <div className="mission-select-indicator">
                  {isSelected ? <CheckCircle size={20} /> : <Circle size={20} />}
                </div>
                <div className="mission-icon">
                  <Target size={24} />
                </div>
                <h3>{mission.title}</h3>
                <p>{mission.description}</p>
                <div className="evidence-tag">
                  <strong>Evidence:</strong> {mission.evidence}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('knowledge')} disabled={isLoading}>Back</button>
        <button 
          className="onboarding-btn-primary" 
          onClick={() => nextStep('campaigns')} 
          disabled={selectedLanes.length === 0 || isLoading}
        >
          Confirm Intent & Architect Campaigns <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

