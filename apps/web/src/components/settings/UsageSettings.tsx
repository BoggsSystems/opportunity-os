import React from 'react';
import type { EntitlementSummary, UsageSummary, CommercialState, SubscriptionSummary } from '../../types';

const UsageCard: React.FC<{ label: string; usage: EntitlementSummary | null }> = ({ label, usage }) => {
  const used = usage?.used ?? 0;
  const limit = usage?.limit;
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = limit ? pct >= 80 : false;

  return (
    <div className="usage-card">
      <h4>{label}</h4>
      <p className={isNearLimit ? 'usage-warning' : ''}>
        {usage ? `${used} / ${limit ?? '∞'}` : 'No data'}
      </p>
      {limit ? (
        <div className="usage-bar">
          <div
            className={`usage-bar-fill ${isNearLimit ? 'usage-bar-warn' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
};

interface UsageSettingsProps {
  subscription: SubscriptionSummary | null;
  commercialState: CommercialState | null;
  usage: UsageSummary | null;
  billingState?: any;
  onUpgrade?: () => void;
}

export const UsageSettings: React.FC<UsageSettingsProps> = ({
  subscription,
  commercialState,
  usage,
  billingState,
  onUpgrade,
}) => {
  const aiUsage = usage?.usage?.find((item) => item.featureKey === 'ai_requests') ?? null;
  const discoveryUsage = usage?.usage?.find((item) => item.featureKey === 'discovery_scans') ?? null;
  const cycleUsage = usage?.usage?.find((item) => item.featureKey === 'next_action_cycles') ?? null;

  const planName = billingState?.subscription?.plan?.name
    ?? subscription?.plan?.name
    ?? commercialState?.subscription?.plan?.name
    ?? 'Free';
  const planStatus = billingState?.subscription?.status
    ?? subscription?.status
    ?? 'active';
  const billingInterval = billingState?.subscription?.billingInterval;
  const currentPeriodEnd = billingState?.subscription?.currentPeriodEnd;

  const credits = usage?.growthCredits ?? [];
  const hasCredits = credits.length > 0;

  const referral = commercialState?.referral;

  return (
    <div className="settings-section">
      {/* Plan Card */}
      <div className="surface-card">
        <div className="plan-header">
          <div>
            <p className="label">Current Plan</p>
            <h3>{planName}</h3>
          </div>
          {planName === 'Free' || planName === 'Starter' ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={onUpgrade}
              type="button"
            >
              Upgrade
            </button>
          ) : null}
        </div>
        <div className="plan-meta">
          <span className={`status-badge status-${planStatus}`}>
            {planStatus}
          </span>
          {billingInterval ? (
            <span className="billing-interval">{billingInterval}</span>
          ) : null}
          {currentPeriodEnd ? (
            <span className="period-end">
              Renews {new Date(currentPeriodEnd).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>

      {/* Usage Grid */}
      <div className="settings-usage-grid">
        <UsageCard label="AI requests" usage={aiUsage} />
        <UsageCard label="Discovery scans" usage={discoveryUsage} />
        <UsageCard label="Action cycles" usage={cycleUsage} />
      </div>

      {/* Growth Credits */}
      {hasCredits ? (
        <div className="surface-card">
          <p className="label">Growth Credits</p>
          <div className="credits-list">
            {credits.map((credit) => (
              <div key={credit.id} className="credit-row">
                <span className="credit-feature">{credit.featureKey.replace(/_/g, ' ')}</span>
                <span className="credit-qty">+{credit.remainingQuantity}</span>
                {credit.expiresAt ? (
                  <span className="credit-expires">
                    expires {new Date(credit.expiresAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Referral */}
      {referral ? (
        <div className="surface-card">
          <p className="label">Referral Program</p>
          <p className="referral-code">
            Share your code: <strong>{referral.code}</strong>
          </p>
          <p className="referral-hint">
            Earn extra credits when your referrals hit meaningful milestones.
          </p>
        </div>
      ) : null}
    </div>
  );
};
