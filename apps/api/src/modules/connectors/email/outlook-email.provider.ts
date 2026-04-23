import { Injectable } from '@nestjs/common';
import {
  EmailConnectorCredentials,
  EmailProvider,
  EmailSendInput,
  EmailSendResult,
  SyncedEmailMessage,
} from './email-provider.interface';

@Injectable()
export class OutlookEmailProvider implements EmailProvider {
  readonly providerName = 'outlook' as const;

  async send(input: EmailSendInput, credentials: EmailConnectorCredentials): Promise<EmailSendResult> {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: 'Text', content: input.body },
          toRecipients: input.to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      }),
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Outlook send failed', response.status, payload));
    }
    return { providerMessageId: null, rawResponse: payload ?? { accepted: true } };
  }

  async sync(credentials: EmailConnectorCredentials, cursor?: string | null) {
    const accessToken = this.requireAccessToken(credentials);
    const filter = cursor ? `&$filter=receivedDateTime ge ${new Date(cursor).toISOString()}` : '';
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc${filter}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Outlook sync failed', response.status, payload));
    }
    const messages = (payload?.value ?? []).map((message: any) => this.parseMessage(message));
    return {
      messages,
      nextCursor: new Date().toISOString(),
      rawResponse: { count: messages.length },
    };
  }

  async test(credentials: EmailConnectorCredentials) {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Outlook connector test failed', response.status, payload));
    }
    return { ok: true, emailAddress: payload?.mail ?? payload?.userPrincipalName ?? credentials.emailAddress ?? null, rawResponse: payload };
  }

  private parseMessage(message: any): SyncedEmailMessage {
    return {
      providerMessageId: message.id,
      providerThreadId: message.conversationId,
      subject: message.subject || '(no subject)',
      fromEmail: message.from?.emailAddress?.address ?? null,
      fromName: message.from?.emailAddress?.name ?? null,
      toEmails: (message.toRecipients ?? []).map((recipient: any) => recipient.emailAddress?.address).filter(Boolean),
      snippet: message.bodyPreview,
      bodyPreview: message.bodyPreview,
      receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : new Date(),
      raw: message,
    };
  }

  private requireAccessToken(credentials: EmailConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('Outlook connector is missing an access token');
    }
    return credentials.accessToken;
  }

  private async readJson(response: Response) {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  private errorMessage(prefix: string, status: number, payload: any) {
    const detail = payload?.error?.message ?? payload?.error_description ?? JSON.stringify(payload);
    return `${prefix}: ${status}${detail ? ` ${detail}` : ''}`;
  }
}
