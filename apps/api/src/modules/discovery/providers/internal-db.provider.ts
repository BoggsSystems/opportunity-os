import { Injectable } from '@nestjs/common';
import { DiscoveryEvidenceType, DiscoveryTargetType, prisma } from '@opportunity-os/db';
import {
  DiscoveryProvider,
  DiscoveryProviderRequest,
  DiscoveryProviderResult,
  DiscoveryProviderTarget,
} from './discovery-provider.interface';

@Injectable()
export class InternalDatabaseDiscoveryProvider implements DiscoveryProvider {
  readonly key = 'internal_db';

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    const { query, maxTargets, userId } = request;

    // 1. Search for people matching the query in the local DB
    // We search across fullName, title, and company name
    const people = await prisma.person.findMany({
      where: {
        userId,
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { company: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: { company: true },
      take: maxTargets,
      orderBy: { updatedAt: 'desc' },
    });

    const targets: DiscoveryProviderTarget[] = people.map((person) => ({
      targetType: DiscoveryTargetType.person,
      title: `${person.fullName}, ${person.title || 'Professional'}`,
      companyName: person.company?.name,
      personName: person.fullName,
      roleTitle: person.title,
      email: person.email,
      website: person.company?.website,
      linkedinUrl: person.linkedinUrl,
      location: person.location,
      confidenceScore: 100, // It's in our DB, so 100% confident it exists
      relevanceScore: 95,   // High relevance because it's a match in our own records
      whyThisTarget: `Existing contact found in your database matching "${query}".`,
      recommendedAction: 'This contact is already in your CRM. You can promote them directly to this campaign.',
      metadata: {
        internalId: person.id,
        source: 'internal_db',
      },
      evidence: [
        {
          evidenceType: DiscoveryEvidenceType.search_result,
          title: 'Internal CRM Match',
          sourceName: 'Opportunity OS Database',
          snippet: `Found ${person.fullName} (${person.title}) at ${person.company?.name || 'Unknown Company'} in your local records.`,
          confidenceScore: 100,
        },
      ],
    }));

    // 2. If we still have room, search for companies
    if (targets.length < maxTargets) {
      const remaining = maxTargets - targets.length;
      const companies = await prisma.company.findMany({
        where: {
          userId,
          name: { contains: query, mode: 'insensitive' },
          // Don't include companies we already found people for
          NOT: {
            id: { in: targets.filter(t => t.metadata?.['companyId']).map(t => t.metadata?.['companyId'] as string) }
          }
        },
        take: remaining,
        orderBy: { updatedAt: 'desc' },
      });

      targets.push(...companies.map((company) => ({
        targetType: DiscoveryTargetType.company,
        title: company.name,
        companyName: company.name,
        website: company.website,
        linkedinUrl: company.linkedinUrl,
        location: company.geography,
        confidenceScore: 100,
        relevanceScore: 90,
        whyThisTarget: `Existing company found in your database matching "${query}".`,
        recommendedAction: 'This company is in your CRM. Accept to identify specific contacts for this campaign.',
        metadata: {
          internalId: company.id,
          source: 'internal_db',
        },
        evidence: [
          {
            evidenceType: DiscoveryEvidenceType.search_result,
            title: 'Internal CRM Match',
            sourceName: 'Opportunity OS Database',
            snippet: `Found ${company.name} in your local records.`,
            confidenceScore: 100,
          },
        ],
      })));
    }

    return {
      providerKey: this.key,
      targets,
      metadata: {
        count: targets.length,
        query,
      },
    };
  }
}
