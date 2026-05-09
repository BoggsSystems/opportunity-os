import { Injectable } from '@nestjs/common';
import { DiscoveryEvidenceType, DiscoveryScanType, DiscoveryTargetType } from '@opportunity-os/db';
import { SearchService } from '../../ai/search.service';
import { AiService } from '../../ai/ai.service';
import {
  DiscoveryProvider,
  DiscoveryProviderRequest,
  DiscoveryProviderResult,
  DiscoveryProviderTarget,
} from './discovery-provider.interface';

@Injectable()
export class TavilyDiscoveryProvider implements DiscoveryProvider {
  readonly key = 'tavily_search';

  constructor(
    private readonly searchService: SearchService,
    private readonly aiService: AiService,
  ) {}

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    const searchQuery = this.buildSearchQuery(request);
    const results = await this.searchService.search(searchQuery, {
      maxResults: Math.min(Math.max(request.maxTargets * 2, 6), 16),
      searchDepth: 'advanced',
    });

    const targets: DiscoveryProviderTarget[] = [];
    
    // Process top results with AI for high-fidelity extraction
    for (const [index, result] of results.slice(0, request.maxTargets).entries()) {
      try {
        console.log(`[Tavily AI] Attempting extraction for: ${result.title}`);
        const extracted = await this.aiService.extractTargetSignalsFromText(`${result.title}\n${result.content}`, {
          targetSegment: request.targetSegment,
          campaignContext: request.context?.['campaign'],
        });
        console.log(`[Tavily AI] Extracted: ${extracted.personName || 'No Name'} | ${extracted.companyName || 'No Company'}`);

        targets.push({
          targetType: extracted.personName ? DiscoveryTargetType.person : DiscoveryTargetType.company,
          title: extracted.personName ? `${extracted.personName}${extracted.roleTitle ? `, ${extracted.roleTitle}` : ''}` : (extracted.companyName || result.title),
          companyName: extracted.companyName || this.extractCompanyName(result.title, result.url),
          personName: extracted.personName,
          roleTitle: extracted.roleTitle,
          email: extracted.email,
          linkedinUrl: extracted.linkedinUrl,
          website: this.baseWebsite(result.url),
          sourceUrl: result.url,
          confidenceScore: extracted.relevanceScore,
          relevanceScore: extracted.relevanceScore,
          whyThisTarget: extracted.whyThisTarget,
          recommendedAction: extracted.recommendedAction,
          evidence: [
            {
              evidenceType: DiscoveryEvidenceType.search_result,
              title: result.title,
              sourceUrl: result.url,
              sourceName: 'Tavily Search',
              snippet: result.content.slice(0, 500),
              confidenceScore: extracted.relevanceScore,
            }
          ],
          metadata: {
            provider: this.key,
            searchScore: result.score,
          }
        });
      } catch (e) {
        // Fallback to basic extraction if AI fails
        targets.push(this.toTarget(request, result, index));
      }
    }

    return {
      providerKey: this.key,
      targets,
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

    parts.push('(LinkedIn OR email OR contact OR team)');

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

    const linkedinUrl = this.extractLinkedInUrl(`${title}\n${content}\n${result.url}`);

    return {
      targetType,
      title: personName ? `${personName}${roleTitle ? `, ${roleTitle}` : ''}` : companyName,
      companyName,
      personName,
      roleTitle,
      email,
      linkedinUrl,
      website: this.baseWebsite(result.url),
      sourceUrl: result.url,
      confidenceScore: linkedinUrl ? Math.max(confidenceScore, 80) : confidenceScore,
      relevanceScore,
      qualificationScore: Math.round((confidenceScore + relevanceScore) / 2),
      whyThisTarget: `Found from live web search for "${request.query}" and appears relevant to ${request.targetSegment ?? 'the current campaign'}.`,
      recommendedAction: personName || email
        ? 'Review this contact candidate, confirm fit, then generate first-touch outreach.'
        : 'Review this target, identify the right contact, then generate outreach.',
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

  private extractLinkedInUrl(text: string): string | undefined {
    const match = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i);
    return match?.[0];
  }

  private extractPersonName(title: string): string | undefined {
    const candidate = title.split(/\s[-|:]\s/)[0]?.trim();
    if (!candidate) return undefined;
    if (!/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(candidate)) return undefined;
    return candidate;
  }

  private extractRoleTitle(text: string): string | undefined {
    // Look for common leadership or professional titles in the text
    const roleMatch = text.match(/\b(CTO|CEO|VP|Director|Manager|Lead|Engineer|Founder|Architect|Consultant)\b/i);
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
