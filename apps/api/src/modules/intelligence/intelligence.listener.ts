import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IntelligenceService } from './intelligence.service';

@Injectable()
export class IntelligenceListener {
  private readonly logger = new Logger(IntelligenceListener.name);

  constructor(private readonly intelligenceService: IntelligenceService) {}

  @OnEvent('linkedin.ingested')
  async handleLinkedInIngested(payload: {
    userId: string;
    importId: string;
    about: string;
    headline: string;
    positions: Array<{ title: string; company: string; description: string }>;
  }) {
    this.logger.log(`Strategic Listener: Harvesting LinkedIn data for user ${payload.userId}`);
    
    const rawText = `
      Headline: ${payload.headline}
      About: ${payload.about}
      Experience:
      ${payload.positions.map(p => `${p.title} at ${p.company}: ${p.description}`).join('\n')}
    `;

    try {
      await this.intelligenceService.shredText(payload.userId, rawText, {
        type: 'knowledge_asset',
        id: payload.importId
      });
    } catch (e) {
      this.logger.error(`Failed to shred LinkedIn data for user ${payload.userId}`, e);
    }
  }

  @OnEvent('email.received')
  async handleEmailReceived(payload: {
    userId: string;
    messageId: string;
    threadId?: string;
    body: string;
    subject: string;
  }) {
    this.logger.log(`Strategic Listener: Harvesting email signal for user ${payload.userId}`);

    try {
      await this.intelligenceService.shredText(payload.userId, payload.body, {
        type: 'conversation_thread',
        id: payload.threadId || payload.messageId
      });
    } catch (e) {
      this.logger.error(`Failed to shred email data for user ${payload.userId}`, e);
    }
  }
}
