import { Injectable } from '@nestjs/common';
import { DiscoveryEvidenceType, DiscoveryScanType, DiscoveryTargetType } from '@opportunity-os/db';
import { SearchService } from '../../ai/search.service';
import {
  DiscoveryProvider,
  DiscoveryProviderRequest,
  DiscoveryProviderResult,
  DiscoveryProviderTarget,
} from './discovery-provider.interface';

@Injectable()
export class TavilyDiscoveryProvider implements DiscoveryProvider {
  readonly key = 'tavily_search';

  constructor(private readonly searchService: SearchService) {}

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    const searchQuery = this.buildSearchQuery(request);
    const results = await this.searchService.search(searchQuery, {
      maxResults: Math.min(Math.max(request.maxTargets * 2, 6), 16),
      searchDepth: 'advanced',
    });

    return {
      providerKey: this.key,
      targets: results
        .slice(0, request.maxTargets)
        .map((result, index) => this.toTarget(request, result, index)),
      metadata: {
        searchQuery,
        resultCount: results.length,
        configured: this.searchService.isConfigured(),
      },
    };
  }

  private buildSearchQuery(request: DiscoveryProviderRequest): string {
    const parts = [request.query];
    if (request.targetSegment) parts.push(request.targetSegment);

    if (request.scanType === DiscoveryScanType.people || request.scanType === DiscoveryScanType.mixed) {
      parts.push('(recruiter OR recruiting consultant OR talent partner OR search consultant)');
      parts.push('(email OR contact OR team)');
    }

    if (request.scanType === DiscoveryScanType.companies) {
      parts.push('(recruiting firm OR executive search OR staffing)');
    }

    return parts.join(' ');
  }

  private toTarget(
    request: DiscoveryProviderRequest,
    result: { title: string; url: string; content: string; score: number },
    index: number,
  ): DiscoveryProviderTarget {
    const title = result.title?.trim() || `Search result ${index + 1}`;
    const content = result.content?.trim() || '';
    const email = this.extractEmail(`${title}\n${content}`);
    const personName = this.extractPersonName(title);
    const companyName = this.extractCompanyName(title, result.url);
    const roleTitle = this.extractRoleTitle(`${title}\n${content}`);
    const targetType =
      personName || email
        ? DiscoveryTargetType.person
        : request.scanType === DiscoveryScanType.companies
          ? DiscoveryTargetType.company
          : DiscoveryTargetType.person;
    const relevanceScore = Math.max(55, Math.min(95, Math.round(result.score * 100)));
    const confidenceScore = email ? 84 : personName ? 74 : 62;

    return {
      targetType,
      title: personName ? `${personName}${roleTitle ? `, ${roleTitle}` : ''}` : companyName,
      companyName,
      personName,
      roleTitle,
      email,
      website: this.baseWebsite(result.url),
      sourceUrl: result.url,
      confidenceScore,
      relevanceScore,
      qualificationScore: Math.round((confidenceScore + relevanceScore) / 2),
      whyThisTarget: `Found from live web search for "${request.query}" and appears relevant to ${request.targetSegment ?? 'the current campaign'}.`,
      recommendedAction: personName || email
        ? 'Review this contact candidate, confirm fit, then generate first-touch outreach.'
        : 'Review this firm, identify the right recruiter contact, then generate outreach.',
      metadata: {
        provider: this.key,
        searchScore: result.score,
      },
      evidence: [
        {
          evidenceType: DiscoveryEvidenceType.search_result,
          title,
          sourceUrl: result.url,
          sourceName: 'Tavily Search',
          snippet: content.slice(0, 280) || title,
          confidenceScore,
        },
      ],
    };
  }

  private extractEmail(text: string): string | undefined {
    return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
  }

  private extractPersonName(title: string): string | undefined {
    const candidate = title.split(/\s[-|:]\s/)[0]?.trim();
    if (!candidate) return undefined;
    if (!/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(candidate)) return undefined;
    return candidate;
  }

  private extractRoleTitle(text: string): string | undefined {
    const roleMatch = text.match(/\b(recruiter|recruiting consultant|talent partner|talent acquisition|headhunter|search consultant)\b/i);
    if (!roleMatch) return undefined;
    return roleMatch[0]
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private extractCompanyName(title: string, url: string): string {
    const titleParts = title.split(/\s[-|:]\s/).map((part) => part.trim()).filter(Boolean);
    if (titleParts.length > 1) {
      return titleParts[titleParts.length - 1] as string;
    }

    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      return hostname
        .split('.')[0]
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    } catch {
      return title;
    }
  }

  private baseWebsite(url: string): string | undefined {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return undefined;
    }
  }
}
