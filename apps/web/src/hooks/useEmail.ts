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
    setIsWorking(true);
    setNotice(null);
    try {
      const start = await api.startEmailOAuth('outlook', window.location.origin);
      const callbackOrigin = new URL(api.baseUrl).origin;
      const popup = window.open(start.authUrl, 'opportunity-os-outlook-oauth', 'width=560,height=760');
      if (!popup) {
        throw new Error('The OAuth popup was blocked by the browser.');
      }

      const result = await new Promise<{ success: boolean; emailAddress?: string | null; error?: string | null }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error('Timed out waiting for Microsoft login to complete.'));
        }, 120000);

        function cleanup() {
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
        }

        function onMessage(event: MessageEvent) {
          if (event.origin !== callbackOrigin) return;
          const data = event.data as { type?: string; provider?: string; success?: boolean; emailAddress?: string | null; error?: string | null };
          if (data?.type !== 'opportunity-os-oauth' || data.provider !== 'outlook') return;
          cleanup();
          const resolved: { success: boolean; emailAddress?: string | null; error?: string | null } = {
            success: data.success === true,
          };
          if (data.emailAddress !== undefined) resolved.emailAddress = data.emailAddress;
          if (data.error !== undefined) resolved.error = data.error;
          resolve(resolved);
        }

        window.addEventListener('message', onMessage);
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Microsoft login did not complete successfully.');
      }

      const readiness = await api.getEmailReadiness();
      setEmailReadiness(readiness);
      setNotice({
        title: 'Outlook connected',
        detail: result.emailAddress
          ? `Real outreach can now send through ${result.emailAddress}.`
          : 'Real outreach can now send through Outlook.',
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        title: 'Outlook connect failed',
        detail: error instanceof Error ? error.message : 'The Microsoft login flow could not be completed.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
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
