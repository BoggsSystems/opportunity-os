import { Injectable, Logger } from '@nestjs/common';
import { AiProviderFactory } from './ai-provider.factory';
import { AiRequest } from './interfaces/ai-provider.interface';

type ConversationRole = 'system' | 'user' | 'assistant';

interface ConversationTurn {
  role: ConversationRole;
  text: string;
}

interface ConversationContext {
  workspaceState?: string;
  nextAction?: {
    title?: string;
    reason?: string;
    recommendedAction?: string;
  };
  opportunity?: {
    title?: string;
    companyName?: string;
    summary?: string;
  };
  contentItem?: {
    title?: string;
    summary?: string;
    source?: string;
  };
}

interface ConversationSessionState {
  history: ConversationTurn[];
  updatedAt: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly conversationSessions = new Map<string, ConversationSessionState>();

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

  async converse(input: {
    sessionId?: string;
    message: string;
    history?: ConversationTurn[];
    context?: ConversationContext;
  }): Promise<{ sessionId: string; reply: string }> {
    this.logger.log(
      `Generating conversational assistant response sessionId=${input.sessionId ?? 'new'} historyCount=${input.history?.length ?? 0} workspaceState=${input.context?.workspaceState ?? 'unknown'} message=${input.message}`,
    );

    const sessionId = input.sessionId ?? crypto.randomUUID();
    const session = this.conversationSessions.get(sessionId);
    const history = this.mergeConversationHistory(
      session?.history ?? [],
      input.history ?? [],
    );
    this.logger.log(
      `Conversation state prepared sessionId=${sessionId} mergedHistoryCount=${history.length} hadStoredSession=${session != null}`,
    );
    const prompt = this.buildConversationPrompt({
      ...input,
      history,
    });
    this.logger.log(`Conversation prompt preview sessionId=${sessionId} prompt=${prompt.slice(0, 400)}`);
    const request: AiRequest = {
      prompt,
      temperature: 0.6,
      maxTokens: 500,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    const reply = response.content.trim();
    this.logger.log(`Provider reply sessionId=${sessionId} reply=${reply.slice(0, 300)}`);
    this.storeConversationSession(sessionId, history, input.message, reply);
    return { sessionId, reply };
  }

  streamReplyChunks(reply: string): string[] {
    const sentences = reply
      .split(/(?<=[.!?])\s+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (sentences.length > 1) {
      const chunks = sentences.map((sentence, index) =>
        index < sentences.length - 1 ? `${sentence} ` : sentence,
      );
      this.logger.log(`Chunked reply into ${chunks.length} sentence chunk(s)`);
      return chunks;
    }

    const words = reply.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      this.logger.log('Chunked reply into 1 short chunk');
      return [reply];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
      const candidate = currentChunk ? `${currentChunk} ${word}` : word;
      if (candidate.length > 24 && currentChunk) {
        chunks.push(`${currentChunk} `);
        currentChunk = word;
      } else {
        currentChunk = candidate;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    this.logger.log(`Chunked reply into ${chunks.length} word chunk(s)`);
    return chunks;
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

  private buildConversationPrompt(input: {
    message: string;
    history?: ConversationTurn[];
    context?: ConversationContext;
  }): string {
    const history = (input.history ?? [])
      .slice(-8)
      .map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`)
      .join('\n');

    const contextLines = [
      input.context?.workspaceState ? `- Workspace state: ${input.context.workspaceState}` : null,
      input.context?.nextAction?.title ? `- Next action: ${input.context.nextAction.title}` : null,
      input.context?.nextAction?.reason ? `- Why this action matters: ${input.context.nextAction.reason}` : null,
      input.context?.nextAction?.recommendedAction ? `- Recommended move: ${input.context.nextAction.recommendedAction}` : null,
      input.context?.opportunity?.title ? `- Opportunity: ${input.context.opportunity.title}` : null,
      input.context?.opportunity?.companyName ? `- Company: ${input.context.opportunity.companyName}` : null,
      input.context?.opportunity?.summary ? `- Opportunity summary: ${input.context.opportunity.summary}` : null,
      input.context?.contentItem?.title ? `- Active content item: ${input.context.contentItem.title}` : null,
      input.context?.contentItem?.summary ? `- Content summary: ${input.context.contentItem.summary}` : null,
      input.context?.contentItem?.source ? `- Content source: ${input.context.contentItem.source}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return `
You are Opportunity OS, a calm, voice-first assistant guiding a user through business outreach cycles on iPhone.

Your job:
- respond conversationally, as if speaking aloud
- keep replies concise and natural for voice playback
- stay grounded in the current action/workspace context
- help the user advance the next operational step without sounding robotic
- when asked about calls, pre-call prep, or post-call debrief, respond as a helpful assistant preparing that workflow

Rules:
- keep most responses to 2-5 spoken sentences
- avoid markdown, bullets, or labels unless the user explicitly asks for them
- if the user asks "what next", recommend the most relevant current step from context
- do not invent business facts that are not present in the context

Current workspace context:
${contextLines || '- No special workspace context is active.'}

Recent conversation:
${history || 'ASSISTANT: We are starting a fresh voice session.'}

USER: ${input.message}
ASSISTANT:
    `.trim();
  }

  private mergeConversationHistory(
    sessionHistory: ConversationTurn[],
    requestHistory: ConversationTurn[],
  ): ConversationTurn[] {
    const combined = [...sessionHistory];

    for (const turn of requestHistory) {
      const isDuplicate =
        combined.length > 0 &&
        combined[combined.length - 1]?.role === turn.role &&
        combined[combined.length - 1]?.text === turn.text;

      if (!isDuplicate) {
        combined.push(turn);
      }
    }

    return combined.slice(-12);
  }

  private storeConversationSession(
    sessionId: string,
    history: ConversationTurn[],
    userMessage: string,
    assistantReply: string,
  ) {
    const updatedHistory = [
      ...history,
      { role: 'user' as const, text: userMessage },
      { role: 'assistant' as const, text: assistantReply },
    ].slice(-14);

    this.conversationSessions.set(sessionId, {
      history: updatedHistory,
      updatedAt: Date.now(),
    });
    this.logger.log(
      `Stored conversation session sessionId=${sessionId} historyCount=${updatedHistory.length}`,
    );

    this.pruneConversationSessions();
  }

  private pruneConversationSessions() {
    const cutoff = Date.now() - 1000 * 60 * 60;
    let removedCount = 0;
    for (const [sessionId, session] of this.conversationSessions.entries()) {
      if (session.updatedAt < cutoff) {
        this.conversationSessions.delete(sessionId);
        removedCount += 1;
      }
    }
    if (removedCount > 0) {
      this.logger.log(`Pruned ${removedCount} expired conversation session(s)`);
    }
  }
}
