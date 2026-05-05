import React from 'react';
import { Zap, Users, CheckCircle } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const LinkedInProvider: React.FC = () => {
  const { 
    providerStatuses, isSensingActive, initiateProviderSensing,
    allConnectors
  } = useOnboarding();

  const status = providerStatuses['linkedin'];
  const isConnected = allConnectors.some(
    c => (c.providerName === 'linkedin' || c.capabilityProvider?.providerName === 'linkedin') && 
    c.status === 'connected'
  );

  return (
    <div className="provider-calibration-content animate-in">
      <div className="spotlight-header">
        <div className="provider-icon linkedin">
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png" alt="LinkedIn" width="24" height="24" />
        </div>
        <div className="header-meta">
          <div className="phase-indicator">Phase 03: Discovery Calibration</div>
          <h2>LinkedIn</h2>
          {isSensingActive ? (
            <p className="status-badge sensing">Sensing Network...</p>
          ) : (
            <p className="status-badge complete">{status?.count ? 'Sensing Complete' : 'Ready to Scan'}</p>
          )}
        </div>
      </div>

      <div className="spotlight-body">
        <div className="hero-metrics">
          <div className={`metric ${isSensingActive ? 'pulsing' : ''}`}>
            <span className="value">{isSensingActive ? '--' : (status?.count || '0')}</span>
            <span className="label">CONNECTIONS</span>
          </div>
          <div className="metric-breakdown">
            <div className={`breakdown-item ${isSensingActive ? 'loading' : ''}`}>
               <span className="label">Signal Points</span>
               <span className="value">0</span>
            </div>
            <div className={`breakdown-item ${isSensingActive ? 'loading' : ''}`}>
               <span className="label">Engagements</span>
               <span className="value">0</span>
            </div>
          </div>
        </div>

        {!isConnected ? (
          <div className="empty-assets-state">
            <p>LinkedIn connection required for network topography mapping.</p>
          </div>
        ) : !isSensingActive && (!status?.count || status.count === '0') && (
          <div className="empty-assets-state">
            <p>Ready to map your professional topography through your LinkedIn network.</p>
            <button className="initiate-scan-btn" onClick={() => initiateProviderSensing('linkedin')}>
              <Zap size={16} /> Initiate LinkedIn Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
