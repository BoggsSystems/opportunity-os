import React from 'react';
import type { EntitlementSummary, UsageSummary } from '../../types';

// Temporary UsageCard component since the original might not be exported
const UsageCard: React.FC<{ label: string; usage: EntitlementSummary | null }> = ({ label, usage }) => {
  return (
    <div className="usage-card">
      <h4>{label}</h4>
      <p>{usage ? `${usage.used}/${usage.limit ?? '∞'}` : 'No data'}</p>
    </div>
  );
};

interface UsageSettingsProps {
  subscription: {
    plan: {
      name: string;
    };
    status: string;
  } | null;
  commercialState: {
    subscription: {
      plan: {
        name: string;
      };
    };
  } | null;
  usage: UsageSummary | null;
}

export const UsageSettings: React.FC<UsageSettingsProps> = ({
  subscription,
  commercialState,
  usage
}) => {
  const aiUsage = usage?.usage?.find((item) => item.featureKey === 'ai_requests') ?? null;
  const discoveryUsage = usage?.usage?.find((item) => item.featureKey === 'discovery_scans') ?? null;
  const cycleUsage = usage?.usage?.find((item) => item.featureKey === 'next_action_cycles') ?? null;

  return (
    <div className="settings-section">
      <div className="surface-card">
        <p className="label">Plan</p>
        <h3>{subscription?.plan.name ?? commercialState?.subscription.plan.name ?? 'Unknown plan'}</h3>
        <p>
          {subscription?.status ?? 'No subscription status available'}
        </p>
      </div>
      <div className="settings-usage-grid">
        <UsageCard label="AI requests" usage={aiUsage} />
        <UsageCard label="Discovery scans" usage={discoveryUsage} />
        <UsageCard label="Action cycles" usage={cycleUsage} />
      </div>
    </div>
  );
};
