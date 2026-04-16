import { Injectable, Logger } from '@nestjs/common';
import { AiProviderFactory } from './ai-provider.factory';
import { AiRequest } from './interfaces/ai-provider.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private aiProviderFactory: AiProviderFactory) {}

  async summarizeText(input: string): Promise<string> {
    this.logger.log('Summarizing text with AI');
    
    const request: AiRequest = {
      prompt: `Please provide a concise summary of the following text:\n\n${input}`,
      temperature: 0.3,
      maxTokens: 500,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    return response.content;
  }

  async interpretOffering(offeringContext: any): Promise<any> {
    this.logger.log('Interpreting offering context with AI');
    
    const prompt = this.buildOfferingInterpretationPrompt(offeringContext);
    
    const request: AiRequest = {
      prompt,
      temperature: 0.5,
      maxTokens: 1000,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    
    try {
      // Try to parse structured response
      return JSON.parse(response.content);
    } catch (error) {
      this.logger.warn('Failed to parse AI response as JSON, returning raw content');
      return {
        interpretation: response.content,
        structured: false,
      };
    }
  }

  async generateText(prompt: string, options?: Partial<AiRequest>): Promise<string> {
    this.logger.log('Generating text with AI');
    
    const request: AiRequest = {
      prompt,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 1000,
      ...options,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    return response.content;
  }

  private buildOfferingInterpretationPrompt(offeringContext: any): string {
    return `
Analyze the following offering context and provide strategic insights in JSON format:

Offering Details:
- Title: ${offeringContext.offering?.title}
- Type: ${offeringContext.offering?.offeringType}
- Description: ${offeringContext.offering?.description}

Positionings:
${offeringContext.positionings?.map((p: any, i: number) => `${i + 1}. ${p.title}: ${p.description || 'No description'}`).join('\n')}

Assets:
${offeringContext.assets?.map((a: any, i: number) => `${i + 1}. ${a.title} (${a.assetType}): ${a.description || 'No description'}`).join('\n')}

Please provide a JSON response with this structure:
{
  "targetAudience": ["array of target audiences"],
  "likelyOpportunityTypes": ["array of opportunity types"],
  "likelyChannels": ["array of channels"],
  "supportingAssets": ["array of key assets"],
  "nextStepPatterns": ["array of next step patterns"],
  "strategicFocus": ["array of strategic focus areas"],
  "keyDifferentiators": ["array of key differentiators"]
}

Focus on practical, actionable insights that would help advance this offering.
    `.trim();
  }
}
