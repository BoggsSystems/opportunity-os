export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface AiRequest {
  prompt?: string;
  messages?: AiMessage[];
  context?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  tools?: any[];
}

export interface AiResponse {
  content: string;
  tool_calls?: any[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model?: string;
  provider?: string;
}

export interface AiProvider {
  name: string;
  isConfigured(): boolean;
  generateText(request: AiRequest): Promise<AiResponse>;
  streamText?(request: AiRequest): AsyncGenerator<string, void, unknown>;
}

export interface AiProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
