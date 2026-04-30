import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityType,
  CapabilityExecutionStatus,
  CapabilityType,
  ConnectorStatus,
  Prisma,
  prisma,
} from '@opportunity-os/db';
import { createHash, randomBytes } from 'crypto';
import { SetupEmailConnectorDto } from './dto/setup-email-connector.dto';
import { SetupStorageConnectorDto } from './dto/setup-storage-connector.dto';
import { SetupCalendarConnectorDto } from './dto/setup-calendar-connector.dto';
import { EmailProvider, EmailSendInput, SyncedEmailMessage } from './email/email-provider.interface';
import { GmailEmailProvider } from './email/gmail-email.provider';
import { OutlookEmailProvider } from './email/outlook-email.provider';
import { GoogleDriveProvider } from './storage/google-drive.provider';
import { OneDriveProvider } from './storage/onedrive.provider';
import { DropboxProvider } from './storage/dropbox.provider';
import { StorageProvider, SyncedFile } from './storage/storage-provider.interface';
import { GoogleCalendarProvider } from './calendar/google-calendar.provider';
import { OutlookCalendarProvider } from './calendar/outlook-calendar.provider';
import { ICloudCalendarProvider } from './calendar/icloud-calendar.provider';
import { CalendarProvider } from './calendar/calendar-provider.interface';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly gmailProvider: GmailEmailProvider,
    private readonly outlookProvider: OutlookEmailProvider,
    private readonly googleDriveProvider: GoogleDriveProvider,
    private readonly oneDriveProvider: OneDriveProvider,
    private readonly dropboxProvider: DropboxProvider,
    private readonly googleCalendarProvider: GoogleCalendarProvider,
    private readonly outlookCalendarProvider: OutlookCalendarProvider,
    private readonly icloudCalendarProvider: ICloudCalendarProvider,
  ) {}

  async listConnectors(userId: string) {
    const connectors = await prisma.userConnector.findMany({
      where: { userId },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: { select: { expiresAt: true, lastRefreshedAt: true, refreshStatus: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return connectors.map((connector) => this.toConnectorSummary(connector));
  }

  async getEmailReadiness(userId: string) {
    const connector = await this.findConnectedEmailConnector(userId);
    if (!connector) {
      return {
        ready: false,
        blocked: true,
        reason: 'missing_email_connector',
        upgradeHint: 'Connect Gmail or Outlook before sending real outreach.',
        providers: ['gmail', 'outlook'],
      };
    }

    const credentials = this.parseCredentials(connector.connectorCredentials?.encryptedData);
    const hasAccessToken = Boolean(credentials.accessToken);
    return {
      ready: hasAccessToken,
      blocked: !hasAccessToken,
      reason: hasAccessToken ? null : 'missing_access_token',
      upgradeHint: hasAccessToken ? null : 'Reconnect this email account with a valid access token.',
      connector: this.toConnectorSummary(connector),
    };
  }

  async setupEmailConnector(userId: string, dto: SetupEmailConnectorDto) {
    const { capability, provider } = await this.ensureEmailProvider(dto.providerName);
    const credentials = {
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      emailAddress: dto.emailAddress,
      expiresAt: dto.expiresAt,
    };

    const connector = await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName: dto.connectorName?.trim() || provider.displayName,
        status: dto.accessToken ? ConnectorStatus.connected : ConnectorStatus.pending_setup,
        enabledFeaturesJson: this.toJson(['send', 'sync', 'reply_detection', 'thread_summary']),
        enabledRoles: ['IDENTITY', 'SIGNAL', 'STRATEGIC', 'DAILY_ACTION', 'EXECUTION', 'VERIFICATION', 'MOMENTUM'],
        metadataJson: this.toJson({ emailAddress: dto.emailAddress }),
      },
      update: {
        capabilityProviderId: provider.id,
        connectorName: dto.connectorName?.trim() || provider.displayName,
        status: dto.accessToken ? ConnectorStatus.connected : ConnectorStatus.pending_setup,
        enabledFeaturesJson: this.toJson(['send', 'sync', 'reply_detection', 'thread_summary']),
        enabledRoles: ['IDENTITY', 'SIGNAL', 'STRATEGIC', 'DAILY_ACTION', 'EXECUTION', 'VERIFICATION', 'MOMENTUM'],
        metadataJson: this.toJson({ emailAddress: dto.emailAddress }),
        errorMessage: null,
      },
      include: { capability: true, capabilityProvider: true, connectorCredentials: true },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: 'oauth2_token',
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: dto.accessToken ? 'ready' : 'missing_access_token',
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        lastRefreshedAt: new Date(),
        refreshStatus: dto.accessToken ? 'ready' : 'missing_access_token',
      },
    });

    return this.getEmailReadiness(userId);
  }

  async setupStorageConnector(userId: string, dto: SetupStorageConnectorDto) {
    const { capability, provider } = await this.ensureStorageProvider(dto.providerName);
    const credentials = {
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      expiresAt: dto.expiresAt,
    };

    const connector = await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName: 
          dto.providerName === 'google_drive' ? 'Google Drive' : 
          dto.providerName === 'onedrive' ? 'OneDrive' : 'Dropbox',
        status: ConnectorStatus.connected,
        enabledFeaturesJson: this.toJson(['list', 'download', 'sync']),
        enabledRoles: ['IDENTITY', 'STRATEGIC'],
      },
      update: {
        capabilityProviderId: provider.id,
        status: ConnectorStatus.connected,
        enabledRoles: ['IDENTITY', 'STRATEGIC'],
        errorMessage: null,
      },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: 'oauth2_token',
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: 'ready',
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: 'ready',
      },
    });

    return { success: true, connector: this.toConnectorSummary(connector) };
  }

  async setupCalendarConnector(userId: string, dto: SetupCalendarConnectorDto) {
    const { capability, provider } = await this.ensureCalendarProvider(dto.providerName);
    const credentials = {
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      expiresAt: dto.expiresAt,
      emailAddress: dto.emailAddress,
    };

    const connector = await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName: 
          dto.providerName === 'google_calendar' ? 'Google Calendar' : 
          dto.providerName === 'outlook' ? 'Outlook Calendar' : 'iCloud Calendar',
        status: ConnectorStatus.connected,
        enabledFeaturesJson: this.toJson(['list', 'sync']),
        enabledRoles: ['DAILY_ACTION', 'VERIFICATION'],
      },
      update: {
        capabilityProviderId: provider.id,
        status: ConnectorStatus.connected,
        enabledRoles: ['DAILY_ACTION', 'VERIFICATION'],
        errorMessage: null,
      },
    });

    await prisma.connectorCredential.upsert({
      where: { userConnectorId: connector.id },
      create: {
        userConnectorId: connector.id,
        credentialType: 'oauth2_token',
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: 'ready',
      },
      update: {
        encryptedData: JSON.stringify(credentials),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        refreshStatus: 'ready',
      },
    });

    return { success: true, connector: this.toConnectorSummary(connector) };
  }

  async startEmailOAuth(userId: string, providerName: 'outlook', returnTo?: string) {
    if (providerName !== 'outlook') {
      throw new BadRequestException('OAuth flow is currently implemented for Outlook only.');
    }

    const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID first.');
    }

    const { capability, provider } = await this.ensureEmailProvider(providerName);
    const state = randomBytes(24).toString('hex');
    const codeVerifier = randomBytes(48).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const redirectUri = this.microsoftRedirectUri();
    const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';
    const scopes = [
      'offline_access',
      'openid',
      'profile',
      'email',
      'User.Read',
      'Mail.Send',
      'Mail.Read',
    ];

    await prisma.userConnector.upsert({
      where: {
        userId_capabilityId: {
          userId,
          capabilityId: capability.id,
        },
      },
      create: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: provider.id,
        connectorName: provider.displayName,
        status: ConnectorStatus.pending_setup,
        enabledFeaturesJson: this.toJson(['send', 'sync', 'reply_detection', 'thread_summary']),
        metadataJson: this.toJson({
          oauthState: state,
          oauthCodeVerifier: codeVerifier,
          oauthReturnTo: returnTo,
          oauthProvider: providerName,
        }),
      },
      update: {
        capabilityProviderId: provider.id,
        connectorName: provider.displayName,
        status: ConnectorStatus.pending_setup,
        errorMessage: null,
        metadataJson: this.toJson({
          oauthState: state,
          oauthCodeVerifier: codeVerifier,
          oauthReturnTo: returnTo,
          oauthProvider: providerName,
        }),
      },
    });

    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return { providerName, authUrl: authUrl.toString(), state };
  }

  async completeEmailOAuth(input: {
    state?: string;
    code?: string;
    error?: string;
    errorDescription?: string;
  }) {
    if (input.error) {
      return this.oauthResultHtml({
        success: false,
        provider: 'outlook',
        error: input.errorDescription || input.error,
      });
    }
    if (!input.state || !input.code) {
      return this.oauthResultHtml({
        success: false,
        provider: 'outlook',
        error: 'Missing OAuth state or authorization code.',
      });
    }

    const connector = await prisma.userConnector.findFirst({
      where: {
        metadataJson: { path: ['oauthState'], equals: input.state },
      },
      include: {
        capabilityProvider: true,
        connectorCredentials: true,
      },
    });

    if (!connector) {
      return this.oauthResultHtml({
        success: false,
        provider: 'outlook',
        error: 'OAuth session was not found or has expired.',
      });
    }

    try {
      const metadata = this.jsonObject(connector.metadataJson);
      const codeVerifier = typeof metadata['oauthCodeVerifier'] === 'string' ? metadata['oauthCodeVerifier'] : '';
      const returnTo = typeof metadata['oauthReturnTo'] === 'string' ? metadata['oauthReturnTo'] : undefined;
      if (!codeVerifier) {
        throw new Error('Missing PKCE verifier for OAuth completion.');
      }

      const tokenResult = await this.exchangeMicrosoftCode(input.code, codeVerifier);
      const credentials = {
        accessToken: tokenResult.access_token,
        refreshToken: tokenResult.refresh_token,
        expiresAt: tokenResult.expires_in
          ? new Date(Date.now() + tokenResult.expires_in * 1000).toISOString()
          : undefined,
      };

      await prisma.connectorCredential.upsert({
        where: { userConnectorId: connector.id },
        create: {
          userConnectorId: connector.id,
          credentialType: 'oauth2_token',
          encryptedData: JSON.stringify(credentials),
          expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
          refreshStatus: 'ready',
        },
        update: {
          encryptedData: JSON.stringify(credentials),
          expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : null,
          lastRefreshedAt: new Date(),
          refreshStatus: 'ready',
        },
      });

      const testResult = await this.outlookProvider.test({
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
      });

      await prisma.userConnector.update({
        where: { id: connector.id },
        data: {
          status: ConnectorStatus.connected,
          lastSuccessAt: new Date(),
          errorMessage: null,
          metadataJson: this.toJson({
            emailAddress: testResult.emailAddress,
            oauthProvider: 'outlook',
          }),
        },
      });

      return this.oauthResultHtml({
        success: true,
        provider: 'outlook',
        emailAddress: testResult.emailAddress ?? undefined,
        returnTo,
      });
    } catch (error) {
      const connectorMetadata = this.jsonObject(connector.metadataJson);
      await prisma.userConnector.update({
        where: { id: connector.id },
        data: {
          status: ConnectorStatus.error,
          errorMessage: error instanceof Error ? error.message : 'OAuth completion failed',
        },
      }).catch(() => null);

      return this.oauthResultHtml({
        success: false,
        provider: 'outlook',
        error: error instanceof Error ? error.message : 'OAuth completion failed',
        returnTo: typeof connectorMetadata['oauthReturnTo'] === 'string'
          ? connectorMetadata['oauthReturnTo']
          : undefined,
      });
    }
  }

  async testConnector(userId: string, connectorId: string) {
    const connector = await this.findConnector(userId, connectorId);
    const provider = this.emailProviderFor(connector.capabilityProvider.providerName);
    const credentials = this.parseCredentials(connector.connectorCredentials?.encryptedData);

    try {
      const result = await provider.test(credentials);
      await prisma.userConnector.update({
        where: { id: connector.id },
        data: {
          status: ConnectorStatus.connected,
          lastSuccessAt: new Date(),
          errorMessage: null,
          metadataJson: this.toJson({ ...(connector.metadataJson as object ?? {}), emailAddress: result.emailAddress }),
        },
      });
      await this.logExecution(connector.id, 'connector.test', CapabilityExecutionStatus.succeeded, {}, result);
      return { success: true, result };
    } catch (error) {
      await prisma.userConnector.update({
        where: { id: connector.id },
        data: { status: ConnectorStatus.error, errorMessage: error instanceof Error ? error.message : 'Connector test failed' },
      });
      await this.logExecution(connector.id, 'connector.test', CapabilityExecutionStatus.failed, {}, { error: String(error) });
      throw error;
    }
  }

  async sendEmail(userId: string, input: EmailSendInput & { opportunityId?: string; companyId?: string; personId?: string }) {
    const connector = await this.findConnectedEmailConnector(userId);
    if (!connector) {
      throw new BadRequestException('Connect Gmail or Outlook before sending real outreach.');
    }
    const provider = this.emailProviderFor(connector.capabilityProvider.providerName);
    const credentials = this.parseCredentials(connector.connectorCredentials?.encryptedData);
    const result = await provider.send(input, credentials);
    await prisma.userConnector.update({
      where: { id: connector.id },
      data: { lastSuccessAt: new Date(), errorMessage: null },
    });
    await this.logExecution(
      connector.id,
      'email.send',
      CapabilityExecutionStatus.succeeded,
      input,
      result,
      input.opportunityId,
    );
    return { connector, result };
  }

  async syncEmail(userId: string) {
    const connector = await this.findConnectedEmailConnector(userId);
    if (!connector) {
      throw new BadRequestException('Connect Gmail or Outlook before syncing email.');
    }
    const provider = this.emailProviderFor(connector.capabilityProvider.providerName);
    const credentials = this.parseCredentials(connector.connectorCredentials?.encryptedData);
    const syncState = await prisma.connectorSyncState.findUnique({
      where: {
        userConnectorId_syncType: {
          userConnectorId: connector.id,
          syncType: 'email_inbox',
        },
      },
    });

    const result = await provider.sync(credentials, syncState?.providerCursor);
    const linked = await this.linkReplies(userId, result.messages);

    await prisma.connectorSyncState.upsert({
      where: {
        userConnectorId_syncType: {
          userConnectorId: connector.id,
          syncType: 'email_inbox',
        },
      },
      create: {
        userConnectorId: connector.id,
        syncType: 'email_inbox',
        providerCursor: result.nextCursor,
        lastSyncAt: new Date(),
        syncStatus: 'succeeded',
        itemsSynced: result.messages.length,
      },
      update: {
        providerCursor: result.nextCursor,
        lastSyncAt: new Date(),
        syncStatus: 'succeeded',
        itemsSynced: { increment: result.messages.length },
        errorDetailsJson: undefined,
      },
    });

    await prisma.userConnector.update({
      where: { id: connector.id },
      data: { lastSyncAt: new Date(), lastSuccessAt: new Date(), errorMessage: null },
    });
    await this.logExecution(connector.id, 'email.sync', CapabilityExecutionStatus.succeeded, {}, { count: result.messages.length });

    return {
      success: true,
      synced: result.messages.length,
      linkedReplies: linked.length,
      replies: linked,
    };
  }

  async syncStorage(userId: string) {
    const connector = await this.findConnectedConnector(userId, CapabilityType.storage);
    if (!connector) {
      throw new BadRequestException('Connect Google Drive before syncing storage.');
    }
    const provider = this.storageProviderFor(connector.capabilityProvider.providerName);
    const credentials = this.parseCredentials(connector.connectorCredentials?.encryptedData);

    const files = await provider.listFiles(credentials);
    const created = [];
    
    for (const file of files) {
      const asset = await prisma.userAsset.upsert({
        where: {
          userConnectorId_externalId: {
            userConnectorId: connector.id,
            externalId: file.externalId,
          },
        },
        create: {
          userId,
          userConnectorId: connector.id,
          externalProvider: connector.capabilityProvider.providerName,
          externalId: file.externalId,
          displayName: file.displayName,
          fileName: file.fileName,
          fileUrl: file.webViewLink || '',
          mimeType: file.mimeType,
          versionToken: file.versionToken,
          category: 'other', // Default, logic can be smarter later
        },
        update: {
          displayName: file.displayName,
          fileName: file.fileName,
          fileUrl: file.webViewLink || '',
          mimeType: file.mimeType,
          versionToken: file.versionToken,
        },
      });
      created.push(asset);
    }

    await prisma.userConnector.update({
      where: { id: connector.id },
      data: { lastSyncAt: new Date(), lastSuccessAt: new Date(), errorMessage: null },
    });

    await this.logExecution(connector.id, 'storage.sync', CapabilityExecutionStatus.succeeded, {}, { count: files.length });

    return { success: true, count: files.length, assets: created };
  }

  async syncCalendar(userId: string) {
    const connector = await this.findConnectedConnector(userId, CapabilityType.calendar);
    if (!connector) {
      throw new BadRequestException('Connect Google Calendar before syncing.');
    }
    const provider = this.calendarProviderFor(connector.capabilityProvider.providerName);
    const credentials = this.parseCredentials(connector.connectorCredentials?.encryptedData);

    const events = await provider.listEvents(credentials);
    const created = [];

    for (const event of events) {
      const dbEvent = await prisma.calendarEvent.upsert({
        where: {
          userConnectorId_externalId: {
            userConnectorId: connector.id,
            externalId: event.externalId,
          },
        },
        create: {
          userId,
          userConnectorId: connector.id,
          externalId: event.externalId,
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          location: event.location,
          meetingUrl: event.meetingUrl,
          status: event.status,
          isAllDay: event.isAllDay,
          attendeesJson: this.toJson(event.attendees),
          syncMetadataJson: this.toJson({ providerName: connector.capabilityProvider.providerName }),
        },
        update: {
          title: event.title,
          description: event.description,
          startAt: event.startAt,
          endAt: event.endAt,
          timezone: event.timezone,
          location: event.location,
          meetingUrl: event.meetingUrl,
          status: event.status,
          isAllDay: event.isAllDay,
          attendeesJson: this.toJson(event.attendees),
        },
      });
      created.push(dbEvent);
    }

    await prisma.userConnector.update({
      where: { id: connector.id },
      data: { lastSyncAt: new Date(), lastSuccessAt: new Date(), errorMessage: null },
    });

    await this.logExecution(connector.id, 'calendar.sync', CapabilityExecutionStatus.succeeded, {}, { count: events.length });

    return { success: true, count: events.length, events: created };
  }

  async summarizeThread(userId: string, opportunityId: string) {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
      include: {
        company: true,
        primaryPerson: true,
        activities: { where: { activityType: ActivityType.email }, orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const inbound = opportunity.activities.filter((activity) => (activity.metadataJson as any)?.direction === 'inbound');
    const outbound = opportunity.activities.filter((activity) => (activity.metadataJson as any)?.direction !== 'inbound');
    const last = opportunity.activities.at(-1);
    return {
      opportunityId,
      companyName: opportunity.company.name,
      contactName: opportunity.primaryPerson?.fullName ?? null,
      messageCount: opportunity.activities.length,
      inboundCount: inbound.length,
      outboundCount: outbound.length,
      lastActivityAt: last?.occurredAt ?? null,
      summary:
        inbound.length > 0
          ? `A reply has been detected from ${opportunity.primaryPerson?.fullName ?? opportunity.company.name}. Review the latest inbound message and continue the conversation.`
          : 'No replies have been detected yet. Continue monitoring or create a follow-up when appropriate.',
      latestMessage: last
        ? {
            subject: last.subject,
            bodySummary: last.bodySummary,
            occurredAt: last.occurredAt,
            direction: (last.metadataJson as any)?.direction ?? 'outbound',
          }
        : null,
    };
  }

  private async linkReplies(userId: string, messages: SyncedEmailMessage[]) {
    const linked = [];
    for (const message of messages) {
      const person = message.fromEmail
        ? await prisma.person.findFirst({
            where: { userId, email: { equals: message.fromEmail, mode: 'insensitive' } },
            include: { primaryOpportunities: { orderBy: { updatedAt: 'desc' }, take: 1 } },
          })
        : null;
      const opportunity = person?.primaryOpportunities?.[0];
      if (!person || !opportunity) continue;

      const existing = await prisma.activity.findFirst({
        where: {
          userId,
          activityType: ActivityType.email,
          metadataJson: { path: ['providerMessageId'], equals: message.providerMessageId },
        },
      });
      if (existing) continue;

      const activity = await prisma.activity.create({
        data: {
          userId,
          opportunityId: opportunity.id,
          companyId: opportunity.companyId,
          personId: person.id,
          activityType: ActivityType.email,
          subject: message.subject,
          bodySummary: message.bodyPreview ?? message.snippet ?? 'Inbound email reply detected.',
          occurredAt: message.receivedAt,
          metadataJson: this.toJson({
            direction: 'inbound',
            providerMessageId: message.providerMessageId,
            providerThreadId: message.providerThreadId,
            replyDetected: true,
          }),
        },
      });

      await prisma.opportunity.update({
        where: { id: opportunity.id },
        data: {
          stage: 'conversation_started',
          nextAction: 'Review reply and continue the conversation.',
          nextActionDate: new Date(),
        },
      });
      linked.push(activity);
    }
    return linked;
  }

  private async ensureEmailProvider(providerName: 'gmail' | 'outlook') {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.email },
      create: {
        capabilityType: CapabilityType.email,
        name: 'Email',
        description: 'Send and sync email through connected providers.',
        supportedFeaturesJson: this.toJson(['send', 'sync', 'reply_detection', 'thread_summary']),
        workflowRoles: ['IDENTITY', 'SIGNAL', 'STRATEGIC', 'DAILY_ACTION', 'EXECUTION', 'VERIFICATION', 'MOMENTUM'],
      },
      update: {
        workflowRoles: ['IDENTITY', 'SIGNAL', 'STRATEGIC', 'DAILY_ACTION', 'EXECUTION', 'VERIFICATION', 'MOMENTUM'],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName: providerName === 'gmail' ? 'Gmail' : 'Outlook',
        description: providerName === 'gmail' ? 'Google Gmail integration' : 'Microsoft Outlook integration',
        authType: 'oauth2',
        requiredScopesJson: this.toJson(providerName === 'gmail'
          ? ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']
          : ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.Read']),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async ensureStorageProvider(providerName: 'google_drive' | 'onedrive' | 'dropbox') {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.storage },
      create: {
        capabilityType: CapabilityType.storage,
        name: 'Storage',
        description: 'Ingest strategic assets from cloud storage.',
        supportedFeaturesJson: this.toJson(['list', 'download', 'sync']),
        workflowRoles: ['IDENTITY', 'STRATEGIC'],
      },
      update: {
        workflowRoles: ['IDENTITY', 'STRATEGIC'],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName: 
          providerName === 'google_drive' ? 'Google Drive' : 
          providerName === 'onedrive' ? 'OneDrive' : 'Dropbox',
        description: 
          providerName === 'google_drive' ? 'Google Drive storage integration' : 
          providerName === 'onedrive' ? 'Microsoft OneDrive storage integration' : 'Dropbox storage integration',
        authType: 'oauth2',
        requiredScopesJson: this.toJson(
          providerName === 'google_drive' ? ['https://www.googleapis.com/auth/drive.readonly'] :
          providerName === 'onedrive' ? ['https://graph.microsoft.com/Files.Read'] : []
        ),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async ensureCalendarProvider(providerName: 'google_calendar' | 'outlook' | 'icloud') {
    const capability = await prisma.capability.upsert({
      where: { capabilityType: CapabilityType.calendar },
      create: {
        capabilityType: CapabilityType.calendar,
        name: 'Calendar',
        description: 'Sync meetings and availability.',
        supportedFeaturesJson: this.toJson(['list', 'sync']),
        workflowRoles: ['DAILY_ACTION', 'VERIFICATION'],
      },
      update: {
        workflowRoles: ['DAILY_ACTION', 'VERIFICATION'],
      },
    });
    const provider = await prisma.capabilityProvider.upsert({
      where: {
        capabilityId_providerName: {
          capabilityId: capability.id,
          providerName,
        },
      },
      create: {
        capabilityId: capability.id,
        providerName,
        displayName: 
          providerName === 'google_calendar' ? 'Google Calendar' : 
          providerName === 'outlook' ? 'Outlook Calendar' : 'iCloud Calendar',
        description: 
          providerName === 'google_calendar' ? 'Google Calendar integration' : 
          providerName === 'outlook' ? 'Microsoft Outlook Calendar integration' : 'Apple iCloud Calendar integration',
        authType: providerName === 'icloud' ? 'basic' : 'oauth2',
        requiredScopesJson: this.toJson(
          providerName === 'google_calendar' ? ['https://www.googleapis.com/auth/calendar.readonly'] :
          providerName === 'outlook' ? ['https://graph.microsoft.com/Calendars.Read'] : []
        ),
      },
      update: { isActive: true },
    });
    return { capability, provider };
  }

  private async findConnectedEmailConnector(userId: string) {
    return prisma.userConnector.findFirst({
      where: { userId, capability: { capabilityType: CapabilityType.email }, status: ConnectorStatus.connected },
      include: { capability: true, capabilityProvider: true, connectorCredentials: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async findConnector(userId: string, connectorId: string) {
    const connector = await prisma.userConnector.findFirst({
      where: { id: connectorId, userId },
      include: { capability: true, capabilityProvider: true, connectorCredentials: true },
    });
    if (!connector) {
      throw new NotFoundException('Connector not found');
    }
    return connector;
  }

  private emailProviderFor(providerName: string): EmailProvider {
    if (providerName === 'gmail') return this.gmailProvider;
    if (providerName === 'outlook') return this.outlookProvider;
    throw new BadRequestException(`Unsupported email provider: ${providerName}`);
  }

  private storageProviderFor(providerName: string): StorageProvider {
    if (providerName === 'google_drive') return this.googleDriveProvider;
    if (providerName === 'onedrive') return this.oneDriveProvider;
    if (providerName === 'dropbox') return this.dropboxProvider;
    throw new BadRequestException(`Unsupported storage provider: ${providerName}`);
  }

  private calendarProviderFor(providerName: string): CalendarProvider {
    if (providerName === 'google_calendar') return this.googleCalendarProvider;
    if (providerName === 'outlook') return this.outlookCalendarProvider;
    if (providerName === 'icloud') return this.icloudCalendarProvider;
    throw new BadRequestException(`Unsupported calendar provider: ${providerName}`);
  }

  private async findConnectedConnector(userId: string, capabilityType: CapabilityType) {
    return prisma.userConnector.findFirst({
      where: { userId, capability: { capabilityType }, status: ConnectorStatus.connected },
      include: { capability: true, capabilityProvider: true, connectorCredentials: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private parseCredentials(raw?: string | null) {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private jsonObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private microsoftRedirectUri() {
    const configured = this.configService.get<string>('API_PUBLIC_URL');
    const baseUrl = configured || 'http://localhost:3002';
    return `${baseUrl.replace(/\/$/, '')}/connectors/email/oauth/callback`;
  }

  private async exchangeMicrosoftCode(code: string, codeVerifier: string) {
    const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
    if (!clientId) {
      throw new Error('Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID first.');
    }
    const clientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET');
    const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID') || 'common';

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.microsoftRedirectUri(),
      code_verifier: codeVerifier,
    });
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const detail = payload?.['error_description'] ?? payload?.['error'] ?? `HTTP ${response.status}`;
      throw new Error(`Microsoft token exchange failed: ${detail}`);
    }
    return payload as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
  }

  private oauthResultHtml(input: {
    success: boolean;
    provider: 'outlook';
    emailAddress?: string;
    error?: string;
    returnTo?: string;
  }) {
    const payload = JSON.stringify({
      type: 'opportunity-os-oauth',
      provider: input.provider,
      success: input.success,
      emailAddress: input.emailAddress ?? null,
      error: input.error ?? null,
    });

    const title = input.success ? 'Connector connected' : 'Connector failed';
    const message = input.success
      ? `Outlook is now connected${input.emailAddress ? ` for ${input.emailAddress}` : ''}.`
      : input.error ?? 'The Outlook connection failed.';

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${this.escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f8fb; color: #1f2937; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      .card { background: white; border: 1px solid #dbe4f0; border-radius: 12px; padding: 24px; width: min(460px, calc(100vw - 32px)); box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0; line-height: 1.5; color: #475569; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${this.escapeHtml(title)}</h1>
      <p>${this.escapeHtml(message)}</p>
    </div>
    <script>
      (function () {
        var payload = ${payload};
        var targetOrigin = ${JSON.stringify(input.returnTo ?? '*')};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, targetOrigin);
          } else if (${JSON.stringify(Boolean(input.returnTo))}) {
            var returnUrl = new URL(${JSON.stringify(input.returnTo ?? '')});
            returnUrl.searchParams.set('oauthProvider', payload.provider);
            returnUrl.searchParams.set('oauthSuccess', payload.success ? 'true' : 'false');
            window.setTimeout(function () { window.location.replace(returnUrl.toString()); }, 900);
          }
        } catch (error) {}
        setTimeout(function () { window.close(); }, 600);
      }());
    </script>
  </body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private async logExecution(
    userConnectorId: string,
    executionType: string,
    executionStatus: CapabilityExecutionStatus,
    input: unknown,
    output: unknown,
    linkedEntityId?: string,
  ) {
    return prisma.capabilityExecutionLog.create({
      data: {
        userConnectorId,
        executionType,
        executionStatus,
        inputPayloadJson: this.toJson(input),
        outputPayloadJson: this.toJson(output),
        linkedEntityType: linkedEntityId ? 'opportunity' : undefined,
        linkedEntityId,
      },
    });
  }

  private toConnectorSummary(connector: any) {
    return {
      id: connector.id,
      connectorName: connector.connectorName,
      capabilityType: connector.capability?.capabilityType,
      providerName: connector.capabilityProvider?.providerName,
      providerDisplayName: connector.capabilityProvider?.displayName,
      status: connector.status,
      enabledFeatures: connector.enabledFeaturesJson ?? [],
      enabledRoles: connector.enabledRoles ?? [],
      supportedRoles: connector.capability?.workflowRoles ?? [],
      lastSyncAt: connector.lastSyncAt,
      lastSuccessAt: connector.lastSuccessAt,
      errorMessage: connector.errorMessage,
      metadata: connector.metadataJson ?? {},
      credential: connector.connectorCredentials
        ? {
            expiresAt: connector.connectorCredentials.expiresAt,
            lastRefreshedAt: connector.connectorCredentials.lastRefreshedAt,
            refreshStatus: connector.connectorCredentials.refreshStatus,
          }
        : null,
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }
}
