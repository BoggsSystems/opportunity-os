export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  prompt?: string;
  messages?: AiMessage[];
  context?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
}

export interface AiResponse {
  content: string;
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
}

export interface AiProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
