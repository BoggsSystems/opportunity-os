import { DiscoveryScanType, DiscoveryTargetType, DiscoveryEvidenceType } from '@opportunity-os/db';

export interface DiscoveryProviderRequest {
  userId: string;
  query: string;
  scanType: DiscoveryScanType;
  targetSegment?: string;
  maxTargets: number;
  context?: Record<string, unknown>;
}

export interface DiscoveryProviderEvidence {
  evidenceType: DiscoveryEvidenceType;
  title: string;
  sourceUrl?: string;
  sourceName?: string;
  snippet?: string;
  confidenceScore?: number;
  metadata?: Record<string, unknown>;
}

export interface DiscoveryProviderTarget {
  targetType: DiscoveryTargetType;
  title: string;
  companyName?: string;
  personName?: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  location?: string;
  sourceUrl?: string;
  confidenceScore: number;
  relevanceScore: number;
  qualificationScore?: number;
  whyThisTarget: string;
  recommendedAction: string;
  metadata?: Record<string, unknown>;
  evidence: DiscoveryProviderEvidence[];
}

export interface DiscoveryProviderResult {
  providerKey: string;
  targets: DiscoveryProviderTarget[];
  metadata?: Record<string, unknown>;
}

export interface DiscoveryProvider {
  readonly key: string;
  discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult>;
}
