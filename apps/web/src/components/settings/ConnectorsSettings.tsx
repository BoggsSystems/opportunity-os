import React from 'react';
import { Mail, RefreshCw, Loader2 } from 'lucide-react';

interface EmailReadiness {
  ready: boolean;
  connector?: {
    providerDisplayName: string;
  };
  upgradeHint?: string | null;
}

interface ConnectorsSettingsProps {
  emailReadiness: EmailReadiness | null;
  isWorking: boolean;
  onStartOutlookOAuth: () => void;
  onSyncEmail: () => void;
}

export const ConnectorsSettings: React.FC<ConnectorsSettingsProps> = ({
  emailReadiness,
  isWorking,
  onStartOutlookOAuth,
  onSyncEmail
}) => {
  const connectorName = emailReadiness?.connector?.providerDisplayName ?? 'Outlook / Hotmail';

  return (
    <div className="settings-section">
      <div className="surface-card">
        <p className="label">Email connector</p>
        <h3>{connectorName}</h3>
        <p>
          {emailReadiness?.ready
            ? 'Connected. Real outreach and inbox sync are available.'
            : emailReadiness?.upgradeHint ?? 'Connect Outlook to enable real email send and reply sync.'}
        </p>
      </div>
      <div className="action-grid">
        <button
          className="primary-button"
          disabled={isWorking}
          onClick={onStartOutlookOAuth}
          type="button"
        >
          {isWorking ? <Loader2 className="spin" size={16} /> : <Mail size={16} />}
          {emailReadiness?.ready ? 'Reconnect Outlook' : 'Connect Outlook'}
        </button>
        <button
          className="secondary-button"
          disabled={isWorking || !emailReadiness?.ready}
          onClick={onSyncEmail}
          type="button"
        >
          {isWorking ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          Sync inbox
        </button>
      </div>
    </div>
  );
};
