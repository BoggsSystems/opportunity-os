import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { TtsService } from './tts.service';
import { SearchService } from './search.service';
import { AiProviderFactory } from './ai-provider.factory';
import { OpenAiProvider } from './providers/openai.provider';
import { OpenRouterAiProvider } from './providers/openrouter.provider';
import { CapabilityIntegrationService } from './capability-integration.service';
import { CommercialModule } from '../commercial/commercial.module';

import { AssistantGateway } from './assistant.gateway';

@Module({
  imports: [ConfigModule, CommercialModule],
  controllers: [AiController],
  providers: [AiService, TtsService, SearchService, AiProviderFactory, OpenAiProvider, OpenRouterAiProvider, AssistantGateway, CapabilityIntegrationService],
  exports: [AiService, SearchService],
})
export class AiModule {}
