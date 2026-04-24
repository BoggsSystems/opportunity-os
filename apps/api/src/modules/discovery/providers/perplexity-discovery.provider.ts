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
export class PerplexityDiscoveryProvider implements DiscoveryProvider {
  private readonly logger = new Logger(PerplexityDiscoveryProvider.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly defaultMode: 'agent' | 'search';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PERPLEXITY_API_KEY');
    this.model = this.configService.get<string>('PERPLEXITY_MODEL') || 'sonar-reasoning';
    this.defaultMode = (this.configService.get<string>('PERPLEXITY_DISCOVERY_MODE') as any) || 'agent';
  }

  readonly key = 'perplexity_research';
  readonly name = 'Perplexity Deep Research';

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    if (!this.apiKey) {
      this.logger.warn('PERPLEXITY_API_KEY is not configured. Skipping Perplexity discovery.');
      return {
        providerKey: this.key,
        targets: [],
        metadata: { configured: false, error: 'API key not configured' },
      };
    }

    const mode = (request.context?.['discoveryMode'] as 'agent' | 'search') || this.defaultMode;

    try {
      if (mode === 'search') {
        return this.runSearchMode(request);
      } else {
        return this.runAgentMode(request);
      }
    } catch (error) {
      this.logger.error(`Failed to perform Perplexity discovery (${mode} mode)`, error);
      return {
        providerKey: this.key,
        targets: [],
        metadata: { configured: true, mode, error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * AGENT MODE: Deep research and synthesis using Sonar models.
   * Best for finding specific "Signals" and "Why this target" context.
   */
  private async runAgentMode(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    this.logger.log(`Performing Perplexity AGENT research for: "${request.query}"`);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.buildAgentSystemPrompt(),
          },
          {
            role: 'user',
            content: this.buildAgentUserPrompt(request),
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agent API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from Perplexity Agent');
    }

    const parsed = JSON.parse(content);
    const targets = (parsed.targets || []).map((t: any, index: number) => this.mapTarget(t, index));

    return {
      providerKey: this.key,
      targets: targets.slice(0, request.maxTargets),
      metadata: {
        configured: true,
        mode: 'agent',
        model: this.model,
        usage: data.usage,
        citations: data.citations,
      },
    };
  }

  /**
   * SEARCH MODE: Raw, ranked web search results.
   * Best for high-speed link discovery and broad mapping.
   */
  private async runSearchMode(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    this.logger.log(`Performing Perplexity SEARCH for: "${request.query}"`);

    const response = await fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: request.query,
        max_results: request.maxTargets * 3, // Over-fetch for ranking
        search_depth: 'advanced',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    
    // Search mode returns raw results which we need to synthesize into Targets
    // For now, we map them directly as company/site targets
    const targets = (data.results || []).map((r: any, index: number) => ({
      targetType: DiscoveryTargetType.company,
      title: r.title,
      companyName: r.title,
      website: r.url,
      confidenceScore: Math.round(r.score * 100) || 70,
      relevanceScore: Math.round(r.score * 100) || 70,
      whyThisTarget: r.content || 'Found via ranked search.',
      recommendedAction: `Research recent activity on ${r.url}`,
      evidence: [
        {
          evidenceType: DiscoveryEvidenceType.search_result,
          title: r.title,
          sourceUrl: r.url,
          sourceName: 'Perplexity Search',
          snippet: r.content,
        },
      ],
      metadata: { index },
    }));

    return {
      providerKey: this.key,
      targets: targets.slice(0, request.maxTargets),
      metadata: {
        configured: true,
        mode: 'search',
        resultCount: data.results?.length || 0,
      },
    };
  }

  private buildAgentSystemPrompt(): string {
    return `You are an elite executive researcher and technical prospector. Your task is to identify high-intent individuals and companies based on specific research queries.

For every target you identify, you must provide:
1. Full Name and Current Title.
2. Company Name and Website.
3. A "Signal": A specific, recent (2024-2025) piece of evidence showing their interest in the topic (e.g., a talk at a conference, a published article, a podcast interview, or a verified product launch).
4. Relevance Score: 0-100 based on how well they match the query.

You MUST respond in valid JSON format:
{
  "targets": [
    {
      "personName": "string",
      "title": "string",
      "companyName": "string",
      "website": "string",
      "linkedinUrl": "string",
      "relevanceScore": number,
      "signal": "string",
      "whyThisTarget": "string"
    }
  ]
}`;
  }

  private buildAgentUserPrompt(request: DiscoveryProviderRequest): string {
    let prompt = `Research Query: ${request.query}\n`;
    if (request.targetSegment) {
      prompt += `Target Segment: ${request.targetSegment}\n`;
    }
    prompt += `Max results: ${request.maxTargets || 5}\n`;
    prompt += `Focus on finding technical leaders (CTOs, VPs of Engineering) or specific decision-makers.`;
    return prompt;
  }

  private mapTarget(t: any, index: number): DiscoveryProviderTarget {
    return {
      targetType: DiscoveryTargetType.person,
      personName: t.personName,
      companyName: t.companyName,
      title: t.title,
      website: t.website,
      linkedinUrl: t.linkedinUrl,
      relevanceScore: t.relevanceScore || 70,
      confidenceScore: 85,
      whyThisTarget: t.whyThisTarget || t.signal,
      recommendedAction: `Reference their recent involvement in: ${t.signal}`,
      evidence: [
        {
          evidenceType: DiscoveryEvidenceType.search_result,
          title: `Research Signal: ${t.signal}`,
          sourceName: 'Perplexity Deep Research',
          snippet: t.signal,
          confidenceScore: 90,
        },
      ],
      metadata: {
        signal: t.signal,
        index,
      },
    };
  }
}
