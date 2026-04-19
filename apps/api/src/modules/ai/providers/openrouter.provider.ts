import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiRequest, AiResponse, AiMessage } from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenRouterAiProvider implements AiProvider {
  name = 'openrouter';
  private readonly logger = new Logger(OpenRouterAiProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    return !!apiKey;
  }

  async generateText(request: AiRequest): Promise<AiResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter provider not configured: missing API key');
    }

    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    const baseUrl = this.configService.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
    const model = this.configService.get<string>('OPENROUTER_MODEL', 'anthropic/claude-3-haiku');

    try {
      this.logger.log(`Making OpenRouter request with model: ${model}`);
      
      const messages: AiMessage[] = request.messages ? request.messages : [
        {
          role: 'user',
          content: request.prompt || '',
        },
      ];

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://opportunity-os.com',
          'X-Title': 'Opportunity OS',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenRouter API error: ${response.status} - ${errorText}`);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        model: data.model,
        provider: this.name,
      };
    } catch (error) {
      this.logger.error('OpenRouter request failed', error);
      throw error;
    }
  }
}
