import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiMessage, AiProvider, AiRequest, AiResponse } from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return !!this.configService.get<string>('OPENAI_API_KEY');
  }

  async generateText(request: AiRequest): Promise<AiResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured: missing API key');
    }

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
    const model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    const messages = this.messagesFromRequest(request);

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1000,
    };

    if (request.tools?.length) {
      requestBody['tools'] = request.tools;
    }

    this.logger.log(`Making OpenAI request with model: ${model}`);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const message = data.choices?.[0]?.message;

    return {
      content: message?.content || '',
      tool_calls: message?.tool_calls,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      model: data.model,
      provider: this.name,
    };
  }

  async *streamText(request: AiRequest): AsyncGenerator<string, void, unknown> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider not configured: missing API key');
    }

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
    const model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    const messages = this.messagesFromRequest(request);

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1000,
      stream: true,
    };

    if (request.tools?.length) {
      requestBody['tools'] = request.tools;
    }

    this.logger.log(`Making OpenAI stream request with model: ${model}`);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenAI stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const dataStr = line.substring(6).trim();
        if (dataStr === '[DONE]') return;

        try {
          const data = JSON.parse(dataStr);
          const delta = data.choices?.[0]?.delta;
          if (delta?.content) {
            yield delta.content;
          }
          if (delta?.tool_calls) {
            yield JSON.stringify({ _tool_calls: delta.tool_calls });
          }
        } catch {
          this.logger.warn(`Failed to parse OpenAI stream chunk: ${dataStr}`);
        }
      }
    }
  }

  private messagesFromRequest(request: AiRequest): AiMessage[] {
    return request.messages ?? [
      {
        role: 'user',
        content: request.prompt || '',
      },
    ];
  }
}
