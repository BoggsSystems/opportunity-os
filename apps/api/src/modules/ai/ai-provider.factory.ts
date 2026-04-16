import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './interfaces/ai-provider.interface';
import { OpenRouterAiProvider } from './providers/openrouter.provider';

@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);
  private providers: Map<string, AiProvider> = new Map();

  constructor(
    private configService: ConfigService,
    openRouterProvider: OpenRouterAiProvider,
  ) {
    this.providers.set('openrouter', openRouterProvider);
  }

  getProvider(): AiProvider {
    const providerName = this.configService.get<string>('AI_PROVIDER', 'openrouter');
    
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
