import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { AiModule } from '../ai/ai.module';
import { LocalDiscoveryProvider } from './providers/local-discovery.provider';
import { OpenAiDiscoveryProvider } from './providers/openai-discovery.provider';
import { TavilyDiscoveryProvider } from './providers/tavily-discovery.provider';

@Module({
  imports: [AiModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, LocalDiscoveryProvider, TavilyDiscoveryProvider, OpenAiDiscoveryProvider],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
