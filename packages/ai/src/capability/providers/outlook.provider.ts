import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider, EmailMessageDto, EmailSearchParams, EmailAttachment, SendEmailResult, ExecutionContext, ConnectionTestResult, SyncResult, SyncOptions, SyncStatus, RateLimitStatus } from '../interfaces';

@Injectable()
export class OutlookProvider implements IEmailProvider {
  readonly providerName = 'outlook';
  readonly displayName = 'Outlook';
  readonly capabilityType = 'email';
  readonly authType = 'oauth2' as const;
  
  readonly requiredScopes = [
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadWrite'
  ];
  
  readonly rateLimits = {
    requestsPerSecond: 5,
    burstSize: 10,
    dailyLimit: 5000
  };
  
  readonly configSchema = {
    type: 'object',
    properties: {
      clientId: { type: 'string' },
      clientSecret: { type: 'string' },
      tenantId: { type: 'string' },
      redirectUri: { type: 'string' }
    },
    required: ['clientId', 'clientSecret', 'tenantId']
  };

  private logger = new Logger(OutlookProvider.name);
  private config: any;
  private graphClient: any;

  async initialize(config: any): Promise<void> {
    this.config = config;
    
    // Initialize Microsoft Graph client
    const { Client } = await import('@microsoft/microsoft-graph-client');
    this.graphClient = Client.initWithMiddleware({
      defaultVersion: 'v1.0',
      debugLogging: true,
    });
    
    this.logger.log('Outlook provider initialized');
  }

  async validateCredentials(credentials: any): Promise<boolean> {
    try {
      // Test by getting user profile
      const response = await this.graphClient.api('/me').get();
      return !!response;
    } catch (error) {
      this.logger.error('Credential validation failed:', error);
      return false;
    }
  }

  async execute(operation: string, parameters: any, context: ExecutionContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      switch (operation) {
        case 'send':
          return await this.sendMessage(parameters, context);
        case 'search':
          return await this.searchEmails(parameters, context);
        case 'get':
          return await this.getEmail(parameters.messageId, context);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      this.logger.error(`Operation ${operation} failed:`, error);
      throw error;
    } finally {
      this.logger.log(`Operation ${operation} completed in ${Date.now() - startTime}ms`);
    }
  }

  async connect(credentials: any): Promise<void> {
    // Set up authentication for Microsoft Graph
    const { AuthenticationProvider } = await import('@microsoft/microsoft-graph-client');
    const authProvider = new AuthenticationProvider(
      credentials.clientId,
      credentials.clientSecret,
      credentials.tenantId,
      credentials.redirectUri
    );
    
    this.graphClient = Client.initWithMiddleware({
      defaultVersion: 'v1.0',
      debugLogging: true,
      authProvider: authProvider,
    });
    
    this.logger.log('Outlook provider connected');
  }

  async disconnect(): Promise<void> {
    this.graphClient = null;
    this.logger.log('Outlook provider disconnected');
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const startTime = Date.now();
      const response = await this.graphClient.api('/me').get();
      
      return {
        success: true,
        message: 'Connection successful',
        responseTime: Date.now() - startTime,
        details: response
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        details: error
      };
    }
  }

  async sync(cursor?: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    let itemsProcessed = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const errors: string[] = [];

    try {
      // Sync emails based on options
      const filter = this.buildSyncFilter(options);
      
      do {
        const response = await this.graphClient.api('/me/messages')
          .filter(filter)
          .top(options?.batchSize || 50)
          .skipToken(cursor)
          .get();

        if (response.value) {
          itemsProcessed += response.value.length;
          
          // Process each message
          for (const message of response.value) {
            try {
              // TODO: Store/update message in database
              itemsCreated++;
            } catch (error) {
              errors.push(`Failed to process message ${message.id}: ${error.message}`);
            }
          }
        }

        cursor = response['@odata.nextLink'];
      } while (cursor && (!options?.batchSize || itemsProcessed < options.batchSize));

      return {
        success: errors.length === 0,
        itemsProcessed,
        itemsCreated,
        itemsUpdated: 0,
        itemsDeleted: 0,
        nextCursor: cursor,
        hasMore: !!cursor,
        errors: errors.length > 0 ? errors : undefined,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        itemsProcessed,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        errors: [error.message],
        duration: Date.now() - startTime
      };
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    // TODO: Implement sync status tracking
    return {
      status: 'idle',
      lastSyncAt: new Date(),
      itemsSynced: 0
    };
  }

  async checkRateLimit(): Promise<RateLimitStatus> {
    // TODO: Implement rate limit checking with Microsoft Graph quotas
    return {
      remaining: 1000,
      resetTime: new Date(Date.now() + 60000),
      isLimited: false
    };
  }

  async waitForRateLimit(): Promise<void> {
    const status = await this.checkRateLimit();
    if (status.isLimited && status.retryAfter) {
      await new Promise(resolve => setTimeout(resolve, status.retryAfter * 1000));
    }
  }

  // Email-specific operations
  async sendMessage(message: EmailMessageDto, context: ExecutionContext): Promise<SendEmailResult> {
    try {
      const emailMessage = this.buildOutlookMessage(message);
      
      const response = await this.graphClient.api('/me/sendMail').post({
        message: emailMessage
      });

      return {
        messageId: response.id,
        threadId: response.conversationId,
        status: 'sent',
        timestamp: new Date(),
        providerResponse: response
      };
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async searchEmails(params: EmailSearchParams, context: ExecutionContext): Promise<any[]> {
    try {
      const filter = this.buildSearchFilter(params);
      
      const response = await this.graphClient.api('/me/messages')
        .filter(filter)
        .top(params.limit || 50)
        .orderBy('receivedDateTime desc')
        .get();

      if (!response.value) {
        return [];
      }

      // Parse and return messages
      return response.value.map((msg: any) => this.parseOutlookMessage(msg));
    } catch (error) {
      this.logger.error('Failed to search emails:', error);
      throw error;
    }
  }

  async getEmail(messageId: string, context: ExecutionContext): Promise<any> {
    try {
      const response = await this.graphClient.api(`/me/messages/${messageId}`).get();
      return this.parseOutlookMessage(response);
    } catch (error) {
      this.logger.error(`Failed to get email ${messageId}:`, error);
      throw error;
    }
  }

  async createDraft(draft: any, context: ExecutionContext): Promise<any> {
    try {
      const emailMessage = this.buildOutlookMessage(draft);
      
      const response = await this.graphClient.api('/me/messages').post({
        message: {
          ...emailMessage,
          isDraft: true
        }
      });

      return await this.getEmail(response.id, context);
    } catch (error) {
      this.logger.error('Failed to create draft:', error);
      throw error;
    }
  }

  async updateDraft(messageId: string, draft: any, context: ExecutionContext): Promise<any> {
    try {
      const emailMessage = this.buildOutlookMessage(draft);
      
      await this.graphClient.api(`/me/messages/${messageId}`).patch({
        message: {
          ...emailMessage,
          isDraft: true
        }
      });

      return await this.getEmail(messageId, context);
    } catch (error) {
      this.logger.error(`Failed to update draft ${messageId}:`, error);
      throw error;
    }
  }

  async deleteDraft(messageId: string, context: ExecutionContext): Promise<void> {
    try {
      await this.graphClient.api(`/me/messages/${messageId}`).delete();
    } catch (error) {
      this.logger.error(`Failed to delete draft ${messageId}:`, error);
      throw error;
    }
  }

  async getThread(threadId: string, context: ExecutionContext): Promise<any[]> {
    try {
      const response = await this.graphClient.api(`/me/messages`)
        .filter(`conversationId eq '${threadId}'`)
        .orderBy('receivedDateTime asc')
        .get();

      return response.value?.map((msg: any) => this.parseOutlookMessage(msg)) || [];
    } catch (error) {
      this.logger.error(`Failed to get thread ${threadId}:`, error);
      throw error;
    }
  }

  async replyToMessage(messageId: string, reply: EmailMessageDto, context: ExecutionContext): Promise<SendEmailResult> {
    try {
      // Get original message
      const originalMessage = await this.getEmail(messageId, context);
      
      const emailMessage = this.buildOutlookMessage({
        ...reply,
        subject: reply.subject.startsWith('Re:') ? reply.subject : `Re: ${originalMessage.subject}`,
        to: originalMessage.from
      });

      const response = await this.graphClient.api('/me/sendMail').post({
        message: emailMessage
      });

      return {
        messageId: response.id,
        threadId: response.conversationId,
        status: 'sent',
        timestamp: new Date(),
        providerResponse: response
      };
    } catch (error) {
      this.logger.error(`Failed to reply to message ${messageId}:`, error);
      throw error;
    }
  }

  async forwardMessage(messageId: string, forward: EmailMessageDto, context: ExecutionContext): Promise<SendEmailResult> {
    try {
      const originalMessage = await this.getEmail(messageId, context);
      
      const emailMessage = this.buildOutlookMessage({
        ...forward,
        subject: forward.subject.startsWith('Fwd:') ? forward.subject : `Fwd: ${originalMessage.subject}`
      });

      const response = await this.graphClient.api('/me/sendMail').post({
        message: emailMessage
      });

      return {
        messageId: response.id,
        threadId: response.conversationId,
        status: 'sent',
        timestamp: new Date(),
        providerResponse: response
      };
    } catch (error) {
      this.logger.error(`Failed to forward message ${messageId}:`, error);
      throw error;
    }
  }

  // Helper methods
  private buildOutlookMessage(message: EmailMessageDto): any {
    return {
      subject: message.subject,
      body: {
        contentType: 'Text',
        content: message.body
      },
      toRecipients: Array.isArray(message.to) ? message.to.map(email => ({ emailAddress: { address: email } })) : [{ emailAddress: { address: message.to } }],
      ccRecipients: message.cc ? (Array.isArray(message.cc) ? message.cc.map(email => ({ emailAddress: { address: email } })) : [{ emailAddress: { address: message.cc } }]) : undefined,
      bccRecipients: message.bcc ? (Array.isArray(message.bcc) ? message.bcc.map(email => ({ emailAddress: { address: email } })) : [{ emailAddress: { address: message.bcc } }]) : undefined,
      attachments: message.attachments?.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.contentType,
        contentBytes: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content
      })) || []
    };
  }

  private buildSearchFilter(params: EmailSearchParams): string {
    const filters: string[] = [];

    if (params.from) filters.push(`from/emailAddress/address eq '${params.from}'`);
    if (params.to) filters.push(`to/recipients/all(any)/emailAddress/address eq '${params.to}'`);
    if (params.subject) filters.push(`subject eq '${params.subject}'`);
    if (params.isUnread !== undefined) filters.push(`isRead eq ${params.isUnread ? 'false' : 'true'}`);
    if (params.isStarred) filters.push(`flag/flagStatus eq 'flagged'`);
    if (params.hasAttachments) filters.push(`hasAttachments eq true`);
    if (params.dateRange) {
      const start = params.dateRange.start.toISOString();
      const end = params.dateRange.end.toISOString();
      filters.push(`receivedDateTime ge ${start} and receivedDateTime le ${end}`);
    }

    return filters.join(' and ');
  }

  private buildSyncFilter(options?: SyncOptions): string {
    if (options?.fullSync) {
      return '';
    }
    
    // Default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return `receivedDateTime ge ${thirtyDaysAgo.toISOString()}`;
  }

  private parseOutlookMessage(message: any): any {
    return {
      id: message.id,
      threadId: message.conversationId,
      from: message.from?.emailAddress?.address || '',
      to: message.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
      cc: message.ccRecipients?.map((r: any) => r.emailAddress?.address) || [],
      bcc: message.bccRecipients?.map((r: any) => r.emailAddress?.address) || [],
      subject: message.subject || '(no subject)',
      body: message.body?.content || '',
      htmlBody: message.body?.contentType === 'Html' ? message.body?.content : '',
      attachments: message.attachments?.map((att: any) => ({
        filename: att.name,
        content: att.contentBytes,
        contentType: att.contentType,
        size: att.size
      })) || [],
      date: new Date(message.receivedDateTime),
      isUnread: !message.isRead,
      isStarred: message.flag?.flagStatus === 'flagged',
      isDraft: message.isDraft,
      labels: message.categories || [],
      headers: message.internetMessageHeaders || [],
      providerMetadata: message
    };
  }
}
