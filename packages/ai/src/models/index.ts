// AI model definitions and interfaces

export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'local';
  capabilities: string[];
  maxTokens?: number;
  costPerToken?: number;
}

export interface AIResponse {
  content: string;
  tokensUsed: number;
  cost: number;
  model: string;
  metadata?: Record<string, any>;
}

export interface AIRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}
