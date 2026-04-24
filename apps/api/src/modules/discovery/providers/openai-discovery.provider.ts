import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryEvidenceType, DiscoveryTargetType } from '@opportunity-os/db';
import {
  DiscoveryProvider,
  DiscoveryProviderRequest,
  DiscoveryProviderResult,
  DiscoveryProviderTarget,
} from './discovery-provider.interface';

@Injectable()
export class OpenAiDiscoveryProvider implements DiscoveryProvider {
  readonly key = 'openai_web_search';
  private readonly logger = new Logger(OpenAiDiscoveryProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      return {
        providerKey: this.key,
        targets: [],
        metadata: { configured: false, reason: 'OPENAI_API_KEY is not configured' },
      };
    }

    const model = this.configService.get<string>('OPENAI_DISCOVERY_MODEL', 'gpt-5.4');
    const input = this.buildPrompt(request);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
        input,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenAI discovery error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI discovery error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const rawOutputText = this.responseOutputText(data);
    const outputText = this.extractJsonObject(rawOutputText);
    const parsed = JSON.parse(outputText) as {
      targets?: Array<{
        title?: string;
        companyName?: string;
        personName?: string;
        roleTitle?: string;
        email?: string;
        website?: string;
        linkedinUrl?: string;
        location?: string;
        sourceUrl?: string;
        confidenceScore?: number;
        relevanceScore?: number;
        qualificationScore?: number;
        whyThisTarget?: string;
        recommendedAction?: string;
      }>;
      firms?: Array<{
        firm?: string;
        specialty?: string;
        why_top?: string;
        contacts?: Array<{
          name?: string;
          title?: string;
          email?: string;
          source?: string;
        }>;
      }>;
    };

    const sources = this.extractSources(data);
    const normalizedTargets = this.normalizeTargets(parsed, sources);
    const targets = normalizedTargets
      .slice(0, request.maxTargets)
      .map((target, index) => this.toTarget(target, sources[index] ?? sources[0], index));

    return {
      providerKey: this.key,
      targets,
      metadata: {
        configured: true,
        model,
        sourceCount: sources.length,
      },
    };
  }

  private buildPrompt(request: DiscoveryProviderRequest): string {
    return [
      'Search the web and extract recruiter or recruiting contact candidates relevant to this campaign.',
      `Query: ${request.query}`,
      `Target segment: ${request.targetSegment ?? 'not provided'}`,
      `Max targets: ${request.maxTargets}`,
      'Return only valid JSON with a flat targets array and no markdown fences or commentary.',
      'Each item in targets should represent one company or one person/contact candidate.',
      '{',
      '  "targets": [',
      '    {',
      '      "title": "display title",',
      '      "companyName": "company or recruiting firm",',
      '      "personName": "person if known",',
      '      "roleTitle": "role if known",',
      '      "email": "email if explicit on page or snippet",',
      '      "website": "base website if known",',
      '      "linkedinUrl": "linkedin url if explicit",',
      '      "location": "location if known",',
      '      "sourceUrl": "best source url",',
      '      "confidenceScore": 0-100,',
      '      "relevanceScore": 0-100,',
      '      "qualificationScore": 0-100,',
      '      "whyThisTarget": "why relevant",',
      '      "recommendedAction": "next action"',
      '    }',
      '  ]',
      '}',
      'Use only information grounded in search results. Prefer explicit recruiter firms and published contact/team pages. Do not invent emails.',
      'If you find a firm with multiple contacts, emit one target item per contact rather than grouping them under the firm.',
    ].join('\n');
  }

  private normalizeTargets(
    parsed: {
      targets?: Array<{
        title?: string;
        companyName?: string;
        personName?: string;
        roleTitle?: string;
        email?: string;
        website?: string;
        linkedinUrl?: string;
        location?: string;
        sourceUrl?: string;
        confidenceScore?: number;
        relevanceScore?: number;
        qualificationScore?: number;
        whyThisTarget?: string;
        recommendedAction?: string;
      }>;
      firms?: Array<{
        firm?: string;
        specialty?: string;
        why_top?: string;
        contacts?: Array<{
          name?: string;
          title?: string;
          email?: string;
          source?: string;
        }>;
      }>;
    },
    sources: Array<{ url?: string; title?: string }>,
  ): Array<{
    title?: string;
    companyName?: string;
    personName?: string;
    roleTitle?: string;
    email?: string;
    website?: string;
    linkedinUrl?: string;
    location?: string;
    sourceUrl?: string;
    confidenceScore?: number;
    relevanceScore?: number;
    qualificationScore?: number;
    whyThisTarget?: string;
    recommendedAction?: string;
  }> {
    if (Array.isArray(parsed.targets) && parsed.targets.length > 0) {
      return parsed.targets;
    }

    const normalized: Array<{
      title?: string;
      companyName?: string;
      personName?: string;
      roleTitle?: string;
      email?: string;
      website?: string;
      linkedinUrl?: string;
      location?: string;
      sourceUrl?: string;
      confidenceScore?: number;
      relevanceScore?: number;
      qualificationScore?: number;
      whyThisTarget?: string;
      recommendedAction?: string;
    }> = [];

    for (const firm of parsed.firms ?? []) {
      const firmName = firm.firm?.trim();
      const why = firm.why_top?.trim() || firm.specialty?.trim();
      const contacts = Array.isArray(firm.contacts) ? firm.contacts : [];

      if (contacts.length === 0) {
        normalized.push({
          title: firmName,
          companyName: firmName,
          sourceUrl: sources[0]?.url,
          confidenceScore: 68,
          relevanceScore: 80,
          qualificationScore: 75,
          whyThisTarget: why || 'Relevant recruiting firm found through OpenAI web search.',
          recommendedAction: 'Review this firm and identify the best recruiter contact for first outreach.',
        });
        continue;
      }

      for (const contact of contacts) {
        const sourceUrl = contact.source?.trim();
        normalized.push({
          title: [contact.name?.trim(), firmName].filter(Boolean).join(' - ') || firmName,
          companyName: firmName,
          personName: contact.name?.trim(),
          roleTitle: contact.title?.trim(),
          email: contact.email?.trim()?.toLowerCase(),
          sourceUrl,
          website: this.baseWebsite(sourceUrl),
          confidenceScore: contact.email ? 86 : 72,
          relevanceScore: 84,
          qualificationScore: 82,
          whyThisTarget: why || `${firmName ?? 'This recruiting firm'} appears relevant to the recruiter campaign.`,
          recommendedAction: contact.email
            ? 'Review the contact details and generate first-touch outreach.'
            : 'Verify the contact details before generating outreach.',
        });
      }
    }

    return normalized;
  }

  private extractJsonObject(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match?.[0]) {
      return match[0];
    }

    return '{"targets":[]}';
  }

  private responseOutputText(data: any): string {
    if (typeof data?.output_text === 'string' && data.output_text.trim().length > 0) {
      return data.output_text;
    }

    const output = Array.isArray(data?.output) ? data.output : [];
    for (const item of output) {
      if (item?.type !== 'message') continue;
      const content = Array.isArray(item.content) ? item.content : [];
      for (const part of content) {
        if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim().length > 0) {
          return part.text;
        }
      }
    }

    return '{}';
  }

  private extractSources(data: any): Array<{ url?: string; title?: string }> {
    const output = Array.isArray(data.output) ? data.output : [];
    const sources: Array<{ url?: string; title?: string }> = [];

    for (const item of output) {
      if (item?.type !== 'web_search_call') continue;
      const action = item.action;
      const actionSources = Array.isArray(action?.sources) ? action.sources : [];
      for (const source of actionSources) {
        sources.push({
          url: typeof source?.url === 'string' ? source.url : undefined,
          title: typeof source?.title === 'string' ? source.title : undefined,
        });
      }
    }

    return sources;
  }

  private toTarget(
    target: {
      title?: string;
      companyName?: string;
      personName?: string;
      roleTitle?: string;
      email?: string;
      website?: string;
      linkedinUrl?: string;
      location?: string;
      sourceUrl?: string;
      confidenceScore?: number;
      relevanceScore?: number;
      qualificationScore?: number;
      whyThisTarget?: string;
      recommendedAction?: string;
    },
    source: { url?: string; title?: string } | undefined,
    index: number,
  ): DiscoveryProviderTarget {
    const title = target.title?.trim() || target.personName?.trim() || target.companyName?.trim() || `OpenAI target ${index + 1}`;
    const sourceUrl = target.sourceUrl?.trim() || source?.url;
    const website = target.website?.trim() || this.baseWebsite(sourceUrl);
    const companyName = target.companyName?.trim() || source?.title?.trim() || title;
    const personName = target.personName?.trim();

    return {
      targetType: personName || target.email ? DiscoveryTargetType.person : DiscoveryTargetType.company,
      title,
      companyName,
      personName,
      roleTitle: target.roleTitle?.trim(),
      email: target.email?.trim()?.toLowerCase(),
      website,
      linkedinUrl: target.linkedinUrl?.trim(),
      location: target.location?.trim(),
      sourceUrl,
      confidenceScore: this.normalizeScore(target.confidenceScore, personName || target.email ? 78 : 68),
      relevanceScore: this.normalizeScore(target.relevanceScore, 80),
      qualificationScore: this.normalizeScore(target.qualificationScore, 79),
      whyThisTarget: target.whyThisTarget?.trim() || 'Found through OpenAI web search and appears relevant to the current recruiter campaign.',
      recommendedAction: target.recommendedAction?.trim() || 'Review this candidate, verify the contact details, then generate first-touch outreach.',
      metadata: {
        provider: this.key,
      },
      evidence: [
        {
          evidenceType: DiscoveryEvidenceType.search_result,
          title: source?.title || title,
          sourceUrl,
          sourceName: 'OpenAI Web Search',
          snippet: target.whyThisTarget?.trim() || title,
          confidenceScore: this.normalizeScore(target.confidenceScore, personName || target.email ? 78 : 68),
        },
      ],
    };
  }

  private normalizeScore(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private baseWebsite(url?: string): string | undefined {
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return undefined;
    }
  }
}
