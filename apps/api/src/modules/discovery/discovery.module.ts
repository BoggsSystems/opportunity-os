import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { AiModule } from '../ai/ai.module';
import { OpenAiDiscoveryProvider } from './providers/openai-discovery.provider';
import { TavilyDiscoveryProvider } from './providers/tavily-discovery.provider';
import { PerplexityDiscoveryProvider } from './providers/perplexity-discovery.provider';
import { ApolloDiscoveryProvider } from './providers/apollo-discovery.provider';

@Module({
  imports: [AiModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    TavilyDiscoveryProvider,
    OpenAiDiscoveryProvider,
    PerplexityDiscoveryProvider,
    ApolloDiscoveryProvider,
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
