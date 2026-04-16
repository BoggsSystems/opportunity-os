import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiProviderFactory } from './ai-provider.factory';
import { OpenRouterAiProvider } from './providers/openrouter.provider';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [AiService, AiProviderFactory, OpenRouterAiProvider],
  exports: [AiService],
})
export class AiModule {}
