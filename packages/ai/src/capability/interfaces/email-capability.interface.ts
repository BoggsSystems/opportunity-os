import { ICapabilityProvider, ExecutionContext } from './capability-provider.interface';

export interface EmailMessageDto {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  from?: string;
  priority?: 'high' | 'normal' | 'low';
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  size?: number;
  encoding?: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId?: string;
  status: 'sent' | 'queued' | 'failed';
  deliveryStatus?: 'delivered' | 'bounced' | 'complained';
  timestamp: Date;
  providerResponse?: any;
}

export interface EmailSearchParams {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  hasAttachments?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  limit?: number;
  cursor?: string;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments: EmailAttachment[];
  date: Date;
  isUnread: boolean;
  isStarred: boolean;
  isDraft: boolean;
  labels?: string[];
  headers: Record<string, string>;
  providerMetadata?: any;
}

export interface DraftEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  body?: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
}

export interface IEmailCapability {
  // Core email operations
  sendMessage(message: EmailMessageDto, context: ExecutionContext): Promise<SendEmailResult>;
  searchEmails(params: EmailSearchParams, context: ExecutionContext): Promise<EmailMessage[]>;
  getEmail(messageId: string, context: ExecutionContext): Promise<EmailMessage>;
  
  // Draft operations
  createDraft(draft: DraftEmailParams, context: ExecutionContext): Promise<EmailMessage>;
  updateDraft(messageId: string, draft: Partial<DraftEmailParams>, context: ExecutionContext): Promise<EmailMessage>;
  deleteDraft(messageId: string, context: ExecutionContext): Promise<void>;
  
  // Thread operations
  getThread(threadId: string, context: ExecutionContext): Promise<EmailMessage[]>;
  replyToMessage(messageId: string, reply: EmailMessageDto, context: ExecutionContext): Promise<SendEmailResult>;
  forwardMessage(messageId: string, forward: EmailMessageDto, context: ExecutionContext): Promise<SendEmailResult>;
  
  // Label operations
  addLabels(messageIds: string[], labels: string[], context: ExecutionContext): Promise<void>;
  removeLabels(messageIds: string[], labels: string[], context: ExecutionContext): Promise<void>;
  
  // Batch operations
  markAsRead(messageIds: string[], context: ExecutionContext): Promise<void>;
  markAsUnread(messageIds: string[], context: ExecutionContext): Promise<void>;
  markAsStarred(messageIds: string[], context: ExecutionContext): Promise<void>;
  markAsUnstarred(messageIds: string[], context: ExecutionContext): Promise<void>;
  
  // Delete operations
  deleteMessages(messageIds: string[], context: ExecutionContext): Promise<void>;
  archiveMessages(messageIds: string[], context: ExecutionContext): Promise<void>;
}

export interface IEmailProvider extends ICapabilityProvider, IEmailCapability {
  readonly capabilityType: 'email';
  
  // Email-specific operations
  sendEmail(message: EmailMessageDto, context: ExecutionContext): Promise<SendEmailResult>;
  searchEmails(params: EmailSearchParams, context: ExecutionContext): Promise<EmailMessage[]>;
  getEmail(messageId: string, context: ExecutionContext): Promise<EmailMessage>;
}
