import { Injectable } from '@nestjs/common';
import {
  EmailConnectorCredentials,
  EmailProvider,
  EmailSendInput,
  EmailSendResult,
  SyncedEmailMessage,
} from './email-provider.interface';

@Injectable()
export class GmailEmailProvider implements EmailProvider {
  readonly providerName = 'gmail' as const;

  async send(input: EmailSendInput, credentials: EmailConnectorCredentials): Promise<EmailSendResult> {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: this.buildRawMessage(input) }),
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Gmail send failed', response.status, payload));
    }
    return {
      providerMessageId: typeof payload?.id === 'string' ? payload.id : null,
      providerThreadId: typeof payload?.threadId === 'string' ? payload.threadId : null,
      rawResponse: payload,
    };
  }

  async sync(credentials: EmailConnectorCredentials, cursor?: string | null) {
    const accessToken = this.requireAccessToken(credentials);
    const query = cursor ? `after:${Math.floor(new Date(cursor).getTime() / 1000)}` : 'newer_than:30d';
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const listPayload = await this.readJson(listResponse);
    if (!listResponse.ok) {
      throw new Error(this.errorMessage('Gmail sync failed', listResponse.status, listPayload));
    }

    const messages: SyncedEmailMessage[] = [];
    for (const item of listPayload?.messages ?? []) {
      if (!item?.id) continue;
      const messageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const messagePayload = await this.readJson(messageResponse);
      if (!messageResponse.ok) continue;
      messages.push(this.parseMessage(messagePayload));
    }

    return {
      messages,
      nextCursor: new Date().toISOString(),
      rawResponse: { count: messages.length },
    };
  }

  async test(credentials: EmailConnectorCredentials) {
    const accessToken = this.requireAccessToken(credentials);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(this.errorMessage('Gmail connector test failed', response.status, payload));
    }
    return { ok: true, emailAddress: payload?.emailAddress ?? credentials.emailAddress ?? null, rawResponse: payload };
  }

  private buildRawMessage(input: EmailSendInput) {
    const lines = [
      input.fromName ? `From: ${input.fromName}` : undefined,
      `To: ${input.to.join(', ')}`,
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      input.body,
    ].filter((line): line is string => line !== undefined);
    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }

  private parseMessage(message: any): SyncedEmailMessage {
    const headers = message?.payload?.headers ?? [];
    const subject = this.header(headers, 'Subject') || '(no subject)';
    const from = this.parseAddress(this.header(headers, 'From'));
    return {
      providerMessageId: message.id,
      providerThreadId: message.threadId,
      subject,
      fromEmail: from.email,
      fromName: from.name,
      toEmails: this.parseAddressList(this.header(headers, 'To')),
      snippet: message.snippet,
      bodyPreview: message.snippet,
      receivedAt: new Date(Number(message.internalDate ?? Date.now())),
      raw: message,
    };
  }

  private header(headers: any[], name: string) {
    return headers.find((header) => String(header.name).toLowerCase() === name.toLowerCase())?.value ?? null;
  }

  private parseAddress(value?: string | null) {
    if (!value) return { email: null, name: null };
    const match = value.match(/^(.*?)<([^>]+)>$/);
    if (!match) return { email: value.trim(), name: null };
    return { name: match[1].replaceAll('"', '').trim() || null, email: match[2].trim() };
  }

  private parseAddressList(value?: string | null) {
    if (!value) return [];
    return value.split(',').map((item) => this.parseAddress(item).email).filter((email): email is string => Boolean(email));
  }

  private requireAccessToken(credentials: EmailConnectorCredentials) {
    if (!credentials.accessToken) {
      throw new Error('Gmail connector is missing an access token');
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
