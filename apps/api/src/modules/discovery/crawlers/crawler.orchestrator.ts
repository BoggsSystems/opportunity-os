import { Injectable, Logger } from '@nestjs/common';
import { IWebCrawler, WebCrawlerOptions, WebCrawlerResult } from './web-crawler.interface';
import { SimpleHttpCrawler } from './simple-http.crawler';

@Injectable()
export class CrawlerOrchestrator {
  private readonly logger = new Logger(CrawlerOrchestrator.name);
  private readonly crawlers: Map<string, IWebCrawler> = new Map();

  constructor(
    private readonly simpleHttpCrawler: SimpleHttpCrawler
  ) {
    this.registerCrawler(this.simpleHttpCrawler);
  }

  private registerCrawler(crawler: IWebCrawler) {
    this.crawlers.set(crawler.key, crawler);
  }

  async crawl(url: string, options?: WebCrawlerOptions): Promise<WebCrawlerResult> {
    this.logger.log(`Orchestrating crawl for: ${url}`);

    // In a mature system, we would have logic to choose the right crawler
    // e.g., if domain is LinkedIn, don't use simple-http, use a premium proxy/browser.
    // For Phase 1 MVP, we try simple_http first.
    
    const primaryCrawler = this.crawlers.get('simple_http');
    
    if (!primaryCrawler) {
      throw new Error('No crawlers registered');
    }

    try {
      const result = await primaryCrawler.crawl(url, options);
      
      if (!result.success && result.error?.includes('403')) {
        this.logger.warn(`Primary crawler blocked by 403. Fallback required (Not implemented yet)`);
        // Here we would fallback to Firecrawl or Browserless
      }
      
      return result;
    } catch (error: any) {
      this.logger.error(`Crawl orchestration failed for ${url}: ${error.message}`);
      return {
        url,
        text: '',
        success: false,
        error: error.message,
        providerKey: 'orchestrator'
      };
    }
  }
}
