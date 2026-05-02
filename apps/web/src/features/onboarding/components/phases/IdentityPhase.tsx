import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, CheckCircle } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';

export const IdentityPhase: React.FC = () => {
  const { 
    user, setCurrentStep, onAuth, isWorking, isLoading, api, 
    nextStep 
  } = useOnboarding();
  
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountName, setAccountName] = useState('');
  const isAnyWorking = isWorking || isLoading;

  const CONTINUE_ONBOARDING_AFTER_AUTH_KEY = 'opportunity-os:continue-onboarding-after-auth';
  const DEFAULT_SIGNUP_PASSWORD = 'Password123!';

  const continueAfterAccountCreation = async () => {
    if (user) {
      setCurrentStep('relationships');
      return;
    }
    if (!onAuth || !accountEmail || !accountPassword) return;

    localStorage.setItem(CONTINUE_ONBOARDING_AFTER_AUTH_KEY, 'true');
    await onAuth('signup', accountEmail, accountPassword, accountName || 'Test Operator');
  };

  const useGeneratedAccount = () => {
    setAccountName('Test Operator');
    setAccountPassword(DEFAULT_SIGNUP_PASSWORD);
    setAccountEmail(`web-test-${Date.now()}@example.com`);
  };

  return (
    <div className="onboarding-content">
      <div className="onboarding-header">
        <div className="phase-indicator">Phase 01: Identity</div>
        <h1>Initialize your system.</h1>
        <p>Create a secure workspace account to begin the network audit and strategy generation flow.</p>
      </div>

      <div className="account-gate-card">
        {user ? (
          <div className="account-signed-in-view">
            <div className="account-gate-summary" style={{ borderBottom: 'none', marginBottom: 0 }}>
              <div className="connector-status-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <h3>Account Ready</h3>
                <p>You are signed in as <strong>{user.fullName || user.email}</strong>. Your private workspace is secure and ready for discovery.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="account-gate-summary">
              <div className="connector-status-icon">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3>Secure Orchestration</h3>
                <p>Your data is processed within your private workspace. We'll start by mapping your professional topography.</p>
              </div>
            </div>

            <form
              className="account-gate-form"
              onSubmit={(event) => {
                event.preventDefault();
                void continueAfterAccountCreation();
              }}
            >
              <label>
                Name
                <input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Your name" />
              </label>
              <label>
                Email
                <input value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="you@example.com" type="email" />
              </label>
              <label>
                Password
                <input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} type="password" />
              </label>
              <button className="onboarding-btn-primary account-submit" disabled={isAnyWorking || !accountEmail || !accountPassword} type="submit">
                {isAnyWorking ? 'Creating Workspace...' : 'Create Account and Continue'} <ArrowRight size={18} />
              </button>
              <button className="onboarding-btn-secondary account-test-user" disabled={isAnyWorking} onClick={useGeneratedAccount} type="button">
                Generate Test User
              </button>
            </form>
          </>
        )}
      </div>

      <div className="onboarding-footer">
        <button className="onboarding-btn-secondary" onClick={() => nextStep('briefing')}>Back</button>
        <button className="onboarding-btn-primary" onClick={() => void continueAfterAccountCreation()} disabled={isAnyWorking || (!user && (!accountEmail || !accountPassword))}>
          Secure Account & Continue <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
