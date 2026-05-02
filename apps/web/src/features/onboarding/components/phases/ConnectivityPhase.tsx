import React from 'react';
import { Mail, ShoppingBag, Database, ArrowRight } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const ConnectivityPhase: React.FC = () => {
  const { onSyncEmail, nextStep } = useOnboarding();

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 09: Connectivity Hub</div>
        <h1>Establish your data bridges.</h1>
        <p>To fuel your selected tactical arsenal, we need to establish these technical connections.</p>
      </div>

      <div className="connector-hub-grid">
        <div className="connector-card">
          <div className="connector-card-header">
            <Mail size={24} />
            <div className="connector-card-info">
              <h3>Email Sync</h3>
              <p>Connect your Gmail or Outlook to allow the Conductor to send outreach.</p>
            </div>
          </div>
          <button className="onboarding-btn-secondary" onClick={() => void onSyncEmail?.()}>Connect Email</button>
        </div>

        <div className="connector-card">
          <div className="connector-card-header">
            <ShoppingBag size={24} />
            <div className="connector-card-info">
              <h3>Commerce / CRM</h3>
              <p>Link HubSpot or Salesforce to sync leads and engagement history.</p>
            </div>
          </div>
          <button className="onboarding-btn-secondary">Connect CRM</button>
        </div>

        <div className="connector-card disabled">
          <div className="connector-card-header">
            <Database size={24} />
            <div className="connector-card-info">
              <h3>Data Warehouse</h3>
              <p>Initialize Snowflake or BigQuery for advanced topography mapping.</p>
            </div>
          </div>
          <button className="onboarding-btn-secondary" disabled>Upgrade Plan</button>
        </div>
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('actionLanes')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => nextStep('activation')}>
          Finalize Connections & Activate <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
