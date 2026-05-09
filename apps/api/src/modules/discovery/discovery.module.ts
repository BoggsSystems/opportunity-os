import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { AiModule } from '../ai/ai.module';
import { OpenAiDiscoveryProvider } from './providers/openai-discovery.provider';
import { TavilyDiscoveryProvider } from './providers/tavily-discovery.provider';
import { PerplexityDiscoveryProvider } from './providers/perplexity-discovery.provider';
import { ApolloDiscoveryProvider } from './providers/apollo-discovery.provider';
import { WebCrawlerDiscoveryProvider } from './providers/web-crawler-discovery.provider';
import { SimpleHttpCrawler } from './crawlers/simple-http.crawler';
import { CrawlerOrchestrator } from './crawlers/crawler.orchestrator';

@Module({
  imports: [AiModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    TavilyDiscoveryProvider,
    OpenAiDiscoveryProvider,
    PerplexityDiscoveryProvider,
    ApolloDiscoveryProvider,
    WebCrawlerDiscoveryProvider,
    SimpleHttpCrawler,
    CrawlerOrchestrator,
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
