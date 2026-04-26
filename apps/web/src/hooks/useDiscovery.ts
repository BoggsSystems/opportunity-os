import { useState } from 'react';
import { ApiClient } from '../lib/api';
import type { CampaignWorkspace } from '../types';

interface Notice {
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface UseDiscoveryReturn {
  isWorking: boolean;
  startDiscoveryScan: (campaignWorkspace: CampaignWorkspace | null) => Promise<void>;
  acceptDiscoveryTarget: (targetId: string) => Promise<void>;
  rejectDiscoveryTarget: (targetId: string) => Promise<void>;
  promoteDiscoveryTargets: (scanId: string) => Promise<void>;
}

export const useDiscovery = (api: ApiClient, setNotice: (notice: Notice | null) => void): UseDiscoveryReturn => {
  const [isWorking, setIsWorking] = useState(false);

  const startDiscoveryScan = async (campaignWorkspace: CampaignWorkspace | null) => {
    const campaign = campaignWorkspace?.campaign;
    const goalTitle = campaignWorkspace?.campaign?.title;
    const targetSegment = campaign?.targetSegment;

    // Combine goal and target segment for maximum specificity
    const query = goalTitle && targetSegment && !targetSegment.toLowerCase().includes(goalTitle.toLowerCase())
      ? `${goalTitle} - ${targetSegment}`
      : targetSegment || goalTitle || campaign?.strategicAngle || 'relevant prospects';

    setIsWorking(true);
    setNotice(null);
    try {
      const scanInput = {
        query,
        scanType: query.toLowerCase().includes('professor') ? 'university_professors' : 'mixed',
        maxTargets: 5,
        ...(campaign?.id && { campaignId: campaign.id }),
        ...(campaign?.offeringId && { offeringId: campaign.offeringId }),
        ...(campaign?.goalId && { goalId: campaign.goalId }),
        ...(campaign?.targetSegment && { targetSegment: campaign.targetSegment }),
      };

      const result = await api.createDiscoveryScan(scanInput);
      setNotice({
        title: 'Discovery scan complete',
        detail: `${result.targets.length} targets are ready for review.`,
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        title: 'Discovery failed',
        detail: error instanceof Error ? error.message : 'The backend could not run discovery.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const acceptDiscoveryTarget = async (targetId: string) => {
    setIsWorking(true);
    setNotice(null);
    try {
      await api.acceptDiscoveryTarget(targetId);
      setNotice({ title: 'Target accepted', detail: 'This target is ready for campaign promotion.', tone: 'success' });
    } catch (error) {
      setNotice({
        title: 'Accept failed',
        detail: error instanceof Error ? error.message : 'The target could not be accepted.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const rejectDiscoveryTarget = async (targetId: string) => {
    setIsWorking(true);
    setNotice(null);
    try {
      await api.rejectDiscoveryTarget(targetId, 'Rejected in Canvas review');
      setNotice({ title: 'Target rejected', detail: 'The discovery list has been updated.', tone: 'success' });
    } catch (error) {
      setNotice({
        title: 'Reject failed',
        detail: error instanceof Error ? error.message : 'The target could not be rejected.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  const promoteDiscoveryTargets = async (scanId: string) => {
    setIsWorking(true);
    setNotice(null);
    try {
      const result = await api.promoteDiscoveryTargets(scanId);
      setNotice({
        title: 'Targets promoted',
        detail: `${result.promoted} accepted targets were added to the campaign workflow.`,
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        title: 'Promotion failed',
        detail: error instanceof Error ? error.message : 'Accepted targets could not be promoted.',
        tone: 'error',
      });
    } finally {
      setIsWorking(false);
    }
  };

  return {
    isWorking,
    startDiscoveryScan,
    acceptDiscoveryTarget,
    rejectDiscoveryTarget,
    promoteDiscoveryTargets,
  };
};
