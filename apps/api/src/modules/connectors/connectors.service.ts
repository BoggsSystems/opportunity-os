import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  CapabilityExecutionStatus,
  CapabilityType,
  ConnectorStatus,
  Prisma,
  prisma,
} from '@opportunity-os/db';
import { SetupEmailConnectorDto } from './dto/setup-email-connector.dto';
import { EmailProvider, EmailSendInput, SyncedEmailMessage } from './email/email-provider.interface';
import { GmailEmailProvider } from './email/gmail-email.provider';
import { OutlookEmailProvider } from './email/outlook-email.provider';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly gmailProvider: GmailEmailProvider,
    private readonly outlookProvider: OutlookEmailProvider,
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
        metadataJson: this.toJson({ emailAddress: dto.emailAddress }),
      },
      update: {
        capabilityProviderId: provider.id,
        connectorName: dto.connectorName?.trim() || provider.displayName,
        status: dto.accessToken ? ConnectorStatus.connected : ConnectorStatus.pending_setup,
        enabledFeaturesJson: this.toJson(['send', 'sync', 'reply_detection', 'thread_summary']),
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
      },
      update: {},
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

  private parseCredentials(raw?: string | null) {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
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
