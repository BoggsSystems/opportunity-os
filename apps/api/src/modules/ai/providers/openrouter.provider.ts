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

      const requestBody: any = {
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1000,
      };

      if (request.tools && request.tools.length > 0) {
        requestBody.tools = request.tools;
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://opportunity-os.com',
          'X-Title': 'Opportunity OS',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenRouter API error: ${response.status} - ${errorText}`);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      return {
        content: data.choices?.[0]?.message?.content || '',
        tool_calls: data.choices?.[0]?.message?.tool_calls,
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

  async *streamText(request: AiRequest): AsyncGenerator<string, void, unknown> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter provider not configured: missing API key');
    }

    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    const baseUrl = this.configService.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1');
    const model = this.configService.get<string>('OPENROUTER_MODEL', 'anthropic/claude-3-haiku');

    try {
      this.logger.log(`Making OpenRouter stream request with model: ${model}`);
      
      const messages: AiMessage[] = request.messages ? request.messages : [
        {
          role: 'user',
          content: request.prompt || '',
        },
      ];

      const requestBody: any = {
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1000,
        stream: true,
      };

      if (request.tools && request.tools.length > 0) {
        requestBody.tools = request.tools;
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://opportunity-os.com',
          'X-Title': 'Opportunity OS',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`OpenRouter API error: ${response.status} - ${errorText}`);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body from OpenRouter stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the incomplete line in the buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') {
              return;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.choices && data.choices[0] && data.choices[0].delta) {
                const delta = data.choices[0].delta;
                if (delta.content) {
                  this.logger.debug(`[OpenRouter Stream] Content chunk: ${delta.content.substring(0, 50)}...`);
                  yield delta.content;
                }
                if (delta.tool_calls) {
                  this.logger.log(`[OpenRouter Stream] TOOL CALLS received: ${JSON.stringify(delta.tool_calls).substring(0, 200)}`);
                  yield JSON.stringify({ _tool_calls: delta.tool_calls });
                }
              }
            } catch (e) {
              this.logger.warn(`Failed to parse OpenRouter stream chunk: ${dataStr}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('OpenRouter stream request failed', error);
      throw error;
    }
  }
}
