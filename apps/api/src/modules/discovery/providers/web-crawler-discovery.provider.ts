import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryProvider, DiscoveryProviderRequest, DiscoveryProviderResult, DiscoveryProviderTarget } from './discovery-provider.interface';
import { CrawlerOrchestrator } from '../crawlers/crawler.orchestrator';
import { AiService } from '../../ai/ai.service';
import { DiscoveryTargetType } from '@opportunity-os/db';

@Injectable()
export class WebCrawlerDiscoveryProvider implements DiscoveryProvider {
  public readonly key = 'web_crawler';
  private readonly logger = new Logger(WebCrawlerDiscoveryProvider.name);

  constructor(
    private readonly crawlerOrchestrator: CrawlerOrchestrator,
    private readonly aiService: AiService
  ) {}

  async discover(request: DiscoveryProviderRequest): Promise<DiscoveryProviderResult> {
    this.logger.log(`Executing web crawl discovery for query: ${request.query}`);

    const targets: DiscoveryProviderTarget[] = [];
    const context = request.context || {};
    
    // For Phase 1 MVP, we assume the user provides specific URLs in the context,
    // OR we treat the 'query' as a URL if it starts with http.
    const urlsToCrawl: string[] = [];
    
    if (request.query.startsWith('http')) {
      urlsToCrawl.push(request.query);
    }
    
    if (context['targetUrls'] && Array.isArray(context['targetUrls'])) {
      urlsToCrawl.push(...context['targetUrls'].filter(url => typeof url === 'string'));
    }

    if (urlsToCrawl.length === 0) {
      throw new Error('WebCrawlerProvider requires a URL in the query or context.targetUrls');
    }

    for (const url of urlsToCrawl.slice(0, 5)) { // Limit to 5 for safety
      try {
        const crawlResult = await this.crawlerOrchestrator.crawl(url);
        
        if (!crawlResult.success || !crawlResult.text) {
          this.logger.warn(`Failed to extract text from ${url}`);
          continue;
        }

        const extracted = await this.aiService.extractTargetSignalsFromText(crawlResult.text, {
          targetSegment: request.targetSegment,
          campaignContext: context['campaign'],
          offeringContext: context['offering']
        });

        targets.push({
          targetType: extracted.personName ? DiscoveryTargetType.person : DiscoveryTargetType.company,
          title: extracted.title,
          personName: extracted.personName,
          roleTitle: extracted.roleTitle,
          companyName: extracted.companyName,
          email: extracted.email,
          linkedinUrl: extracted.linkedinUrl,
          sourceUrl: url,
          confidenceScore: extracted.relevanceScore, // Using relevance as confidence for MVP
          relevanceScore: extracted.relevanceScore,
          whyThisTarget: extracted.whyThisTarget,
          recommendedAction: extracted.recommendedAction,
          evidence: extracted.evidence,
          metadata: {
            dataSource: 'web_crawler',
            providerCrawled: crawlResult.providerKey
          }
        });

      } catch (error: any) {
        this.logger.error(`Error processing URL ${url}: ${error.message}`);
      }
    }

    return {
      providerKey: this.key,
      targets,
      metadata: {
        urlsCrawled: urlsToCrawl.length,
        successfulCrawls: targets.length
      }
    };
  }
}
