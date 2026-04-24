import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveryTargetType,
  DiscoveryEvidenceType,
} from '@opportunity-os/db';
import {
  DiscoveryProvider,
  DiscoveryProviderRequest,
  DiscoveryProviderResult,
  DiscoveryProviderTarget,
} from './discovery-provider.interface';

@Injectable()
export class ApolloDiscoveryProvider implements DiscoveryProvider {
  private readonly logger = new Logger(ApolloDiscoveryProvider.name);
  private readonly apiKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('APOLLO_API_KEY');
  }

  readonly key = 'apollo_b2b';
  readonly name = 'Apollo B2B Intelligence';

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    if (!this.apiKey) {
      this.logger.warn('APOLLO_API_KEY is not configured. Skipping Apollo discovery.');
      return {
        providerKey: this.key,
        targets: [],
        metadata: { configured: false, error: 'API key not configured' },
      };
    }

    try {
      this.logger.log(`Performing Apollo B2B search for: "${request.query}"`);

      // Apollo People Search API
      const response = await fetch('https://api.apollo.io/v1/people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          q_keywords: request.query,
          person_titles: request.targetSegment ? [request.targetSegment] : undefined,
          page: 1,
          per_page: request.maxTargets || 10,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Apollo API error: ${response.status} - ${error}`);
        return {
          providerKey: this.key,
          targets: [],
          metadata: { configured: true, error: `API error: ${response.status}` },
        };
      }

      const data = (await response.json()) as any;
      const people = data.people || [];
      
      const targets = people.map((p: any, index: number) => this.mapPersonToTarget(p, index));

      return {
        providerKey: this.key,
        targets,
        metadata: {
          configured: true,
          pagination: data.pagination,
          total_count: data.total_count,
        },
      };
    } catch (error) {
      this.logger.error('Failed to perform Apollo discovery', error);
      return {
        providerKey: this.key,
        targets: [],
        metadata: { configured: true, error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * ENRICH: Find verified contact info for a specific person/company.
   */
  async enrich(target: Partial<DiscoveryProviderTarget>): Promise<Partial<DiscoveryProviderTarget>> {
    if (!this.apiKey || (!target.personName && !target.companyName)) {
      return {};
    }

    try {
      this.logger.log(`Enriching target via Apollo: ${target.personName} @ ${target.companyName}`);

      const response = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          first_name: target.personName?.split(' ')[0],
          last_name: target.personName?.split(' ').slice(1).join(' '),
          organization_name: target.companyName,
          domain: target.website?.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          linkedin_url: target.linkedinUrl,
        }),
      });

      if (!response.ok) return {};

      const data = (await response.json()) as any;
      const person = data.person;

      if (!person) return {};

      return {
        email: person.email,
        phone: person.work_phone || person.mobile_phone,
        linkedinUrl: person.linkedin_url || target.linkedinUrl,
        location: person.city ? `${person.city}, ${person.state}` : person.country,
        metadata: {
          ...(target.metadata || {}),
          apollo_id: person.id,
          employment_history: person.employment_history,
          headline: person.headline,
        },
      };
    } catch (error) {
      this.logger.error('Apollo enrichment failed', error);
      return {};
    }
  }

  private mapPersonToTarget(p: any, index: number): DiscoveryProviderTarget {
    const company = p.organization || {};
    
    return {
      targetType: DiscoveryTargetType.person,
      personName: p.name,
      companyName: company.name,
      title: p.title,
      email: p.email,
      website: company.website_url,
      linkedinUrl: p.linkedin_url,
      location: p.city ? `${p.city}, ${p.state}` : p.country,
      confidenceScore: 90,
      relevanceScore: 85,
      whyThisTarget: `Verified ${p.title} at ${company.name}. Stated focus on: ${p.headline || 'N/A'}`,
      recommendedAction: `Connect via LinkedIn and mention their role in ${company.name}'s engineering team.`,
      evidence: [
        {
          evidenceType: DiscoveryEvidenceType.search_result,
          title: `${p.name} - ${p.title} at ${company.name}`,
          sourceName: 'Apollo B2B Intelligence',
          sourceUrl: p.linkedin_url,
          snippet: `Current Role: ${p.title} at ${company.name}. Location: ${p.city || 'N/A'}, ${p.state || 'N/A'}.`,
          confidenceScore: 95,
        },
      ],
      metadata: {
        apollo_id: p.id,
        index,
        organization_id: company.id,
        industries: company.industries,
        company_size: company.estimated_num_employees,
      },
    };
  }
}
