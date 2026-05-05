import React from 'react';
import { Zap, Mail, CheckCircle } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const GmailProvider: React.FC = () => {
  const { 
    providerStatuses, isSensingActive, initiateProviderSensing,
    allConnectors
  } = useOnboarding();

  const status = providerStatuses['gmail'];
  const isConnected = allConnectors.some(
    c => (c.providerName === 'gmail' || c.capabilityProvider?.providerName === 'gmail') && 
    c.status === 'connected'
  );

  return (
    <div className="provider-calibration-content animate-in">
      <div className="spotlight-header">
        <div className="provider-icon gmail">
          <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" alt="Gmail" width="24" height="24" />
        </div>
        <div className="header-meta">
          <div className="phase-indicator">Phase 03: Discovery Calibration</div>
          <h2>Gmail</h2>
          {isSensingActive ? (
            <p className="status-badge sensing">Sensing Threads...</p>
          ) : (
            <p className="status-badge complete">{status?.count ? 'Sensing Complete' : 'Ready to Scan'}</p>
          )}
        </div>
      </div>

      <div className="spotlight-body">
        <div className="hero-metrics">
          <div className={`metric ${isSensingActive ? 'pulsing' : ''}`}>
            <span className="value">{isSensingActive ? '--' : (status?.count || '0')}</span>
            <span className="label">THREADS</span>
          </div>
          <div className="metric-breakdown">
            <div className={`breakdown-item ${isSensingActive ? 'loading' : ''}`}>
               <span className="label">Contacts</span>
               <span className="value">0</span>
            </div>
            <div className={`breakdown-item ${isSensingActive ? 'loading' : ''}`}>
               <span className="label">Companies</span>
               <span className="value">0</span>
            </div>
          </div>
        </div>

        {!isConnected ? (
          <div className="empty-assets-state">
            <p>Gmail connection required for deep relationship sensing.</p>
          </div>
        ) : !isSensingActive && (!status?.count || status.count === '0') && (
          <div className="empty-assets-state">
            <p>Ready to analyze your communication threads to map your relationship graph.</p>
            <button className="initiate-scan-btn" onClick={() => initiateProviderSensing('gmail')}>
              <Zap size={16} /> Initiate Gmail Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
