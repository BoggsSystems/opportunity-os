import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { 
  prisma, 
  AIConversationPurpose, 
  AIConversationMessageType, 
  AIConversationStatus,
  AIContextSummaryType,
  AIContextSummarySourceType
} from '@opportunity-os/db';
import { AiProviderFactory } from './ai-provider.factory';
import { AiRequest, AiMessage } from './interfaces/ai-provider.interface';

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

  async converse(input: {
    userId?: string;
    userName?: string;
    sessionId?: string;
    message: string;
    history?: ConversationTurn[];
    context?: ConversationContext;
  }): Promise<{ sessionId: string; reply: string; shouldBeSilent: boolean }> {
    this.logger.log(
      `Generating conversational assistant response userId=${input.userId ?? 'GUEST'} userName=${input.userName ?? 'unknown'} sessionId=${input.sessionId ?? 'new'} historyCount=${input.history?.length ?? 0} workspaceState=${input.context?.workspaceState ?? 'unknown'} message=${input.message}`,
    );

    let sessionId = input.sessionId;
    
    // If no sessionId is provided, try to resume the most recent active conversation
    if (!sessionId && input.userId) {
      const lastConversation = await prisma.aIConversation.findFirst({
        where: { userId: input.userId, status: 'active' },
        orderBy: { updatedAt: 'desc' },
        select: { id: true }
      });
      sessionId = lastConversation?.id;
    }

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      this.logger.log(`No sessionId provided, generated new sessionId=${sessionId}`);
    }
    
    // Memory Retrieval: Load long-term summaries for this user (if authenticated)
    const summaries = input.userId ? await this.getLongTermSummaries(input.userId) : [];
    
    // Load persistent history from DB (if authenticated)
    const dbHistory = input.userId ? await this.getPersistentHistory(input.userId, sessionId) : [];
    
    // Merge provided history with DB history
    const history = this.mergeConversationHistory(
      dbHistory,
      input.history ?? [],
    );

    this.logger.log(
      `Conversation state prepared sessionId=${sessionId} mergedHistoryCount=${history.length} dbHistoryCount=${dbHistory.length} summaryCount=${summaries.length}`,
    );
    const messages = this.buildConversationMessages({
      ...input,
      history,
      summaries,
    });

    const request: AiRequest = {
      messages,
      temperature: 0.6,
      maxTokens: 500,
    };

    // Deep Trace: Log the exact messages being sent to the AI
    this.logger.debug(`[DEEP TRACE] Final messages sent to provider: ${JSON.stringify(messages, null, 2)}`);

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    const reply = response.content.trim();
    this.logger.log(`RAW Provider reply: "${response.content}"`);
    this.logger.log(`Provider reply sessionId=${sessionId} reply=${reply.slice(0, 300)}`);
    
    // Check if the AI is indicating it should be silent (empty reply or specific indicator)
    const shouldBeSilent = reply === "" || reply.toLowerCase().includes("[silence]");
    const cleanedReply = shouldBeSilent ? "" : reply.replace(/\[silence\]/gi, "").trim();

    // Persist to DB asynchronously (only if authenticated)
    if (input.userId) {
      this.persistConversation(input.userId, sessionId, input.message, cleanedReply).then(() => {
        // Trigger background auto-summarization if the history is getting long
        if (history.length >= 10 && history.length % 5 === 0) {
          this.summarizeConversation(input.userId!, sessionId).catch(err => {
            this.logger.error(`Auto-summarization failed for sessionId=${sessionId}`, err);
          });
        }
      }).catch(err => {
        this.logger.error(`Failed to persist conversation sessionId=${sessionId}`, err);
      });
    }
    
    return { sessionId, reply: cleanedReply, shouldBeSilent };
  }

  private async getLongTermSummaries(userId: string): Promise<string[]> {
    try {
      const summaries = await prisma.aIContextSummary.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      return summaries.map(s => `[${s.summaryType.toUpperCase()}]: ${s.content}`);
    } catch (error) {
      this.logger.warn(`Failed to fetch long-term summaries for userId=${userId}`, error);
      return [];
    }
  }

  private async summarizeConversation(userId: string, sessionId: string) {
    this.logger.log(`Starting auto-summarization for sessionId=${sessionId}`);
    
    const messages = await prisma.aIConversationMessage.findMany({
      where: { conversationId: sessionId },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length < 4) return;

    const transcript = messages.map(m => `${m.messageType.toUpperCase()}: ${m.content}`).join('\n');
    
    const summaryPrompt = `
Analyze the following conversation transcript and extract high-density "Memory Flashcards" for long-term storage.
Focus on:
1. User Preferences (style, tone, specific requirements)
2. Opportunity Insights (key details about companies or prospects discussed)
3. Strategic Decisions (what was agreed upon or drafted)

Transcript:
${transcript}

Rules:
- be extremely concise
- separate key points with bullet points
- only include information that will be useful for future sessions
- respond with the summary only, no preamble
    `.trim();

    const result = await this.aiProviderFactory.getProvider().generateText({
      prompt: summaryPrompt,
      temperature: 0.3,
    });

    const content = result.content.trim();
    if (!content) return;

    // Upsert a "Conversation Highlights" summary for this specific session
    await prisma.aIContextSummary.upsert({
      where: { 
        id: sessionId // Using sessionId as a stable ID for this session's highlight
      },
      create: {
        id: sessionId,
        userId,
        aiConversationId: sessionId,
        title: `Summary of session ${sessionId.slice(0, 8)}`,
        summaryType: AIContextSummaryType.conversation_highlights,
        content,
        sourceType: AIContextSummarySourceType.ai_conversation,
        sourceId: sessionId,
      },
      update: {
        content,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Persistent summary updated for sessionId=${sessionId}`);
  }

  private async getPersistentHistory(userId: string, sessionId: string): Promise<ConversationTurn[]> {
    try {
      const conversation = await prisma.aIConversation.findFirst({
        where: { id: sessionId, userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: -20, // Last 20 messages
          },
        },
      });

      if (!conversation) return [];

      return conversation.messages.map(m => ({
        role: this.mapDbRoleToConversationRole(m.messageType),
        text: m.content,
      }));
    } catch (error) {
      this.logger.warn(`Failed to fetch persistent history for sessionId=${sessionId}`, error);
      return [];
    }
  }

  private async persistConversation(
    userId: string,
    sessionId: string,
    userMessage: string,
    assistantReply: string,
  ) {
    // Ensure conversation exists
    await prisma.aIConversation.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userId,
        title: userMessage.slice(0, 50),
        purpose: AIConversationPurpose.general,
        status: AIConversationStatus.active,
      },
      update: {
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Save the new exchange
    await prisma.aIConversationMessage.createMany({
      data: [
        {
          conversationId: sessionId,
          messageType: AIConversationMessageType.user,
          content: userMessage,
        },
        {
          conversationId: sessionId,
          messageType: AIConversationMessageType.assistant,
          content: assistantReply,
        },
      ],
    });
  }

  private mapDbRoleToConversationRole(dbRole: string): ConversationRole {
    switch (dbRole) {
      case 'user': return 'user';
      case 'assistant': return 'assistant';
      case 'system': return 'system';
      default: return 'user';
    }
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

  private buildConversationMessages(input: {
    userName?: string;
    message: string;
    history?: ConversationTurn[];
    context?: ConversationContext;
    summaries?: string[];
  }): AiMessage[] {
    const systemPrompt = `
You are Opportunity OS, a friendly and proactive voice-first assistant.
You are talking to ${input.userName ?? 'the user'}.

Your Core Mission:
- Acknowledge every user message warmly and concisely.
- Speak naturally, like a human assistant on a phone call.
- Help the user turn high-level goals into tactical business outreach.

Response Rules:
- Keep responses short (1-2 sentences) so they are easy to listen to.
- DO NOT be silent. Even for "testing" or short phrases like "hello," respond with a friendly greeting or an offer to help.
- Use plain language. Avoid markdown, bullets, or complex technical terms.
- If the user asks "what next," check the context below and recommend the next logical step.

Current Context:
${[
  input.context?.workspaceState ? `- We are in the ${input.context.workspaceState} phase.` : null,
  input.context?.nextAction?.title ? `- Recommended next move: ${input.context.nextAction.title}` : null,
  input.context?.opportunity?.companyName ? `- Active company: ${input.context.opportunity.companyName}` : null,
].filter(Boolean).join('\n') || '- No specific business context yet. Let\'s get started!'}

IMPORTANT: Always respond with actual spoken words. Do not return empty strings or technical indicators.
`.trim();

    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent history (up to last 8 turns), filtering out placeholders and empty messages
    const history = (input.history ?? [])
      .filter(turn => turn.text && turn.text.trim() !== '' && turn.text !== '...')
      .slice(-8);
      
    for (const turn of history) {
      messages.push({
        role: turn.role === 'assistant' ? 'assistant' : 'user',
        content: turn.text
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: input.message
    });

    return messages;
  }

  private mergeConversationHistory(
    sessionHistory: ConversationTurn[],
    requestHistory: ConversationTurn[],
  ): ConversationTurn[] {
    const combined = [...sessionHistory];

    for (const turn of requestHistory) {
      const isDuplicate =
        combined.length > 0 &&
        combined.some(c => c.role === turn.role && c.text === turn.text);

      if (!isDuplicate) {
        combined.push(turn);
      }
    }

    return combined.slice(-12);
  }
}
