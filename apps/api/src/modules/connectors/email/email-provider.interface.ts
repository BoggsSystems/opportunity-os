export interface EmailConnectorCredentials {
  accessToken?: string;
  refreshToken?: string;
  emailAddress?: string;
  expiresAt?: string;
}

export interface EmailSendInput {
  to: string[];
  subject: string;
  body: string;
  fromName?: string;
  replyToMessageId?: string;
  threadId?: string;
}

export interface EmailSendResult {
  providerMessageId: string | null;
  providerThreadId?: string | null;
  rawResponse?: unknown;
}

export interface SyncedEmailMessage {
  providerMessageId: string;
  providerThreadId?: string | null;
  subject: string;
  fromEmail?: string | null;
  fromName?: string | null;
  toEmails: string[];
  snippet?: string | null;
  bodyPreview?: string | null;
  receivedAt: Date;
  raw?: unknown;
}

export interface EmailProvider {
  readonly providerName: 'gmail' | 'outlook';
  send(input: EmailSendInput, credentials: EmailConnectorCredentials): Promise<EmailSendResult>;
  sync(credentials: EmailConnectorCredentials, cursor?: string | null): Promise<{
    messages: SyncedEmailMessage[];
    nextCursor?: string | null;
    rawResponse?: unknown;
  }>;
  test(credentials: EmailConnectorCredentials): Promise<{ ok: boolean; emailAddress?: string | null; rawResponse?: unknown }>;
}
