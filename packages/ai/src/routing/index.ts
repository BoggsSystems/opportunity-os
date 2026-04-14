// AI request routing and model selection

import type { AIRequest, AIModel } from '../models';

export interface ModelSelector {
  selectModel(request: AIRequest): AIModel;
}

export class DefaultModelSelector implements ModelSelector {
  selectModel(request: AIRequest): AIModel {
    // Default routing logic
    if (request.prompt.includes('summarize')) {
      return {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        capabilities: ['text-generation'],
        maxTokens: 4096,
        costPerToken: 0.000002,
      };
    }

    // Default to a general-purpose model
    return {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      capabilities: ['text-generation', 'analysis'],
      maxTokens: 8192,
      costPerToken: 0.00003,
    };
  }
}
