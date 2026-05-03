import React from 'react';
import { Users, Globe, Network, Zap, MessageSquare, ArrowRight, Upload, Search } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const SensingCalibrationPhase: React.FC = () => {
  const { 
    spotlightData, spotlightIndex, googleSubStep, discoveryCalibration,
    setDiscoveryCalibration, handleDiscoveryNext,
    storageSuggestions, selectedAssetIds, setSelectedAssetIds,
    isSensingActive, handleStorageSearch, handleImportAssets, isImporting,
    initiateProviderSensing
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
               {provider.id === 'linkedin' && (
                 <img src="https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png" alt="LinkedIn" width="24" height="24" />
               )}
               {provider.id === 'google' && (
                 <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png" alt="Google Drive" width="24" height="24" />
               )}
               {provider.id === 'microsoft' && <Network size={24} />}
            </div>
            <div className="header-meta">
              <div className="phase-indicator">Phase 03: Discovery Calibration</div>
              <h2>{isGoogle ? `Google ${googleSubStep?.toUpperCase() || 'WORKSPACE'}` : provider.name}</h2>
              {isSensingActive ? (
                <p className="status-badge sensing">Sensing Ecosystem...</p>
              ) : (
                <p className="status-badge complete">Sensing Complete</p>
              )}
            </div>
          </div>

          <div className="spotlight-content">
              <div className="hero-metrics">
                <div className={`metric ${isSensingActive ? 'pulsing' : ''}`}>
                  <span className="value">{isSensingActive ? '--' : provider.metric}</span>
                  <span className="label">{provider.metricLabel}</span>
                </div>
                <div className="metric-breakdown">
                  {provider.breakdown?.map((item: any) => (
                    <div key={item.label} className={`breakdown-item ${isSensingActive ? 'loading' : ''}`}>
                      <span className="breakdown-value">{isSensingActive ? '..' : item.value}</span>
                      <span className="breakdown-label">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className={`data-pulse-animation ${isSensingActive ? 'active' : ''}`}>
                  <div className="pulse-ring"></div>
                  <Zap size={24} className="pulse-icon" />
                </div>
              </div>

            <div className="ai-interpretation">
              <h3>
                <MessageSquare size={16} />
                Conductor Interpretation
              </h3>
              {isSensingActive ? (
                <p className="thinking-text">Mapping topography and identifying strategic signatures...</p>
              ) : (
                <p>{provider.insight}</p>
              )}

              {isGoogle && googleSubStep === 'drive' && (
                <div className="strategic-assets-discovery">
                  <div className="assets-discovery-header">
                    <h4>{storageSuggestions.length > 0 ? 'Detected Strategic Assets' : 'Sensing Strategic Assets'}</h4>
                    <div className="search-bar-container">
                      <Search size={14} className="search-icon" />
                      <input 
                        type="text" 
                        placeholder="Search for frameworks, decks, or whitepapers..." 
                        className="asset-search-input"
                        onChange={(e) => handleStorageSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {storageSuggestions.length > 0 ? (
                    <>
                      <p className="assets-subtitle">I've identified these high-value files. Should I ingest them?</p>
                      <div className="assets-list">
                        {storageSuggestions.map((asset) => (
                          <label key={asset.id} className={`asset-item ${selectedAssetIds.includes(asset.id) ? 'selected' : ''}`}>
                            <input 
                              type="checkbox" 
                              checked={selectedAssetIds.includes(asset.id)}
                              onChange={() => {
                                setSelectedAssetIds(prev => 
                                  prev.includes(asset.id) 
                                    ? prev.filter(id => id !== asset.id)
                                    : [...prev, asset.id]
                                );
                              }}
                            />
                            <div className="asset-info">
                              <span className="asset-name">{asset.name}</span>
                              <span className="asset-meta">{new Date(asset.modifiedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="asset-badge">Leverage</div>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : !isSensingActive && (
                    <div className="empty-assets-state">
                      <p>I couldn't find any high-signal strategic assets automatically.</p>
                      <button 
                        className="initiate-scan-btn"
                        onClick={() => initiateProviderSensing(isGoogle ? 'google' : provider.id)}
                      >
                        <Network size={16} /> Initiate Deep Drive Scan
                      </button>
                    </div>
                  )}

                  <div className="manual-feed-zone">
                    <button 
                      className={`import-assets-btn ${selectedAssetIds.length > 0 ? 'active' : ''}`}
                      disabled={selectedAssetIds.length === 0 || isImporting}
                      onClick={handleImportAssets}
                    >
                      {isImporting ? (
                        <>Inhaling Expertise...</>
                      ) : (
                        <><Upload size={16} /> Import {selectedAssetIds.length} Asset{selectedAssetIds.length !== 1 ? 's' : ''}</>
                      )}
                    </button>
                    <p className="import-hint">Imported assets are instantly synthesized by the Conductor.</p>
                  </div>
                </div>
              )}
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
            <button 
              className="onboarding-btn-primary" 
              onClick={handleDiscoveryNext}
              disabled={isImporting}
            >
              {spotlightIndex < spotlightData.length - 1 ? 'Proceed to Next Phase' : 'Complete Calibration'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
