import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './interfaces/ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { OpenRouterAiProvider } from './providers/openrouter.provider';
import { MockAiProvider } from './providers/mock.provider';

@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);
  private providers: Map<string, AiProvider> = new Map();

  constructor(
    private configService: ConfigService,
    openAiProvider: OpenAiProvider,
    openRouterProvider: OpenRouterAiProvider,
    mockProvider: MockAiProvider,
  ) {
    this.providers.set('openai', openAiProvider);
    this.providers.set('openrouter', openRouterProvider);
    this.providers.set('mock', mockProvider);
  }

  getProvider(): AiProvider {
    const isMockForced = this.configService.get<string | boolean>('MOCK_AI') === 'true' || 
                         this.configService.get<string | boolean>('MOCK_AI') === true;
    
    const defaultProvider = isMockForced ? 'mock' : 'openrouter';
    const providerName = this.configService.get<string>('AI_PROVIDER', defaultProvider);
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`AI provider '${providerName}' not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    if (!provider.isConfigured()) {
      throw new Error(`AI provider '${providerName}' is not properly configured. Check environment variables.`);
    }

    this.logger.log(`Using AI provider: ${providerName}`);
    return provider;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  addProvider(name: string, provider: AiProvider): void {
    this.providers.set(name, provider);
    this.logger.log(`Added AI provider: ${name}`);
  }
}
