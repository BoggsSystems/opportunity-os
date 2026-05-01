import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiRequest, AiResponse } from '../interfaces/ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  private readonly logger = new Logger(MockAiProvider.name);
  readonly name = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async generateText(request: AiRequest): Promise<AiResponse> {
    this.logger.log(`Mock AI generating response for prompt: ${request.prompt?.substring(0, 50)}...`);
    
    let content = 'I am a mock AI. This is a default response.';
    const prompt = (request.prompt || '').toLowerCase() || 
                  (request.messages?.[request.messages.length - 1]?.content as string || '').toLowerCase();

    // 1. Discovery Queries
    if (prompt.includes('discovery query') || prompt.includes('sales prospector')) {
      content = 'VP of Sales OR Director of Revenue Operations "Series B" SaaS "San Francisco"';
    }

    // 2. Revenue Lanes (JSON)
    else if (prompt.includes('revenue lanes')) {
      content = JSON.stringify([
        {
          id: 'fractional-cro',
          title: 'Fractional CRO for SaaS',
          description: 'High-leverage sales leadership for series A/B companies.',
          evidence: 'You have a dense network of SaaS founders and experience scaling sales teams.',
          targetAudience: 'SaaS Founders'
        },
        {
          id: 'sales-velocity-audit',
          title: 'Sales Velocity Audit',
          description: 'A 4-week sprint to find choke points in your sales funnel.',
          evidence: 'Your "Velocity Framework" IP is uniquely suited for this.',
          targetAudience: 'Head of Sales'
        }
      ]);
    }

    // 3. Campaigns (JSON)
    else if (prompt.includes('propose one campaign per revenue lane')) {
      content = JSON.stringify([
        {
          id: 'cro-outreach-sprint',
          laneId: 'fractional-cro',
          laneTitle: 'Fractional CRO for SaaS',
          title: 'Founder-to-Founder GTM Sprint',
          description: 'Direct outreach to series B founders using the Velocity IP.',
          duration: '90 days',
          targetSegment: 'Founders at Series B SaaS companies',
          channel: 'LinkedIn DM',
          messagingHook: 'The Velocity Framework',
          goalMetric: '10 discovery calls'
        }
      ]);
    }

    // 4. Action Lanes (JSON)
    else if (prompt.includes('propose action lanes')) {
      content = JSON.stringify([
        {
          id: 'li-dm-sprint',
          type: 'linkedin_dm',
          title: 'Founder LinkedIn DM Sprint',
          description: 'Direct messages to high-intent founders.',
          tactics: ['Share Velocity snippet', 'Request 15-min coffee chat'],
          requiredConnectors: ['linkedin'],
          campaignIds: ['cro-outreach-sprint']
        }
      ]);
    }

    // 5. Conversation Synthesis (JSON)
    else if (prompt.includes('synthesize campaign conversation feedback')) {
      content = JSON.stringify({
        summary: 'Lead expressed interest in the Velocity Framework but asked about the pricing model.',
        sentiment: 'positive',
        intent: 'pricing_inquiry',
        objections: ['Pricing transparency'],
        buyingSignals: ['Asked for an example'],
        recommendedNextAction: 'Send the pricing breakdown and a case study',
        suggestedActionType: 'email_outreach',
        draftFollowUp: 'Glad you liked the framework! Regarding pricing, we typically...',
        priorityScore: 85
      });
    }

    // 6. General Assistant Conversation
    else if (prompt.includes('strategic commander') || prompt.includes('assistant')) {
      content = "I've analyzed your current strategy. It looks like your network in the SaaS space is particularly strong right now. I recommend we focus on the 'Fractional CRO' lane for your next campaign. Shall we proceed?";
    }

    return {
      content,
      model: request.model || 'mock-model',
      provider: 'mock'
    };
  }
}
