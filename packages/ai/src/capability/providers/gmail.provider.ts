import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider, EmailMessageDto, EmailSearchParams, EmailAttachment, SendEmailResult, ExecutionContext, ConnectionTestResult, SyncResult, SyncOptions, SyncStatus, RateLimitStatus } from '../interfaces';

@Injectable()
export class GmailProvider implements IEmailProvider {
  readonly providerName = 'gmail';
  readonly displayName = 'Gmail';
  readonly capabilityType = 'email';
  readonly authType = 'oauth2' as const;
  
  readonly requiredScopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ];
  
  readonly rateLimits = {
    requestsPerSecond: 10,
    burstSize: 20,
    dailyLimit: 10000
  };
  
  readonly configSchema = {
    type: 'object',
    properties: {
      clientId: { type: 'string' },
      clientSecret: { type: 'string' },
      redirectUri: { type: 'string' }
    },
    required: ['clientId', 'clientSecret']
  };

  private logger = new Logger(GmailProvider.name);
  private config: any;
  private oauth2Client: any;
  private gmail: any;

  async initialize(config: any): Promise<void> {
    this.config = config;
    
    // Initialize OAuth2 client
    const { google } = await import('googleapis');
    this.oauth2Client = new google.auth.OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    
    // Initialize Gmail API
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    this.logger.log('Gmail provider initialized');
  }

  async validateCredentials(credentials: any): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials(credentials);
      
      // Test by getting user profile
      const { google } = await import('googleapis');
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      
      return !!userInfo.data;
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
    this.oauth2Client.setCredentials(credentials);
    this.logger.log('Gmail provider connected');
  }

  async disconnect(): Promise<void> {
    this.oauth2Client = null;
    this.gmail = null;
    this.logger.log('Gmail provider disconnected');
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const { google } = await import('googleapis');
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const startTime = Date.now();
      
      const userInfo = await oauth2.userinfo.get();
      
      return {
        success: true,
        message: 'Connection successful',
        responseTime: Date.now() - startTime,
        details: userInfo.data
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
      const query = this.buildSyncQuery(options);
      
      do {
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: options?.batchSize || 50,
          pageToken: cursor
        });

        if (response.data.messages) {
          itemsProcessed += response.data.messages.length;
          
          // Process each message (would integrate with existing email storage)
          for (const messageRef of response.data.messages) {
            try {
              const message = await this.gmail.users.messages.get({
                userId: 'me',
                id: messageRef.id,
                format: 'full'
              });
              
              // TODO: Store/update message in database
              itemsCreated++;
            } catch (error) {
              errors.push(`Failed to process message ${messageRef.id}: ${error.message}`);
            }
          }
        }

        cursor = response.data.nextPageToken;
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
    // TODO: Implement rate limit checking with Google API quotas
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
      const email = this.buildEmailMessage(message);
      
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: email
        }
      });

      return {
        messageId: response.data.id,
        threadId: response.data.threadId,
        status: 'sent',
        timestamp: new Date(),
        providerResponse: response.data
      };
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async searchEmails(params: EmailSearchParams, context: ExecutionContext): Promise<any[]> {
    try {
      const query = this.buildSearchQuery(params);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: params.limit || 50,
        pageToken: params.cursor
      });

      if (!response.data.messages) {
        return [];
      }

      // Fetch full message details
      const messages = await Promise.all(
        response.data.messages.map(async (messageRef: any) => {
          const message = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id,
            format: 'full'
          });
          return this.parseGmailMessage(message.data);
        })
      );

      return messages;
    } catch (error) {
      this.logger.error('Failed to search emails:', error);
      throw error;
    }
  }

  async getEmail(messageId: string, context: ExecutionContext): Promise<any> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return this.parseGmailMessage(response.data);
    } catch (error) {
      this.logger.error(`Failed to get email ${messageId}:`, error);
      throw error;
    }
  }

  async createDraft(draft: any, context: ExecutionContext): Promise<any> {
    try {
      const email = this.buildEmailMessage(draft);
      
      const response = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: { raw: email }
        }
      });

      return await this.getEmail(response.data.message.id, context);
    } catch (error) {
      this.logger.error('Failed to create draft:', error);
      throw error;
    }
  }

  async updateDraft(messageId: string, draft: any, context: ExecutionContext): Promise<any> {
    try {
      const email = this.buildEmailMessage(draft);
      
      const response = await this.gmail.users.drafts.update({
        userId: 'me',
        id: messageId,
        requestBody: {
          message: { raw: email }
        }
      });

      return await this.getEmail(response.data.message.id, context);
    } catch (error) {
      this.logger.error(`Failed to update draft ${messageId}:`, error);
      throw error;
    }
  }

  async deleteDraft(messageId: string, context: ExecutionContext): Promise<void> {
    try {
      await this.gmail.users.drafts.delete({
        userId: 'me',
        id: messageId
      });
    } catch (error) {
      this.logger.error(`Failed to delete draft ${messageId}:`, error);
      throw error;
    }
  }

  async getThread(threadId: string, context: ExecutionContext): Promise<any[]> {
    try {
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId
      });

      return response.data.messages?.map((msg: any) => this.parseGmailMessage(msg)) || [];
    } catch (error) {
      this.logger.error(`Failed to get thread ${threadId}:`, error);
      throw error;
    }
  }

  async replyToMessage(messageId: string, reply: EmailMessage, context: ExecutionContext): Promise<SendEmailResult> {
    try {
      // Get original message to get thread ID
      const originalMessage = await this.getEmail(messageId, context);
      const threadId = originalMessage.threadId;

      // Add Re: prefix to subject
      reply.subject = reply.subject.startsWith('Re:') ? reply.subject : `Re: ${reply.subject}`;
      
      // Set thread ID for proper threading
      const email = this.buildEmailMessage({ ...reply, threadId });
      
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: email,
          threadId: threadId
        }
      });

      return {
        messageId: response.data.id,
        threadId: response.data.threadId,
        status: 'sent',
        timestamp: new Date(),
        providerResponse: response.data
      };
    } catch (error) {
      this.logger.error(`Failed to reply to message ${messageId}:`, error);
      throw error;
    }
  }

  async forwardMessage(messageId: string, forward: EmailMessage, context: ExecutionContext): Promise<SendEmailResult> {
    try {
      const originalMessage = await this.getEmail(messageId, context);
      
      // Add Fwd: prefix to subject
      forward.subject = forward.subject.startsWith('Fwd:') ? forward.subject : `Fwd: ${forward.subject}`;
      
      const email = this.buildEmailMessage(forward);
      
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: email
        }
      });

      return {
        messageId: response.data.id,
        threadId: response.data.threadId,
        status: 'sent',
        timestamp: new Date(),
        providerResponse: response.data
      };
    } catch (error) {
      this.logger.error(`Failed to forward message ${messageId}:`, error);
      throw error;
    }
  }

  // Helper methods
  private buildEmailMessage(message: EmailMessage): string {
    const { createMimeMessage } = require('mailparser');
    
    const mimeMessage = createMimeMessage({
      from: message.from,
      to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      cc: message.cc ? (Array.isArray(message.cc) ? message.cc.join(', ') : message.cc) : undefined,
      bcc: message.bcc ? (Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc) : undefined,
      subject: message.subject,
      text: message.body,
      html: message.htmlBody,
      attachments: message.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      })),
      headers: message.headers
    });

    return Buffer.from(mimeMessage).toString('base64');
  }

  private buildSearchQuery(params: EmailSearchParams): string {
    const queryParts: string[] = [];

    if (params.query) queryParts.push(params.query);
    if (params.from) queryParts.push(`from:${params.from}`);
    if (params.to) queryParts.push(`to:${params.to}`);
    if (params.subject) queryParts.push(`subject:${params.subject}`);
    if (params.hasAttachments) queryParts.push('has:attachment');
    if (params.isUnread !== undefined) queryParts.push(params.isUnread ? 'is:unread' : 'is:read');
    if (params.isStarred) queryParts.push('is:starred');
    if (params.dateRange) {
      const start = params.dateRange.start.toISOString().split('T')[0];
      const end = params.dateRange.end.toISOString().split('T')[0];
      queryParts.push(`after:${start}`, `before:${end}`);
    }

    return queryParts.join(' ');
  }

  private buildSyncQuery(options?: SyncOptions): string {
    if (options?.fullSync) {
      return '';
    }
    
    // Default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return `after:${thirtyDaysAgo.toISOString().split('T')[0]}`;
  }

  private parseGmailMessage(message: any): any {
    const { simpleParser } = require('mailparser');
    
    // Parse the raw message content
    const parsed = simpleParser(message.raw);
    
    return {
      id: message.id,
      threadId: message.threadId,
      from: this.extractHeader(message, 'From'),
      to: this.extractRecipients(message, 'To'),
      cc: this.extractRecipients(message, 'Cc'),
      bcc: this.extractRecipients(message, 'Bcc'),
      subject: message.subject || '(no subject)',
      body: message.snippet || '',
      htmlBody: parsed.html || parsed.text || '',
      attachments: message.payload?.parts?.filter((part: any) => part.filename) || [],
      date: new Date(parseInt(message.internalDate)),
      isUnread: !message.labelIds?.includes('UNREAD'),
      isStarred: message.labelIds?.includes('STARRED'),
      isDraft: message.labelIds?.includes('DRAFT'),
      labels: message.labelIds || [],
      headers: message.payload?.headers || [],
      providerMetadata: message
    };
  }

  private extractHeader(message: any, headerName: string): string {
    const header = message.payload?.headers?.find((h: any) => h.name === headerName);
    return header?.value || '';
  }

  private extractRecipients(message: any, headerName: string): string[] {
    const header = this.extractHeader(message, headerName);
    if (!header) return [];
    
    return header.split(',').map(email => email.trim());
  }
}
