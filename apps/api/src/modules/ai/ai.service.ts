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
import { SearchService } from './search.service';
import { AiProviderFactory } from './ai-provider.factory';
import { AiRequest, AiMessage } from './interfaces/ai-provider.interface';
import { CapabilityIntegrationService } from './capability-integration.service';

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


  constructor(
    private aiProviderFactory: AiProviderFactory,
    private searchService: SearchService,
    private capabilityIntegrationService: CapabilityIntegrationService,
  ) {}

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

  async generateDiscoveryQuery(context: {
    offering?: any;
    campaign?: any;
    goal?: any;
    targetSegment?: string;
  }): Promise<string> {
    this.logger.log('Generating high-signal discovery query with AI');
    
    const prompt = `
You are an expert sales prospector. Your task is to transform a broad target segment into a precise, high-signal search query that can be used to find specific individuals or companies.

CONTEXT:
Offering: ${context.offering?.title || 'N/A'} - ${context.offering?.description || ''}
Campaign: ${context.campaign?.title || 'N/A'} - ${context.campaign?.strategicAngle || ''}
Goal: ${context.goal?.title || 'N/A'}
Target Segment: ${context.targetSegment || 'N/A'}

INSTRUCTIONS:
1. Generate a single search query that is optimized for finding relevant LinkedIn profiles or company websites.
2. Focus on specific job titles, industries, and technologies mentioned in the context.
3. If the context is about "University Professors", include keywords like "Faculty", "Professor", or "Researcher" along with the specific domain.
4. Output ONLY the query string. No explanations or quotes.

QUERY:`;

    const request: AiRequest = {
      prompt,
      temperature: 0.4,
      maxTokens: 100,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    return response.content.replace(/^["']|["']$/g, '').trim();
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

  async interpretDiscoveryRelevance(content: string, context: { goalTitle: string; campaignTitle?: string; targetSegment?: string }): Promise<string> {
    this.logger.log(`Interpreting discovery relevance for goal: ${context.goalTitle}`);
    
    const prompt = `
You are a High-Signal Strategic Commander. Analyze the following intellectual property (IP) and extract its core tactical value.

Content to analyze:
"${content}"

User's Active Goal: "${context.goalTitle}"
${context.campaignTitle ? `Current Campaign: "${context.campaignTitle}"` : ''}
${context.targetSegment ? `Target Segment: "${context.targetSegment}"` : ''}

Your Task:
You must respond with ONLY a valid JSON object with the following structure:
{
  "summary": "A punchy, one-sentence summary of the core thesis.",
  "interpretation": "A comprehensive 2-3 paragraph overview of the asset. What is the fundamental logic? What unique perspective or high-signal insight can be used to grab a prospect's attention? How does this IP create leverage for the user's active goal?",
  "frameworks": ["Framework Name 1", "Framework Name 2", "Framework Name 3"]
}

Rules:
- Be punchy and professional.
- Focus on "Weaponizable" insights—things that can be used in a real conversation.
- Extract exactly 3-5 frameworks from the text.
`.trim();

    const request: AiRequest = {
      prompt,
      temperature: 0.4,
      maxTokens: 800,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    return response.content.trim();
  }

  async interpretKnowledgeAsset(content: string, previousContext?: any[]): Promise<string> {
    this.logger.log(`Interpreting knowledge asset with ${previousContext ? previousContext.length : 0} previous assets in context.`);
    
    let contextBlock = '';
    if (previousContext && previousContext.length > 0) {
      contextBlock = `\n\nPrevious Knowledge Context (Already Extracted):\n`;
      previousContext.forEach((asset, idx) => {
        contextBlock += `Asset ${idx + 1}: ${asset.title}\n`;
        contextBlock += `Interpretation: ${asset.interpretation}\n`;
        contextBlock += `Frameworks: ${asset.frameworks.join(', ')}\n\n`;
      });
      contextBlock += `Consider how the newly uploaded document below interacts with, validates, or expands upon the Previous Knowledge Context.`;
    }

    const prompt = `
You are a High-Signal Strategic Commander. Analyze the following intellectual property (IP) and extract its core tactical value.

NEW Content to analyze:
"${content}"${contextBlock}

Your Task:
You must respond with ONLY a valid JSON object with the following structure:
{
  "summary": "A punchy, one-sentence summary of the core thesis of the NEW document.",
  "interpretation": "A 2-3 paragraph overview of the NEW document. What is the fundamental logic? What unique perspective or high-signal insight can be used to grab a prospect's attention?",
  "frameworks": ["Framework Name 1", "Framework Name 2", "Framework Name 3"],
  "comprehensiveSynthesis": "A 2-3 paragraph synthesis that weaves together the NEW document with ALL the Previous Knowledge Context. How do these assets multiply each other? (e.g. 'Your book preaches X, and your resume proves you executed it at Company Y'). If there is no previous context, just summarize the overall leverage of this single asset."
}

Rules:
- Be punchy and professional.
- Focus on "Weaponizable" insights—things that can be used in a real conversation.
- Extract exactly 3-5 frameworks from the NEW text.
- Ensure the output is strictly valid JSON.
`.trim();

    const request: AiRequest = {
      prompt,
      temperature: 0.4,
      maxTokens: 1200,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    return response.content.trim();
  }

  async proposeRevenueLanes(context: { networkCount: number; networkPosture: string; frameworks: string[]; interpretation: string }): Promise<any[]> {
    this.logger.log(`Proposing revenue lanes based on ${context.networkCount} connections and ${context.frameworks.length} frameworks`);
    
    const prompt = `
You are a Chief Strategy Officer. Analyze the following network topography and intellectual property (IP) to propose 3 to 5 distinct "Revenue Lanes" (strategic service or product offerings).

NETWORK TOPOGRAPHY:
Connections: ${context.networkCount}
Posture/Analysis: ${context.networkPosture}

INTELLECTUAL PROPERTY:
Frameworks: ${context.frameworks.join(', ')}
Interpretation: ${context.interpretation}

Your Task:
Respond with ONLY a valid JSON array of objects. Each object must represent a proposed Revenue Lane with the following structure:
{
  "id": "unique-slug-id",
  "title": "Name of the Revenue Lane (e.g., AI-Native SDLC Consulting)",
  "description": "A punchy, one-sentence description of the offering.",
  "evidence": "A brief explanation of WHY this lane is viable based specifically on the user's network density and extracted IP.",
  "targetAudience": "Who exactly is the buyer for this lane?"
}
`.trim();

    const request: AiRequest = {
      prompt,
      temperature: 0.5,
      maxTokens: 1500,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    try {
      const parsed = JSON.parse(response.content.replace(/```json/gi, '').replace(/```/g, '').trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this.logger.error('Failed to parse proposeRevenueLanes JSON', e);
      return [];
    }
  }

  async refineRevenueLanes(currentLanes: any[], feedback: string, context: { networkCount: number; networkPosture: string; frameworks: string[]; interpretation: string }): Promise<any[]> {
    this.logger.log(`Refining revenue lanes based on user feedback`);
    
    const prompt = `
You are a Chief Strategy Officer. You previously proposed these Revenue Lanes:
${JSON.stringify(currentLanes, null, 2)}

The user provided the following directional feedback:
"${feedback}"

Based on their feedback, and their underlying data (Network of ${context.networkCount} connections, IP: ${context.frameworks.join(', ')}), regenerate the Revenue Lanes.
You can modify existing lanes, drop irrelevant ones, or create entirely new ones to align with their feedback.

Your Task:
Respond with ONLY a valid JSON array of objects using the exact same structure as before (id, title, description, evidence, targetAudience).
`.trim();

    const request: AiRequest = {
      prompt,
      temperature: 0.5,
      maxTokens: 1500,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    try {
      const parsed = JSON.parse(response.content.replace(/```json/gi, '').replace(/```/g, '').trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this.logger.error('Failed to parse refineRevenueLanes JSON', e);
      return currentLanes; // Fallback to current if parse fails
    }
  }

  async proposeCampaigns(context: { 
    selectedLanes: any[]; 
    networkCount: number; 
    frameworks: string[]; 
    interpretation: string 
  }): Promise<any[]> {
    this.logger.log(`Proposing campaigns for ${context.selectedLanes.length} revenue lanes`);
    
    const prompt = `
You are a Chief Revenue Officer and Campaign Strategist. The user has confirmed their Revenue Lanes (strategic offerings). Now you must design one initial campaign for each lane.

CONFIRMED REVENUE LANES:
${JSON.stringify(context.selectedLanes, null, 2)}

USER CONTEXT:
- Professional network: ${context.networkCount} connections
- IP Frameworks: ${context.frameworks.join(', ')}
- Strategic Interpretation: ${context.interpretation}

Your Task:
Design one campaign per Revenue Lane. Each campaign should be a focused, time-bound go-to-market push.

Respond with ONLY a valid JSON array of objects. Each object must have:
{
  "id": "unique-slug-id",
  "laneId": "the id of the Revenue Lane this campaign serves",
  "laneTitle": "the title of the Revenue Lane",
  "title": "Campaign name (e.g., 'SDLC Velocity Outreach')",
  "description": "A punchy 1-2 sentence description of the campaign strategy.",
  "duration": "90 days",
  "targetSegment": "Exactly who this campaign targets (title, company stage, industry)",
  "channel": "Primary outreach channel(s) (e.g., LinkedIn DM, Email, Warm Intro)",
  "messagingHook": "The specific IP framework or angle used as the conversation opener",
  "goalMetric": "A measurable success metric (e.g., '15 qualified conversations')"
}

Rules:
- Create exactly ONE campaign per Revenue Lane.
- Default duration to 90 days unless the lane clearly calls for a shorter sprint.
- Be specific about the target segment — not "executives" but "VP/Dir Engineering at Series B+ SaaS companies".
- The messagingHook must reference the user's actual IP frameworks.
- Ensure the output is strictly valid JSON.
`.trim();

    const request: AiRequest = {
      prompt,
      temperature: 0.5,
      maxTokens: 2000,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    try {
      const parsed = JSON.parse(response.content.replace(/```json/gi, '').replace(/```/g, '').trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this.logger.error('Failed to parse proposeCampaigns JSON', e);
      return [];
    }
  }

  async refineCampaigns(currentCampaigns: any[], feedback: string, context: {
    selectedLanes: any[];
    networkCount: number;
    frameworks: string[];
    interpretation: string;
  }): Promise<any[]> {
    this.logger.log(`Refining campaigns based on user feedback`);

    const prompt = `
You are a Chief Revenue Officer and Campaign Strategist. You previously proposed these campaigns:
${JSON.stringify(currentCampaigns, null, 2)}

The user's confirmed Revenue Lanes are:
${JSON.stringify(context.selectedLanes, null, 2)}

The user provided the following directional feedback:
"${feedback}"

Based on their feedback and context (Network of ${context.networkCount} connections, IP: ${context.frameworks.join(', ')}), regenerate or modify the campaigns.

IMPORTANT RULES:
- You may add NEW campaigns if the user requests them.
- You may modify existing campaigns based on feedback.
- You may remove campaigns if explicitly asked.
- Keep the same JSON schema as before.
- Each campaign must reference a valid Revenue Lane from the confirmed list.
- Respond with ONLY a valid JSON array.
`.trim();

    const request: AiRequest = {
      prompt,
      temperature: 0.5,
      maxTokens: 2000,
    };

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    try {
      const parsed = JSON.parse(response.content.replace(/```json/gi, '').replace(/```/g, '').trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this.logger.error('Failed to parse refineCampaigns JSON', e);
      return currentCampaigns;
    }
  }

  async proposeActionLanes(campaigns: any[], comprehensiveSynthesis: string): Promise<any[]> {
    const prompt = `
    Based on the following confirmed Campaigns and User Strategic Synthesis, propose a set of 3-4 "Action Lanes" (Tactical Channels).
    
    User Synthesis: ${comprehensiveSynthesis}
    
    Confirmed Campaigns:
    ${JSON.stringify(campaigns, null, 2)}
    
    An Action Lane is a specific channel and method used to execute a campaign. 
    Common types: 
    - "Direct Executive Outreach" (Email/Outlook focus)
    - "Warm Introduction Engine" (LinkedIn network focus)
    - "Content Leverage Lane" (Social posting focus)
    - "Event & Webinar Lane" (Targeted gathering focus)
    
    Return a JSON array of objects:
    {
      "id": "unique-id",
      "type": "the tactical type",
      "title": "Clear, evocative title (e.g., 'Direct CEO Pipeline')",
      "description": "Short description of the tactical approach",
      "tactics": ["Bullet point 1", "Bullet point 2"],
      "requiredConnectors": ["outlook", "linkedin", etc],
      "campaignIds": ["id1", "id2"] // Which confirmed campaigns this lane supports
    }
    `;

    try {
      const response = await this.generateText(prompt, { temperature: 0.3 });
      const parsed = JSON.parse(response.replace(/```json/gi, '').replace(/```/g, '').trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this.logger.error('Failed to parse proposeActionLanes JSON', e);
      return [];
    }
  }

  async refineActionLanes(currentLanes: any[], feedback: string, campaigns: any[], comprehensiveSynthesis: string): Promise<any[]> {
    const prompt = `
    The user wants to refine their Action Lanes (Tactical Channels).
    
    Current Lanes: ${JSON.stringify(currentLanes)}
    Feedback: ${feedback}
    Context:
    - Campaigns: ${JSON.stringify(campaigns)}
    - Synthesis: ${comprehensiveSynthesis}
    
    Return the updated list of 3-4 Action Lanes as a JSON array. 
    Respect the user's feedback. If they want to remove or change a lane, do so.
    Return only JSON.
    `;

    try {
      const response = await this.generateText(prompt, { temperature: 0.4 });
      const parsed = JSON.parse(response.replace(/```json/gi, '').replace(/```/g, '').trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this.logger.error('Failed to parse refineActionLanes JSON', e);
      return currentLanes;
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
    guestSessionId?: string;
    message: string;
    history?: ConversationTurn[];
    context?: ConversationContext;
    strategicContext?: { phase: string; mission: string };
  }): Promise<{ sessionId: string; reply: string; shouldBeSilent: boolean; suggestedAction?: string; onboardingPlan?: StrategicResult | null }> {
    this.logger.log(
      `Generating conversational assistant response userId=${input.userId ?? 'GUEST'} guestSessionId=${input.guestSessionId ?? 'none'} userName=${input.userName ?? 'unknown'} sessionId=${input.sessionId ?? 'new'} historyCount=${input.history?.length ?? 0} workspaceState=${input.context?.workspaceState ?? 'unknown'} message=${input.message}`,
    );

    let sessionId = input.sessionId;

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      this.logger.log(`No sessionId provided, generated new sessionId=${sessionId}`);
    }
    
    // Memory Retrieval: Load long-term summaries for this user (if authenticated)
    const summaries = input.userId ? await this.getLongTermSummaries(input.userId) : [];
    
    // Load persistent history from DB (authenticated or guest with sessionId)
    const dbHistory = (input.userId || input.sessionId) 
      ? await this.getPersistentHistoryForSession(sessionId, input.userId, input.guestSessionId) 
      : [];
    
    // Merge provided history with DB history
    const history = this.mergeConversationHistory(
      dbHistory,
      input.history ?? [],
    );

    // Check if message contains capability-related requests
    const capabilityResponse = await this.handleCapabilityRequests(input.message, input.userId);
    if (capabilityResponse) {
      return {
        sessionId,
        reply: capabilityResponse.reply,
        shouldBeSilent: false,
        suggestedAction: capabilityResponse.suggestedAction
      };
    }

    this.logger.log(
      `Conversation state prepared sessionId=${sessionId} mergedHistoryCount=${history.length} dbHistoryCount=${dbHistory.length} summaryCount=${summaries.length}`,
    );

    const strategicContext = input.strategicContext ?? await this.determineStrategicContext(input.userId, input.guestSessionId);
    this.logger.log(`Determined strategic context: ${strategicContext.phase}`);

    let searchResults: string | undefined;
    if (this.detectSearchIntent(input.message)) {
      this.logger.log(`Search intent detected for message: "${input.message}"`);
      const results = await this.searchService.search(input.message);
      if (results.length > 0) {
        searchResults = results.map(r => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n---\n');
        this.logger.log(`Injected ${results.length} search results into context.`);
      }
    }

    const messages = this.buildConversationMessages({
      ...input,
      message: input.message.startsWith('[SYSTEM:') ? '' : input.message,
      systemOverride: input.message.startsWith('[SYSTEM:') ? input.message.replace('[SYSTEM:', '').replace(']', '') : undefined,
      history,
      summaries,
      strategicContext,
      searchResults,
    });

    const request: AiRequest = {
      messages,
      temperature: 0.6,
      maxTokens: 500,
      tools: [
        {
          type: 'function',
          function: {
            name: 'propose_goal',
            description: 'Call this tool IMMEDIATELY when the user explicitly affirms that they want to proceed with the goal you proposed. Do not call this if the user is still asking questions.'
          }
        },
        {
          type: 'function',
          function: {
            name: 'propose_campaign',
            description: 'Call this tool when proposing a tactical outreach campaign or strategy after a goal is confirmed.'
          }
        }
      ]
    };

    this.logger.debug(`[DEEP TRACE] Final messages sent to provider: ${JSON.stringify(messages, null, 2)}`);

    const response = await this.aiProviderFactory.getProvider().generateText(request);
    let reply = response.content.trim();
    const toolAction = this.actionFromToolCalls(response.tool_calls);
    const { action, plan } = await this.detectStrategicIntent(sessionId, input.message, reply, history, toolAction);
    const suggestedAction = action;
    const onboardingPlan = plan;

    if (suggestedAction && (!reply || reply.length < 2)) {
      if (suggestedAction === 'PROPOSE_GOAL') {
        reply = "Great! I'm pulling up the details for that goal now.";
      } else if (suggestedAction === 'PROPOSE_CAMPAIGN') {
        reply = "Excellent. I've drafted the tactical campaign parameters for you to review.";
      } else {
        reply = "Processing that for you now.";
      }
      this.logger.log(`[FALLBACK] Injected spoken reply for ${suggestedAction}`);
    }

    const lowerReply = reply.toLowerCase();
    const isSilenceRequested = lowerReply.includes('[silence]');
    const shouldBeSilent = (reply === '' || isSilenceRequested) && !suggestedAction;
    const cleanedReply = shouldBeSilent ? '' : reply.replace(/\[silence\]/gi, '').trim();

    if (input.userId || input.guestSessionId) {
      try {
        await this.persistConversation(input.userId, input.guestSessionId, sessionId, input.message, cleanedReply);
      } catch (err) {
        this.logger.error(`Failed to persist conversation sessionId=${sessionId}`, err);
      }
    }

    const finalResponse = {
      sessionId,
      reply: cleanedReply,
      shouldBeSilent,
      suggestedAction,
      onboardingPlan,
    };

    this.logger.debug(`[FINAL RESPONSE] suggestedAction=${finalResponse.suggestedAction}, hasPlan=${!!finalResponse.onboardingPlan}`);
    return finalResponse;
  }

  private async handleCapabilityRequests(message: string, userId?: string): Promise<{ reply: string; suggestedAction?: string } | null> {
    const normalizedMessage = message.trim();
    const lowerMessage = normalizedMessage.toLowerCase();

    const emailMatch = normalizedMessage.match(/^(?:please\s+)?(?:send|deliver)\s+(?:an?\s+)?email\s+to\s+(.+?)(?:\s+(?:about|with subject|subject)\s+(.+))?$/i);
    if (emailMatch && userId) {
        try {
          // Get user's default email connector
          const connector = await this.capabilityIntegrationService.getUserConnector(userId, 'email');
          if (!connector) {
            return {
              reply: 'No email connector configured. Please set up your email provider first.',
              suggestedAction: 'setup_email_connector'
            };
          }

          // Use user's default provider, but allow override if explicitly mentioned
          let providerName = connector.capabilityProvider?.providerName;
          if (message.toLowerCase().includes('gmail') || message.toLowerCase().includes('google')) {
            providerName = 'gmail';
          } else if (message.toLowerCase().includes('outlook') || message.toLowerCase().includes('hotmail') || message.toLowerCase().includes('microsoft')) {
            providerName = 'outlook';
          }

          await this.capabilityIntegrationService.sendEmail(userId, {
            to: [emailMatch[1]],
            subject: emailMatch[2] || 'No subject',
            body: emailMatch[3] || '',
            opportunityId: this.extractOpportunityId(message),
            provider: providerName // Only override if explicitly mentioned
          });
          
          const providerDisplayName = providerName === 'gmail' ? 'Gmail' : 'Outlook';
          return {
            reply: `Email sent successfully via ${providerDisplayName}`,
            suggestedAction: 'check_sent_folder'
          };
        } catch (error) {
          return {
            reply: `Failed to send email: ${this.errorMessage(error)}`,
            suggestedAction: 'check_email_connector'
          };
        }
      }

    
    const calendarMatch = normalizedMessage.match(/^(?:please\s+)?(?:schedule|create|set up|book)\s+(?:a\s+)?(?:calendar\s+)?(?:meeting|event|call)\b(?:\s+(.+))?$/i);
    if (calendarMatch && userId) {
        try {
          const eventDetails = {
            title: calendarMatch[1] || 'New Event',
            start: new Date(),
            description: calendarMatch[2] || ''
          };
          
          await this.capabilityIntegrationService.createCalendarEvent(userId, eventDetails);
          
          return {
            reply: 'Calendar event created successfully',
            suggestedAction: 'check_calendar'
          };
        } catch (error) {
          return {
            reply: `Failed to create calendar event: ${this.errorMessage(error)}`,
            suggestedAction: 'check_calendar_connector'
          };
        }
      }

    const messageMatch = normalizedMessage.match(/^(?:please\s+)?(?:(?:send\s+(?:a\s+)?)?(?:text|sms|message)\s+to|send\s+message\s+to)\s+(.+?)(?:\s*:\s*|\s+saying\s+|\s+that\s+)(.+)$/i);
    if (messageMatch && userId) {
        try {
          await this.capabilityIntegrationService.sendMessage(userId, {
            message: messageMatch[2] || '',
            opportunityId: this.extractOpportunityId(message)
          });
          
          return {
            reply: 'Message sent successfully',
            suggestedAction: 'check_messaging_connector'
          };
        } catch (error) {
          return {
            reply: `Failed to send message: ${this.errorMessage(error)}`,
            suggestedAction: 'check_messaging_connector'
          };
        }
      }

    const discoveryMatch = normalizedMessage.match(/^(?:please\s+)?(?:discover|research|find|look up)\s+(?:this\s+)?(?:url|page|site|company|person|profile|lead|prospect)s?\s*[:\-]?\s+(.+)$/i);
    const discoveryTarget = discoveryMatch?.[1]?.trim();
    const hasExplicitDiscoveryTarget = Boolean(
      discoveryTarget &&
        (discoveryTarget.startsWith('http://') ||
          discoveryTarget.startsWith('https://') ||
          lowerMessage.includes(' url ') ||
          lowerMessage.includes(' site ') ||
          lowerMessage.includes(' page ') ||
          lowerMessage.includes(' company ') ||
          lowerMessage.includes(' person ') ||
          lowerMessage.includes(' profile ') ||
          lowerMessage.includes(' lead ') ||
          lowerMessage.includes(' prospect ')),
    );

    if (discoveryMatch && hasExplicitDiscoveryTarget && userId) {
        try {
          await this.capabilityIntegrationService.discoverContent(userId, discoveryTarget!);
          
          return {
            reply: 'Content discovery started',
            suggestedAction: 'check_discovery_results'
          };
        } catch (error) {
          return {
            reply: `Failed to discover content: ${this.errorMessage(error)}`,
            suggestedAction: 'check_discovery_connector'
          };
        }
      }

    return null;
  }

  private extractOpportunityId(message: string): string | undefined {
    const match = message.match(/opportunity[-\s]?id[:\s]+([a-f0-9]{8}-[a-f0-9]{4})/i);
    return match ? match[1] : undefined;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  async startStreamConversation(input: {
    userId?: string;
    userName?: string;
    sessionId?: string;
    guestSessionId?: string;
    message: string;
    history?: ConversationTurn[];
    context?: ConversationContext;
  }): Promise<{ sessionId: string; stream: AsyncGenerator<string, void, unknown> }> {
    this.logger.log(`🌀 AI SERVICE: startStreamConversation for message="${input.message.substring(0, 50)}"`);
    this.logger.log(`🌀 SESSION: id=${input.sessionId}, guest=${input.guestSessionId}, user=${input.userId}`);
    
    let sessionId = input.sessionId;

    if (!sessionId) {
      sessionId = require('crypto').randomUUID();
    }
    
    const summaries = input.userId ? await this.getLongTermSummaries(input.userId) : [];
    
    const dbHistory = (input.userId || input.sessionId) 
      ? await this.getPersistentHistoryForSession(sessionId, input.userId, input.guestSessionId) 
      : [];
    
    const history = this.mergeConversationHistory(
      dbHistory,
      input.history ?? [],
    );

    const strategicContext = await this.determineStrategicContext(input.userId, input.guestSessionId);
    
    // Note: We skip search intent here for speed, or we could run it concurrently
    // For pure streaming speed, we skip the blocking search call
    const messages = this.buildConversationMessages({
      ...input,
      history,
      summaries,
      strategicContext,
    });

    const request: AiRequest = {
      messages,
      temperature: 0.6,
      maxTokens: 500,
      tools: [
        {
          type: 'function',
          function: {
            name: 'propose_goal',
            description: 'Call this tool IMMEDIATELY when the user explicitly affirms that they want to proceed with the goal you proposed. Do not call this if the user is still asking questions.'
          }
        },
        {
          type: 'function',
          function: {
            name: 'propose_campaign',
            description: 'Call this tool when proposing a tactical outreach campaign or strategy after a goal is confirmed.'
          }
        }
      ]
    };

    const provider = this.aiProviderFactory.getProvider();
    
    if (!provider.streamText) {
      throw new Error('Selected AI provider does not support streaming');
    }

    return {
      sessionId,
      stream: provider.streamText(request),
    };
  }

  async finalizeStreamConversation(
    userId: string | undefined,
    guestSessionId: string | undefined,
    sessionId: string,
    message: string,
    fullReply: string,
    history?: ConversationTurn[],
    overrideAction?: string
  ): Promise<{ suggestedAction?: string, strategicPlan?: any }> {
    this.logger.log(`🏁 AI SERVICE: finalizeStreamConversation session=${sessionId}`);
    const cleanedReply = fullReply.replace(/\[PROPOSE_GOAL\]/gi, '').replace(/\[PROPOSE_CAMPAIGN\]/gi, '').trim();
    
    if (userId || guestSessionId) {
      await this.persistConversation(userId, guestSessionId, sessionId, message, cleanedReply);
      
      if (userId) {
        const historyCount = await prisma.aIConversationMessage.count({ where: { conversationId: sessionId } });
        if (historyCount >= 10 && historyCount % 5 === 0) {
          this.summarizeConversation(userId, sessionId).catch(err => {
            this.logger.error(`Auto-summarization failed for sessionId=${sessionId}`, err);
          });
        }
      }
    }

    // Detect if this stream should have triggered an action
    const { action, plan } = await this.detectStrategicIntent(sessionId, message, fullReply, history, overrideAction);
    return { suggestedAction: action, strategicPlan: plan };
  }

  /**
   * Helper to detect strategic intent and extract plans from any reply (streamed or one-shot)
   */
  private async detectStrategicIntent(
    sessionId: string,
    message: string,
    reply: string,
    history?: ConversationTurn[],
    overrideAction?: string
  ): Promise<{ action?: string, plan?: any }> {
    const lowerReply = reply.toLowerCase();
    let suggestedAction: string | undefined;
    let strategicPlan: any = null;

    this.logger.debug(`[detectStrategicIntent] Starting detection for sessionId=${sessionId}`);
    this.logger.debug(`[detectStrategicIntent] User message: "${message?.substring(0, 100)}"`);
    this.logger.debug(`[detectStrategicIntent] AI reply: "${reply?.substring(0, 100)}"`);

    // 1. Heuristic Detection
    if (overrideAction) {
      suggestedAction = overrideAction;
      this.logger.debug(`[detectStrategicIntent] Using overrideAction: ${suggestedAction}`);
    } else {
      const hasGoalPhrase = lowerReply.includes('drafted that goal') || 
                           lowerReply.includes('summary on your screen') || 
                           lowerReply.includes('pulling up the details') ||
                           lowerReply.includes('proposing this goal') ||
                           lowerReply.includes('setting up your goal') ||
                           lowerReply.includes('established the goal') ||
                           lowerReply.includes('i\'ve set the goal') ||
                           lowerReply.includes('i have set the goal') ||
                           lowerReply.includes('start by identifying') ||
                           lowerReply.includes('thank you for confirming') ||
                           lowerReply.includes('goal confirmed') ||
                           lowerReply.includes('ready to start');
      
      const isDailyRitual = message.toLowerCase().includes('good morning') || 
                            message.toLowerCase().includes('start the day') ||
                            message.toLowerCase().includes('initialize today') ||
                            message.toLowerCase().includes('daily brief');
      
      this.logger.debug(`[detectStrategicIntent] Goal phrase check: ${hasGoalPhrase}, Daily ritual check: ${isDailyRitual}`);
      
      if (isDailyRitual) {
        suggestedAction = 'ORCHESTRATE_DAILY_HABIT';
        this.logger.debug(`[detectStrategicIntent] → Detected ORCHESTRATE_DAILY_HABIT from user ritual`);
      } else if (hasGoalPhrase) {
        suggestedAction = 'PROPOSE_GOAL';
        this.logger.debug(`[detectStrategicIntent] → Detected PROPOSE_GOAL from AI reply`);
      } else {
        // PROPOSE_CAMPAIGN requires BOTH the AI to reference the campaign AND the user to have affirmed
        const aiMentionsCampaign = lowerReply.includes('propose a campaign') || 
                                   lowerReply.includes('drafted a campaign') || 
                                   lowerReply.includes('proposing this strategy') ||
                                   lowerReply.includes('i\'ve created the campaign') ||
                                   lowerReply.includes('i have created the campaign') ||
                                   lowerReply.includes('established the campaign') ||
                                   lowerReply.includes('setting up the campaign') ||
                                   lowerReply.includes('locking in the campaign');
        
        const userAffirmed = message ? (
          /\b(yes|yep|yeah|sure|ok|okay|proceed|let's do it|sounds good|go ahead|perfect|great|do it|confirm|agreed|absolutely|let's go)\b/i.test(message)
        ) : false;

        this.logger.debug(`[detectStrategicIntent] Campaign detection: aiMentionsCampaign=${aiMentionsCampaign}, userAffirmed=${userAffirmed}`);

        if (aiMentionsCampaign && userAffirmed) {
          suggestedAction = 'PROPOSE_CAMPAIGN';
          this.logger.debug(`[detectStrategicIntent] → Detected PROPOSE_CAMPAIGN from both AI reply and user affirmation`);
        } else if (aiMentionsCampaign && !userAffirmed) {
          this.logger.debug(`[detectStrategicIntent] AI mentioned campaign but user did NOT affirm - waiting for confirmation`);
        } else {
          this.logger.debug(`[detectStrategicIntent] No campaign/goal trigger detected - continuing conversation`);
        }
      }
    }

    // 2. Plan Extraction if needed
    if (suggestedAction === 'PROPOSE_GOAL' || suggestedAction === 'PROPOSE_CAMPAIGN') {
      this.logger.debug(`[detectStrategicIntent] Extracting strategic plan for ${suggestedAction}...`);
      try {
        const combinedHistory = this.mergeConversationHistory(history ?? [], [
          { role: 'user', text: message },
          { role: 'assistant', text: reply }
        ]);
        const latestObjective = this.latestSubstantiveUserMessage(combinedHistory);

        if (suggestedAction === 'PROPOSE_GOAL' && this.isAffirmationMessage(message) && latestObjective) {
          strategicPlan = this.buildStrategicResultFromExtracted(this.buildHeuristicGoalExtraction(latestObjective));
          this.logger.debug(`[detectStrategicIntent] Used heuristic goal extraction from latest confirmed objective.`);
          return { action: suggestedAction, plan: strategicPlan };
        }

        const extracted = await this.extractGoalFromConversation(combinedHistory);
        strategicPlan = this.buildStrategicResultFromExtracted(extracted);
        this.logger.debug(`[detectStrategicIntent] Plan extraction successful: ${JSON.stringify(strategicPlan, null, 2).substring(0, 200)}`);
      } catch (err: any) {
        this.logger.error(`[detectStrategicIntent] Plan extraction failed for sessionId=${sessionId}: ${err.message}`);
      }
    }

    this.logger.debug(`[detectStrategicIntent] Returning: action=${suggestedAction || 'NONE'}, hasPlan=${strategicPlan ? 'YES' : 'NO'}`);
    return { action: suggestedAction, plan: strategicPlan };
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

  private async getPersistentHistoryForOnboarding(sessionId: string, guestSessionId?: string): Promise<ConversationTurn[]> {
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id: sessionId,
        OR: [
          { guestSessionId: guestSessionId || undefined },
          { userId: { not: null } } // Fallback to check if it's already linked
        ]
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return [];
    }

    return conversation.messages.map(m => ({
      role: this.mapDbRoleToConversationRole(m.messageType),
      text: m.content,
    }));
  }

  private async getPersistentHistoryForSession(
    sessionId: string,
    userId?: string,
    guestSessionId?: string,
  ): Promise<ConversationTurn[]> {
    try {
      const conversation = await prisma.aIConversation.findFirst({
        where: { 
          id: sessionId,
          OR: [
            ...(userId ? [{ userId }] : []),
            ...(guestSessionId ? [{ guestSessionId }] : []),
          ]
        },
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

  private async determineStrategicContext(userId?: string, guestSessionId?: string) {
    if (!userId && !guestSessionId) {
      return { phase: 'INITIAL_INTRO', mission: 'Welcome the user to Opportunity OS and help them identify their first business objective.' };
    }

    const where: any = userId ? { userId } : { guestSessionId };

    try {
      const goal = await prisma.goal.findFirst({
        where: { ...where },
        orderBy: { createdAt: 'desc' },
      });

      if (!goal) {
        return { 
          phase: 'DISCOVERY', 
          mission: 'Help the user identify a clear business objective. Focus on the target and move quickly to the "how".' 
        };
      }

      const campaign = await prisma.campaign.findFirst({
        where: { ...where, goalId: goal.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!campaign) {
        return { 
          phase: 'STRATEGY', 
          mission: `Goal established: "${goal.title}". Now, help the user define a tactical campaign—specifically who they want to target and what the hook is.` 
        };
      }

      return { 
        phase: 'OPERATIONS', 
        mission: `Goal and Campaign are active. Help the user with execution—identifying leads, drafting messages, and closing opportunities.` 
      };
    } catch (error) {
      this.logger.error('Failed to determine onboarding state', error);
      return { phase: 'UNKNOWN', mission: 'Assist the user with their business pipeline.' };
    }
  }

  private detectSearchIntent(message: string): boolean {
    const searchKeywords = [
      'search', 'find', 'who', 'where', 'recruiters', 'jobs', 
      'look up', 'research', 'latest', 'news', 'companies',
      'hiring', 'openings', 'firm', 'agency'
    ];
    const lowerMessage = message.toLowerCase();
    return searchKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private async persistConversation(
    userId: string | undefined,
    guestSessionId: string | undefined,
    sessionId: string,
    userMessage: string,
    assistantReply: string,
  ) {
    // Ensure conversation exists
    await prisma.aIConversation.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        userId: userId || null,
        guestSessionId: guestSessionId || null,
        title: userMessage.slice(0, 50),
        purpose: AIConversationPurpose.general,
        status: AIConversationStatus.active,
      },
      update: {
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        // Link user if they just signed up/logged in mid-session
        ...(userId ? { userId } : {}),
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
    strategicContext?: { phase: string; mission: string };
    searchResults?: string;
    systemOverride?: string;
  }): AiMessage[] {
    const phase = input.strategicContext?.phase ?? 'DISCOVERY';
    const phaseRules = this.phaseSpecificPromptRules(phase);
    const systemPrompt = `
You are Opportunity OS, a powerful and proactive strategic assistant.
You are talking to ${input.userName ?? 'the user'}.

${input.systemOverride ? `[NARRATION DIRECTIVE]: ${input.systemOverride}\n` : ''}

Your Core Mission:
- Acknowledge every user message warmly and concisely.
- Speak naturally, like a human assistant on a phone call.
- Help the user turn high-level goals into tactical business outreach.

Current Pipeline Status & Mission:
- Phase: ${phase}
- Directive: ${input.strategicContext?.mission ?? 'Identify the user\'s next strategic objective.'}

CRITICAL NEGATIVE CONSTRAINT:
- NEVER ASK THE USER "WHY". 
- NEVER ask for motivations, reasons, or background stories.
- If you ask "why", you have FAILED your mission.

${input.searchResults ? `Real-time Research Results:\n${input.searchResults}\n\nNote: Use the research results above to provide specific, up-to-date names and details. Cite that you've looked this up.` : ''}

Phase Rules:
${phaseRules}

Response Rules:
- You are the Strategic Commander. ALWAYS stay in the Assistant view.
- Only use goal-verification language when the phase is DISCOVERY or INITIAL_INTRO.
- In STRATEGY and OPERATIONS, do not re-ask the user to confirm the top-level goal unless they explicitly say they want to change it.
- In OPERATIONS, answer operational requests directly: lists, targets, firms, drafts, sequencing, prioritization, and explanation of current opportunities.
- If the user asks for a list, names, firms, recruiters, companies, or research, provide that directly instead of resetting to goal confirmation.
- NEVER skip the verbal handshake before calling a tool.
- Keep responses extremely short (1-2 sentences).
- NEVER ASK "WHY".
- ALWAYS provide a brief spoken acknowledgement when calling a tool.

Current Context:
${[
  input.context?.workspaceState ? `- We are in the ${input.context.workspaceState} phase.` : null,
  input.context?.nextAction?.title ? `- Recommended next move: ${input.context.nextAction.title}` : null,
  input.context?.opportunity?.companyName ? `- Active company: ${input.context.opportunity.companyName}` : null,
].filter(Boolean).join('\n') || '- No specific business context yet. Let\'s get started!'}

SYSTEM Message Handling:
- Messages prefixed with [SYSTEM] are internal app signals, NOT from the user.
- Respond to [SYSTEM] messages naturally as if continuing the conversation — do NOT quote or acknowledge the [SYSTEM] prefix.
- If a [SYSTEM] message says an email was sent, offer a follow-up reminder warmly and briefly (1 sentence).
- If the user agrees to a follow-up, say you've set it and end with "Who do you want to reach out to next?"

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

  private phaseSpecificPromptRules(phase: string): string {
    if (phase === 'INITIAL_INTRO' || phase === 'DISCOVERY') {
      return `
- STEP 1 (GOAL VERIFICATION): Repeat the goal and ask: "To confirm, is [GOAL] the objective we're setting today?".
- STEP 2 (GOAL PROPOSAL): Once the user affirms, you MUST IMMEDIATELY call \`propose_goal\`.
- STEP 3 (PHASE GATE): Do not discuss campaign tactics until the goal is confirmed via the modal.
      `.trim();
    }

    if (phase === 'STRATEGY') {
      return `
- The goal is already established.
- Help the user define the tactical campaign: target audience, hook, lane, and first motion.
- Give a short campaign pitch, then ask if they want to proceed.
- Only call \`propose_campaign\` after the user explicitly approves the proposed campaign.
      `.trim();
    }

    return `
- The goal and campaign already exist.
- Stay in execution mode unless the user explicitly asks to change the goal or replace the campaign.
- Handle operational requests directly: research target firms, identify people, draft outreach, explain opportunities, and recommend the next move.
- If the user asks for research or a list, answer with concrete operational help rather than restarting onboarding.
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
        combined.some(c => c.role === turn.role && c.text === turn.text);

      if (!isDuplicate) {
        combined.push(turn);
      }
    }

    return combined.slice(-12);
  }

  // ============================================================================
  // ONBOARDING GOAL EXTRACTION
  // ============================================================================

  /**
   * Finalizes onboarding by extracting goal from conversation and persisting to database.
   * Called when user completes the onboarding conversation.
   */
  async finalizeStrategicGoal(
    userId: string | undefined,
    sessionId: string,
    guestSessionId?: string,
  ): Promise<StrategicResult> {
    this.logger.log(`Finalizing strategic goal for userId=${userId ?? 'GUEST'}, sessionId=${sessionId}`);

    // 1. Check if already finalized to prevent duplicates
    const conversation = await prisma.aIConversation.findUnique({
      where: { id: sessionId },
      select: { status: true, offeringId: true }
    });

    if (conversation?.status === 'completed') {
      this.logger.warn(`Strategy already finalized for sessionId=${sessionId}. Skipping.`);
    }

    // 2. Get full conversation history
    const conversationHistory = await this.getPersistentHistoryForOnboarding(sessionId, guestSessionId);
    if (conversationHistory.length === 0) throw new Error('No history found');

    // 3. Extract goal using AI
    const extractedGoal = await this.extractGoalFromConversation(conversationHistory);
    const offeringId = await this.resolveOfferingIdForStrategy(userId, conversation?.offeringId);
    
    // 4. Create the Atomic Bundle (Goal + Campaign)
    const result = await prisma.$transaction(async (tx) => {
      const goal = await tx.goal.create({
        data: {
          userId: userId || null,
          guestSessionId: guestSessionId || null,
          offeringId,
          title: extractedGoal.title,
          description: extractedGoal.description,
          status: 'ACTIVE',
        },
      });

      const campaign = await tx.campaign.create({
        data: {
          userId: userId || null,
          guestSessionId: guestSessionId || null,
          goalId: goal.id,
          offeringId,
          title: `${extractedGoal.focusArea} Outreach`,
          objective: extractedGoal.description,
          strategicAngle: extractedGoal.suggestedApproach,
          targetSegment: extractedGoal.targetAudience,
          status: 'PLANNING',
        },
      });

      return { goal, campaign };
    });

    // 5. Generate Initial "Hottest Leads"
    await this.generateInitialOpportunities(userId || null, result.goal.id, result.campaign.id, offeringId, extractedGoal);

    // 6. Mark conversation
    await prisma.aIConversation.update({
      where: { id: sessionId },
      data: { purpose: 'onboarding', status: 'active', offeringId },
    });

    return {
      success: true,
      goal: { 
        id: result.goal.id, 
        title: result.goal.title, 
        description: result.goal.description, 
        status: result.goal.status,
        offeringId: result.goal.offeringId,
      },
      campaign: { 
        id: result.campaign.id, 
        title: result.campaign.title, 
        strategicAngle: result.campaign.strategicAngle, 
        targetSegment: result.campaign.targetSegment, 
        status: result.campaign.status,
        offeringId: result.campaign.offeringId,
      },
      extractedIntent: {
        focusArea: extractedGoal.focusArea,
        opportunityType: extractedGoal.opportunityType,
        targetAudience: extractedGoal.targetAudience,
        firstCycleTitle: extractedGoal.firstCycleTitle,
        firstCycleSteps: extractedGoal.firstCycleSteps,
        firstDraftPrompt: extractedGoal.firstDraftPrompt,
      },
    };
  }

  /**
   * Creates a strategic campaign for a specific goal.
   */
  async createCampaign(
    userId: string | undefined,
    goalId: string,
    payload: { title: string; strategicAngle: string; targetSegment: string }
  ): Promise<any> {
    const goal = await prisma.goal.findFirst({
      where: {
        id: goalId,
        ...(userId ? { userId } : {}),
      },
      select: { offeringId: true },
    });

    const campaign = await prisma.campaign.create({
      data: {
        userId: userId || null,
        goalId: goalId,
        offeringId: goal?.offeringId ?? null,
        title: payload.title,
        objective: payload.strategicAngle,
        strategicAngle: payload.strategicAngle,
        targetSegment: payload.targetSegment,
        status: 'PLANNING',
      },
    });

    return {
      success: true,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        offeringId: campaign.offeringId,
      }
    };
  }

  private async resolveOfferingIdForStrategy(userId: string | undefined, conversationOfferingId?: string | null) {
    if (conversationOfferingId) {
      return conversationOfferingId;
    }
    if (!userId) {
      return null;
    }

    const activeOffering = await prisma.offering.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    return activeOffering?.id ?? null;
  }

  /**
   * Extracts the onboarding plan without persisting to the database (Preview Mode).
   */
  async previewStrategicPlan(sessionId: string, guestSessionId?: string): Promise<StrategicResult> {
    const history = await this.getPersistentHistoryForOnboarding(sessionId, guestSessionId);
    if (history.length === 0) throw new Error('No history found');
    const extracted = await this.extractGoalFromConversation(history);

    return this.buildStrategicResultFromExtracted(extracted);
  }

  /**
   * Uses AI to extract structured goal information from conversation history.
   */
  private async extractGoalFromConversation(
    history: ConversationTurn[],
  ): Promise<ExtractedGoal> {
    const latestUserObjective = this.latestSubstantiveUserMessage(history);

    // Build the extraction prompt
    const prompt = this.buildGoalExtractionPrompt(history, latestUserObjective);

    // Call AI provider
    const response = await this.aiProviderFactory.getProvider().generateText({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Extract the goal from this conversation.' },
      ],
    });

    // Parse JSON response
    try {
      const extracted = JSON.parse(this.extractJsonPayload(response.content)) as ExtractedGoal;
      
      if (!extracted.assistantSummary || !extracted.opportunityType) {
        throw new Error('AI response missing required fields');
      }

      if (latestUserObjective && !this.extractionMatchesIntent(extracted, latestUserObjective)) {
        this.logger.warn(`AI goal extraction drifted from latest user objective. Falling back to heuristic extraction.`);
        return this.buildHeuristicGoalExtraction(latestUserObjective);
      }

      return extracted;
    } catch (error) {
      this.logger.error('Failed to parse AI goal extraction:', error);
      if (latestUserObjective) {
        return this.buildHeuristicGoalExtraction(latestUserObjective);
      }
      return this.defaultGoalExtraction();
    }
  }

  private actionFromToolCalls(toolCalls: any[] | undefined): string | undefined {
    if (!toolCalls?.length) return undefined;

    const toolNames = toolCalls
      .map((call) => call?.function?.name)
      .filter((name): name is string => typeof name === 'string');

    if (toolNames.includes('propose_goal')) return 'PROPOSE_GOAL';
    if (toolNames.includes('propose_campaign')) return 'PROPOSE_CAMPAIGN';
    return undefined;
  }

  private extractJsonPayload(content: string): string {
    const trimmed = content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    return trimmed;
  }

  private buildStrategicResultFromExtracted(
    extracted: ExtractedGoal,
    options?: {
      goalId?: string;
      goalStatus?: string;
      campaignId?: string;
      campaignStatus?: string;
      offeringId?: string | null;
    },
  ): StrategicResult {
    const goalId = options?.goalId ?? 'preview';
    const campaignId = options?.campaignId ?? 'preview';
    const goalStatus = options?.goalStatus ?? 'ACTIVE';
    const campaignStatus = options?.campaignStatus ?? 'PLANNING';
    const offeringId = options?.offeringId;

    return {
      success: true,
      goal: {
        id: goalId,
        title: extracted.title,
        description: extracted.description,
        status: goalStatus,
        ...(offeringId !== undefined ? { offeringId } : {}),
      },
      campaign: {
        id: campaignId,
        title: `${extracted.focusArea} Outreach`,
        strategicAngle: extracted.suggestedApproach,
        targetSegment: extracted.targetAudience,
        status: campaignStatus,
        ...(offeringId !== undefined ? { offeringId } : {}),
      },
      extractedIntent: {
        focusArea: extracted.focusArea,
        opportunityType: extracted.opportunityType,
        targetAudience: extracted.targetAudience,
        firstCycleTitle: extracted.firstCycleTitle,
        firstCycleSteps: extracted.firstCycleSteps,
        firstDraftPrompt: extracted.firstDraftPrompt,
      },
    };
  }

  private async generateInitialOpportunities(
    userId: string | null,
    _goalId: string,
    campaignId: string,
    offeringId: string | null,
    extracted: ExtractedGoal
  ) {
    if (!userId) {
      this.logger.warn(`Skipping initial lead generation for campaign=${campaignId} (no userId)`);
      return;
    }
    this.logger.log(`Generating offering-aware initial leads for campaign=${campaignId}`);

    const offering = offeringId
      ? await prisma.offering.findFirst({
          where: { id: offeringId, userId },
          select: { title: true, description: true, offeringType: true },
        })
      : null;

    const seedCompanies = this.buildInitialTargetCompanies(extracted, offering);

    for (const seed of seedCompanies) {
      await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            userId: userId as any,
            name: seed.name,
            domain: seed.domain,
            industry: seed.industry,
            companyType: seed.companyType,
            description: seed.description,
          }
        });

        await tx.opportunity.create({
          data: {
            userId: userId as any,
            companyId: company.id,
            campaignId: campaignId,
            title: `${seed.motionLabel}: ${seed.name}`,
            opportunityType: seed.opportunityType,
            stage: 'new',
            summary: seed.summary,
            nextAction: seed.nextAction,
            priority: 'high',
            fitScore: seed.fitScore,
          }
        });
      });
    }
  }

  private buildInitialTargetCompanies(
    extracted: ExtractedGoal,
    offering: { title: string; description: string | null; offeringType: string } | null,
  ) {
    const audience = extracted.targetAudience || 'relevant decision makers';
    const focusArea = extracted.focusArea || 'strategic outreach';
    const offeringTitle = offering?.title ?? focusArea;
    const description = `${offeringTitle} target account for ${audience}.`;
    const lowerText = `${audience} ${focusArea} ${offeringTitle} ${offering?.description ?? ''}`.toLowerCase();
    const isAcademicAudience =
      lowerText.includes('professor') ||
      lowerText.includes('faculty') ||
      lowerText.includes('university') ||
      lowerText.includes('department chair') ||
      lowerText.includes('course adoption') ||
      lowerText.includes('guest lecture') ||
      lowerText.includes('seminar');
    const isEngineeringLeadership =
      lowerText.includes('cto') ||
      lowerText.includes('engineering') ||
      lowerText.includes('sdlc') ||
      lowerText.includes('software delivery');
    const isConsulting = offering?.offeringType === 'consulting' || extracted.opportunityType === 'consulting';

    if (isAcademicAudience) {
      return [
        {
          name: 'Northeastern Software Engineering Faculty',
          domain: 'northeastern.example',
          industry: 'Higher Education',
          companyType: 'prospect' as const,
          motionLabel: 'University Faculty Book Outreach',
          opportunityType: 'networking' as const,
          description,
          summary: `Target software engineering faculty for a book-led conversation about course adoption, seminars, guest lectures, and AI-native software engineering curriculum updates.`,
          nextAction: `Draft a faculty outreach email introducing ${offeringTitle} and proposing a course adoption or seminar conversation.`,
          fitScore: 90,
        },
        {
          name: 'Carnegie Mellon Software Engineering Program',
          domain: 'cmu.example',
          industry: 'Higher Education',
          companyType: 'prospect' as const,
          motionLabel: 'University Faculty Book Outreach',
          opportunityType: 'networking' as const,
          description,
          summary: `Target program directors and faculty who teach software architecture, developer productivity, and AI for software engineering. Position ${offeringTitle} as a practical teaching and discussion asset.`,
          nextAction: 'Create a concise email for a software engineering program director.',
          fitScore: 88,
        },
        {
          name: 'University of Waterloo Software Engineering Department',
          domain: 'waterloo.example',
          industry: 'Higher Education',
          companyType: 'prospect' as const,
          motionLabel: 'University Faculty Book Outreach',
          opportunityType: 'networking' as const,
          description,
          summary: `Target faculty and department leadership for possible guest lecture, curriculum discussion, research collaboration, or platform pilot conversations around AI-native software engineering.`,
          nextAction: 'Draft a professor-facing invitation to review the book and discuss collaboration.',
          fitScore: 86,
        },
      ];
    }

    if (isEngineeringLeadership) {
      return [
        {
          name: 'Northstar Digital Platforms',
          domain: 'northstardigital.example',
          industry: 'B2B SaaS',
          companyType: 'consulting_target' as const,
          motionLabel: 'Engineering Leadership Advisory Outreach',
          opportunityType: isConsulting ? 'consulting' as const : 'networking' as const,
          description,
          summary: `Target CTO and engineering leadership team likely to care about AI-native SDLC redesign, delivery velocity, and operating-model change. Use ${offeringTitle} as the credibility anchor.`,
          nextAction: `Draft a concise advisory outreach message for the CTO referencing ${offeringTitle}.`,
          fitScore: 90,
        },
        {
          name: 'Meridian Software Group',
          domain: 'meridiansoftware.example',
          industry: 'Enterprise Software',
          companyType: 'consulting_target' as const,
          motionLabel: 'Engineering Leadership Advisory Outreach',
          opportunityType: isConsulting ? 'consulting' as const : 'networking' as const,
          description,
          summary: `Target engineering executives at a scaled software organization where AI adoption may be fragmented across teams. Position ${offeringTitle} around practical workflow redesign.`,
          nextAction: 'Create a discovery note and outreach draft for the Head of Engineering.',
          fitScore: 88,
        },
        {
          name: 'Pinnacle Engineering Systems',
          domain: 'pinnacleengineering.example',
          industry: 'Software Engineering Tools',
          companyType: 'consulting_target' as const,
          motionLabel: 'Engineering Leadership Advisory Outreach',
          opportunityType: isConsulting ? 'consulting' as const : 'networking' as const,
          description,
          summary: `Target technical product and engineering leaders with a book-led conversation about turning AI-native engineering from experiments into an operating system.`,
          nextAction: 'Draft a book-led invitation to a strategic advisory conversation.',
          fitScore: 86,
        },
      ];
    }

    return [
      {
        name: 'Keystone Growth Partners',
        domain: 'keystonegrowth.example',
        industry: 'Professional Services',
        companyType: 'prospect' as const,
        motionLabel: 'Strategic Outreach',
        opportunityType: isConsulting ? 'consulting' as const : 'networking' as const,
        description,
        summary: `Target account aligned with ${audience}. Lead with ${offeringTitle} and validate strategic fit through a short advisory conversation.`,
        nextAction: `Draft an outreach message tied to ${offeringTitle}.`,
        fitScore: 84,
      },
      {
        name: 'Summit Operating Group',
        domain: 'summitoperating.example',
        industry: 'Operating Company',
        companyType: 'prospect' as const,
        motionLabel: 'Strategic Outreach',
        opportunityType: isConsulting ? 'consulting' as const : 'networking' as const,
        description,
        summary: `Target account for the ${focusArea} campaign, selected because the audience and offering suggest an executive-level conversation.`,
        nextAction: 'Create a first-touch outreach draft.',
        fitScore: 82,
      },
      {
        name: 'Catalyst Market Systems',
        domain: 'catalystmarkets.example',
        industry: 'Technology',
        companyType: 'prospect' as const,
        motionLabel: 'Strategic Outreach',
        opportunityType: isConsulting ? 'consulting' as const : 'networking' as const,
        description,
        summary: `Target account that can be used to test messaging for ${offeringTitle} before broader campaign expansion.`,
        nextAction: 'Prepare a personalized outreach angle.',
        fitScore: 80,
      },
    ];
  }

  /**
   * Builds the prompt for goal extraction.
   */
  private buildGoalExtractionPrompt(history: ConversationTurn[], latestUserObjective?: string): string {
    const conversationText = history
      .map(turn => `${turn.role === 'assistant' ? 'Assistant' : 'User'}: ${turn.text}`)
      .join('\n\n');

    return `
You are an expert at understanding user intent from conversations. 
Analyze the following onboarding conversation and extract the user's professional goal.

Conversation:
${conversationText}

Latest explicit user objective:
${latestUserObjective ?? 'Not available'}

Based on this conversation, extract the following information as JSON:
{
  "title": "A clear, concise goal title (e.g., 'CTO Outreach for AI Consulting')",
  "description": "A one-sentence description of what the user wants to accomplish",
  "opportunityType": "The type of opportunity they're seeking: job, contract, consulting, partnership, or outreach",
  "focusArea": "The main focus area (e.g., 'AI-focused', 'leadership roles')",
  "targetAudience": "Who they want to reach. MUST be specific and include the core industry, service, and location mentioned (e.g., 'Video production companies in Toronto looking for contract editors' rather than 'potential clients')",
  "suggestedApproach": "A strategic angle or approach suggested by the conversation",
  "firstCycleTitle": "Title for the first outreach cycle (e.g., 'Initial CTO Outreach')",
  "assistantSummary": "A concise, high-impact summary of the goal for the UI modal",
  "confirmationMessage": "A professional, encouraging confirmation message for the UI modal",
  "firstCycleSteps": ["Array of 3-5 specific steps to get started"],
  "firstDraftPrompt": "A prompt that could be used to generate the first outreach message"
}

Important:
- The opportunityType must be exactly one of: job, contract, consulting, partnership, outreach
- Be specific and concrete based on what was discussed
- Use the latest explicit user objective as the authoritative signal when there is any ambiguity
- If the user mentions multiple things, pick the primary focus from the latest explicit objective
- Do not invent a different industry, product, audience, or business model than the one described by the user
- Reuse the user's actual domain nouns where possible (for example: recruiters, professors, book, trading systems, CTOs)
- The firstCycleSteps should be actionable and clear`.trim();
  }

  private latestSubstantiveUserMessage(history: ConversationTurn[]): string | null {
    const userTurns = [...history]
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.text.trim())
      .filter(Boolean);

    for (let index = userTurns.length - 1; index >= 0; index -= 1) {
      const candidate = userTurns[index];
      if (!this.isAffirmationMessage(candidate) && candidate.length > 8) {
        return candidate;
      }
    }

    return userTurns.at(-1) ?? null;
  }

  private isAffirmationMessage(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    return [
      'yes',
      'yep',
      'yeah',
      'correct',
      'that is correct',
      'that’s correct',
      'thats correct',
      'ok',
      'okay',
      'sure',
      'proceed',
      'sounds good',
      'go ahead',
    ].includes(normalized);
  }

  private extractionMatchesIntent(extracted: ExtractedGoal, latestObjective: string): boolean {
    const objectiveTokens = this.significantTokens(latestObjective);
    if (objectiveTokens.length === 0) {
      return true;
    }

    const extractedText = [
      extracted.title,
      extracted.description,
      extracted.focusArea,
      extracted.targetAudience,
      extracted.suggestedApproach,
      extracted.firstCycleTitle,
    ].join(' ');
    const extractedTokens = new Set(this.significantTokens(extractedText));
    const overlap = objectiveTokens.filter((token) => extractedTokens.has(token));

    return overlap.length >= Math.max(1, Math.ceil(objectiveTokens.length * 0.2));
  }

  private significantTokens(text: string): string[] {
    const stopWords = new Set([
      'that', 'this', 'with', 'from', 'into', 'your', 'their', 'would', 'like', 'about', 'today',
      'want', 'reach', 'out', 'need', 'help', 'goal', 'setting', 'create', 'build', 'move', 'next',
      'correct', 'yes', 'okay', 'sure', 'please', 'them', 'they', 'what', 'when', 'then',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !stopWords.has(token));
  }

  private buildHeuristicGoalExtraction(latestObjective: string): ExtractedGoal {
    const normalized = latestObjective.replace(/\s+/g, ' ').trim();
    const lower = normalized.toLowerCase();
    const targetAudience = this.extractTargetAudienceFromObjective(normalized);
    const opportunityType =
      lower.includes('recruiter') || lower.includes('job') || lower.includes('role')
        ? 'job'
        : lower.includes('contract') || lower.includes('freelance')
          ? 'contract'
          : lower.includes('consult')
            ? 'consulting'
            : lower.includes('partner')
              ? 'partnership'
              : 'outreach';
    const focusArea = this.toTitleCase(targetAudience);
    const title =
      opportunityType === 'job'
        ? `${this.toTitleCase(targetAudience)} Outreach`
        : `${this.toTitleCase(targetAudience)} Promotion`;
    const description = `The user wants to reach ${targetAudience}.`;

    return {
      title,
      description,
      opportunityType,
      focusArea,
      targetAudience,
      suggestedApproach: `Use direct, tailored outreach focused on ${targetAudience} with clear relevance and a specific next step.`,
      firstCycleTitle: `Initial ${this.toTitleCase(targetAudience)} Outreach`,
      assistantSummary: description,
      confirmationMessage: `Great. I captured the goal around ${targetAudience} and prepared the first campaign direction.`,
      firstCycleSteps: [
        `Build a focused target list for ${targetAudience}.`,
        'Define the message angle and proof points.',
        'Draft the first outreach message.',
        'Send the first wave and review responses.',
      ],
      firstDraftPrompt: `Draft a concise outreach message for ${targetAudience} based on this objective: ${normalized}`,
    };
  }

  private extractTargetAudienceFromObjective(objective: string): string {
    const lower = objective.toLowerCase();
    const reachOutMatch = objective.match(/reach out(?:\s+to)?\s+(.+)/i);
    if (reachOutMatch?.[1]) {
      return reachOutMatch[1]
        .trim()
        .replace(/^\bto\b\s+/i, '')
        .replace(/\.$/, '');
    }
    const promoteMatch = objective.match(/promot(?:e|ing).+?\s+to\s+(.+)/i);
    if (promoteMatch?.[1]) {
      return promoteMatch[1].trim().replace(/\.$/, '');
    }
    const contactMatch = objective.match(/(?:contact|target|message|email)\s+(.+)/i);
    if (contactMatch?.[1]) {
      return contactMatch[1].trim().replace(/\.$/, '');
    }
    if (lower.includes('recruiter')) {
      return objective.replace(/^.*?recruiters?/i, 'recruiters').trim().replace(/\.$/, '');
    }
    return 'relevant professionals';
  }

  private toTitleCase(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private defaultGoalExtraction(): ExtractedGoal {
    return {
      title: 'Professional Outreach Goal',
      description: 'Build meaningful professional connections and opportunities',
      opportunityType: 'outreach',
      focusArea: 'general',
      targetAudience: 'relevant professionals',
      suggestedApproach: 'Direct outreach with value-first messaging',
      firstCycleTitle: 'Initial Outreach',
      assistantSummary: 'Build meaningful professional connections and opportunities',
      confirmationMessage: 'Excellent. Your goal is set! Now, let\'s discuss the tactical campaign strategy to achieve it.',
      firstCycleSteps: ['Identify targets', 'Draft messages', 'Send outreach'],
      firstDraftPrompt: 'Introduce yourself and suggest a conversation',
    };
  }
}

// Types for goal extraction
interface ExtractedGoal {
  title: string;
  description: string;
  opportunityType: string;
  focusArea: string;
  targetAudience: string;
  suggestedApproach: string;
  firstCycleTitle: string;
  assistantSummary: string;
  confirmationMessage: string;
  firstCycleSteps: string[];
  firstDraftPrompt: string;
}

export interface StrategicResult {
  success: boolean;
  goal: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    offeringId?: string | null;
  };
  campaign: {
    id: string;
    title: string;
    strategicAngle: string | null;
    targetSegment: string | null;
    status: string;
    offeringId?: string | null;
  };
  extractedIntent: {
    focusArea: string;
    opportunityType: string;
    targetAudience: string;
    firstCycleTitle: string;
    firstCycleSteps: string[];
    firstDraftPrompt: string;
  };
}
