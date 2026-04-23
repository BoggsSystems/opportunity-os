import { Injectable } from '@nestjs/common';
import { DiscoveryEvidenceType, DiscoveryScanType, DiscoveryTargetType } from '@opportunity-os/db';
import {
  DiscoveryProvider,
  DiscoveryProviderRequest,
  DiscoveryProviderResult,
  DiscoveryProviderTarget,
} from './discovery-provider.interface';

@Injectable()
export class LocalDiscoveryProvider implements DiscoveryProvider {
  readonly key = 'local_mock';

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    const targetCount = Math.min(Math.max(request.maxTargets, 1), 10);
    const targets = Array.from({ length: targetCount }, (_, index) => this.buildTarget(request, index));

    return {
      providerKey: this.key,
      targets,
      metadata: {
        generated: true,
        query: request.query,
        scanType: request.scanType,
      },
    };
  }

  private buildTarget(request: DiscoveryProviderRequest, index: number): DiscoveryProviderTarget {
    const ordinal = index + 1;
    const isProfessorScan = request.scanType === DiscoveryScanType.university_professors;
    const isCompanyScan = request.scanType === DiscoveryScanType.companies;
    const queryLabel = this.toTitleCase(request.query).replace(/\s+/g, ' ').trim() || 'Target';
    const segment = request.targetSegment || (isProfessorScan ? 'software engineering faculty' : 'target market');
    const companyName = isProfessorScan
      ? `${['Northeastern', 'Carnegie Mellon', 'Georgia Tech', 'Waterloo', 'Illinois'][index % 5]} Software Engineering Lab`
      : `${queryLabel} ${['Systems', 'Institute', 'Group', 'Lab', 'Network'][index % 5]}`;
    const personName = isCompanyScan ? undefined : `${['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey'][index % 5]} ${['Chen', 'Patel', 'Rivera', 'Smith', 'Nguyen'][index % 5]}`;
    const roleTitle = isProfessorScan ? 'Professor of Software Engineering' : isCompanyScan ? undefined : 'Engineering Leader';
    const relevanceScore = Math.max(55, 90 - index * 4);
    const confidenceScore = Math.max(50, 82 - index * 3);

    return {
      targetType: isProfessorScan
        ? DiscoveryTargetType.university_professor
        : isCompanyScan
          ? DiscoveryTargetType.company
          : DiscoveryTargetType.person,
      title: personName ? `${personName}, ${roleTitle}` : companyName,
      companyName,
      personName,
      roleTitle,
      email: personName ? `${personName.toLowerCase().replace(/\s+/g, '.')}@example.edu` : undefined,
      website: `https://example.com/discovery/${ordinal}`,
      linkedinUrl: `https://www.linkedin.com/in/example-discovery-${ordinal}`,
      location: isProfessorScan ? 'North America' : undefined,
      sourceUrl: `https://example.com/discovery/${ordinal}`,
      confidenceScore,
      relevanceScore,
      qualificationScore: Math.round((confidenceScore + relevanceScore) / 2),
      whyThisTarget: `Matches ${segment} for "${request.query}" and gives the campaign a clear outreach angle.`,
      recommendedAction: personName
        ? 'Review this target, accept it if relevant, then generate first-touch outreach.'
        : 'Review this account, accept it if relevant, then identify the right contact.',
      metadata: {
        localProvider: true,
        ordinal,
      },
      evidence: [
        {
          evidenceType: isProfessorScan ? DiscoveryEvidenceType.publication : DiscoveryEvidenceType.search_result,
          title: `${queryLabel} relevance signal ${ordinal}`,
          sourceUrl: `https://example.com/discovery/${ordinal}`,
          sourceName: 'Local Discovery Provider',
          snippet: `Synthetic evidence showing why this target is relevant to ${request.query}.`,
          confidenceScore,
        },
      ],
    };
  }

  private toTitleCase(value: string) {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
      .join(' ');
  }
}
