import React from 'react';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import { GoogleDriveProvider } from '../providers/GoogleDriveProvider';
import { GmailProvider } from '../providers/GmailProvider';
import { LinkedInProvider } from '../providers/LinkedInProvider';
import { IngestionProgressModal } from '../shared/IngestionProgressModal';

export const SensingCalibrationPhase: React.FC = () => {
  const { 
    spotlightData, spotlightIndex, isSensingActive,
    handleImportAssets, isImporting, selectedAssetIds,
    isIngestionModalOpen, ingestionStatus, ingestionBatchId, setIsIngestionModalOpen,
    handleDiscoveryNext
  } = useOnboarding();

  const [isCalibrated, setIsCalibrated] = React.useState(false);

  React.useEffect(() => {
    setIsCalibrated(false);
  }, [spotlightIndex]);

  if (!spotlightData || spotlightIndex >= spotlightData.length) return null;
  const provider = spotlightData[spotlightIndex];

  const renderProviderContent = () => {
    switch (provider.id) {
      case 'google_drive':
        return <GoogleDriveProvider />;
      case 'gmail':
        return <GmailProvider />;
      case 'linkedin':
        return <LinkedInProvider />;
      default:
        return (
          <div className="provider-calibration-content">
            <div className="spotlight-header">
              <div className="header-meta">
                <div className="phase-indicator">Phase 03: Discovery Calibration</div>
                <h2>{provider.name}</h2>
              </div>
            </div>
            <div className="spotlight-body">
              <p>Ready to analyze your {provider.name} ecosystem.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="sensing-calibration-phase">
      <div className="spotlight-carousel">
        <div className="progress-track">
          {spotlightData.map((p: any, idx: number) => (
            <div 
              key={p.id} 
              className={`progress-segment ${idx <= spotlightIndex ? 'active' : ''} ${idx === spotlightIndex ? 'current' : ''}`}
            />
          ))}
        </div>

        <div className="spotlight-card interactive-calibration">
          {/* Specialized Provider Body */}
          {renderProviderContent()}
        </div>
      </div>

      <div className="onboarding-footer">
        <button 
          className="onboarding-btn-secondary" 
          onClick={handleDiscoveryNext}
          disabled={isSensingActive || isImporting}
        >
          Skip for Now
        </button>
        <button 
          className="onboarding-btn-primary" 
          onClick={async () => {
            if (isCalibrated) {
              setIsCalibrated(false); // Reset for next provider
              void handleDiscoveryNext();
              return;
            }

            if (provider.id === 'google_drive' && selectedAssetIds.length > 0) {
              await handleImportAssets();
              setIsCalibrated(true); // Stay here and show "Continue"
            } else {
              void handleDiscoveryNext();
            }
          }}
          disabled={isSensingActive || isImporting}
        >
          {isImporting ? 'Ingesting Strategic Assets...' : 
           isCalibrated ? 'Confirm Calibration & Continue' : 
           (selectedAssetIds.length > 0 ? 'Calibrate Intelligence from Assets' : 
           (spotlightIndex === spotlightData.length - 1 ? 'Finalize Synthesis' : 'Proceed to Next Phase'))} 
          {!isImporting && <ArrowRight size={18} />}
        </button>
      </div>

      <IngestionProgressModal
        isOpen={isIngestionModalOpen}
        batchId={ingestionBatchId}
        status={ingestionStatus}
        onComplete={() => {
          setIsIngestionModalOpen(false);
          setIsCalibrated(true);
          // If 100%, we can actually auto-advance or let them click the confirm button
        }}
      />
    </div>
  );
};
