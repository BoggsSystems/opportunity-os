import { useState } from 'react';
import { ApiClient } from '../lib/api';
import type { EmailReadiness } from '../types';

interface Notice {
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface UseEmailReturn {
  isWorking: boolean;
  startOutlookOAuth: () => Promise<void>;
  syncEmail: () => Promise<void>;
  connectEmail: (providerName: 'gmail' | 'outlook', accessToken: string, emailAddress?: string) => Promise<void>;
}

export const useEmail = (
  api: ApiClient, 
  setEmailReadiness: (readiness: EmailReadiness | null) => void,
  setNotice: (notice: Notice | null) => void
): UseEmailReturn => {
  const [isWorking, setIsWorking] = useState(false);

  const connectEmail = async (providerName: 'gmail' | 'outlook', accessToken: string, emailAddress?: string) => {
    setIsWorking(true);
    setNotice(null);
    try {
      const readiness = await api.setupEmailConnector({
        providerName,
        connectorName: providerName === 'gmail' ? 'Gmail' : 'Outlook',
        accessToken,
        ...(emailAddress && { emailAddress }),
      });
      setEmailReadiness(readiness);
      setNotice({
        title: readiness.ready ? 'Email connected' : 'Email connector pending',
        detail: readiness.ready ? 'Real outreach can now be sent through this provider.' : readiness.upgradeHint ?? 'Connector setup needs a valid access token.',
        tone: readiness.ready ? 'success' : 'warning',
      });
    } catch (error) {
      setNotice({
        title: 'Connector setup failed',
        detail: error instanceof Error ? error.message : 'The email connector could not be configured.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const startOutlookOAuth = async () => {
    window.location.href = `${api.baseUrl}/auth/microsoft`;
  };

  const syncEmail = async () => {
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.syncEmail();
      setNotice({
        title: 'Email synced',
        detail: `${result.synced} messages checked, ${result.linkedReplies} replies linked to opportunities.`,
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        title: 'Email sync failed',
        detail: error instanceof Error ? error.message : 'The connected inbox could not be synced.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  return {
    isWorking,
    startOutlookOAuth,
    syncEmail,
    connectEmail,
  };
};
