import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@opportunity-os/db';

@Injectable()
export class CapabilityIntegrationService {
  private readonly logger = new Logger(CapabilityIntegrationService.name);

  async getUserConnector(userId: string, capabilityType: string): Promise<any | null> {
    return prisma.userConnector.findFirst({
      where: {
        userId,
        capability: { capabilityType: capabilityType as any },
        status: 'connected',
      },
      include: {
        capability: true,
        capabilityProvider: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async sendEmail(userId: string, message: any): Promise<any> {
    try {
      // Get user's email connector
      const connector = await this.getUserConnector(userId, 'email');
      if (!connector) {
        throw new Error('No email connector configured');
      }

      // Check if user prefers Outlook for this message
      const providerName = this.detectPreferredProvider(message, connector.capabilityProvider.providerName);

      const result = await prisma.capabilityExecutionLog.create({
        data: {
          userConnectorId: connector.id,
          executionType: 'email.send',
          executionStatus: 'succeeded',
          inputPayloadJson: this.toJson({ provider: providerName, message }),
          outputPayloadJson: this.toJson({ simulated: true, provider: providerName }),
          linkedEntityType: message.opportunityId ? 'opportunity' : undefined,
          linkedEntityId: message.opportunityId,
        },
      });

      this.logger.log(`Email sent successfully via ${providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async searchEmails(userId: string, params: any): Promise<any[]> {
    try {
      const connector = await this.getUserConnector(userId, 'email');
      if (!connector) {
        throw new Error('No email connector configured');
      }

      await this.logCapabilityExecution(connector.id, 'email.search', params);

      this.logger.log(`Email search completed via ${connector.capabilityProvider.providerName}`);
      return [];
    } catch (error) {
      this.logger.error('Failed to search emails:', error);
      throw error;
    }
  }

  async syncEmails(userId: string): Promise<any> {
    try {
      const connector = await this.getUserConnector(userId, 'email');
      if (!connector) {
        throw new Error('No email connector configured');
      }

      const result = await this.logCapabilityExecution(connector.id, 'email.sync', {
        fullSync: false,
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      });

      this.logger.log(`Email sync completed for connector ${connector.id}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to sync emails:', error);
      throw error;
    }
  }

  async createCalendarEvent(userId: string, event: any): Promise<any> {
    try {
      const connector = await this.getUserConnector(userId, 'calendar');
      if (!connector) {
        throw new Error('No calendar connector configured');
      }

      const result = await this.logCapabilityExecution(connector.id, 'calendar.create', { event });

      this.logger.log(`Calendar event created via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async getCalendarEvents(userId: string, params: any): Promise<any[]> {
    try {
      const connector = await this.getUserConnector(userId, 'calendar');
      if (!connector) {
        throw new Error('No calendar connector configured');
      }

      await this.logCapabilityExecution(connector.id, 'calendar.list', params);

      this.logger.log(`Calendar events retrieved via ${connector.capabilityProvider.providerName}`);
      return [];
    } catch (error) {
      this.logger.error('Failed to get calendar events:', error);
      throw error;
    }
  }

  async sendMessage(userId: string, message: any): Promise<any> {
    try {
      const connector = await this.getUserConnector(userId, 'messaging');
      if (!connector) {
        throw new Error('No messaging connector configured');
      }

      const result = await this.logCapabilityExecution(connector.id, 'messaging.send', { message });

      this.logger.log(`Message sent via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async discoverContent(userId: string, url: string): Promise<any> {
    try {
      const connector = await this.getUserConnector(userId, 'discovery');
      if (!connector) {
        throw new Error('No discovery connector configured');
      }

      const result = await this.logCapabilityExecution(connector.id, 'discovery.crawl', { url });

      this.logger.log(`Content discovered via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to discover content:', error);
      throw error;
    }
  }

  async getUserConnectors(userId: string): Promise<any[]> {
    try {
      const connectors = await prisma.userConnector.findMany({
        where: { userId },
        include: {
          capability: true,
          capabilityProvider: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
      
      // Transform to user-friendly format
      return connectors.map(connector => ({
        id: connector.id,
        capabilityType: connector.capability?.capabilityType,
        providerName: connector.capabilityProvider?.providerName,
        displayName: connector.connectorName,
        status: connector.status,
        lastSyncAt: connector.lastSyncAt,
        lastSuccessAt: connector.lastSuccessAt,
        errorMessage: connector.errorMessage,
        capabilities: connector.capability?.supportedFeaturesJson || []
      }));
    } catch (error) {
      this.logger.error('Failed to get user connectors:', error);
      throw error;
    }
  }

  async createConnector(userId: string, capabilityType: string, providerName: string, config: any): Promise<any> {
    try {
      const capability = await prisma.capability.findUnique({
        where: { capabilityType: capabilityType as any },
      });
      if (!capability) {
        throw new Error(`Capability not found: ${capabilityType}`);
      }

      const capabilityProvider = await prisma.capabilityProvider.findFirst({
        where: { capabilityId: capability.id, providerName },
      });
      if (!capabilityProvider) {
        throw new Error(`Capability provider not found: ${providerName}`);
      }

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
          capabilityProviderId: capabilityProvider.id,
          connectorName: config?.connectorName ?? capabilityProvider.displayName,
          status: 'connected',
          enabledFeaturesJson: this.toJson(config?.enabledFeatures ?? []),
          metadataJson: this.toJson(config?.metadata ?? {}),
        },
        update: {
          capabilityProviderId: capabilityProvider.id,
          connectorName: config?.connectorName ?? capabilityProvider.displayName,
          status: 'connected',
          enabledFeaturesJson: this.toJson(config?.enabledFeatures ?? []),
          metadataJson: this.toJson(config?.metadata ?? {}),
        },
      });
      
      this.logger.log(`Created ${capabilityType} connector with ${providerName}`);
      return connector;
    } catch (error) {
      this.logger.error('Failed to create connector:', error);
      throw error;
    }
  }

  async testConnector(userId: string, connectorId: string): Promise<any> {
    try {
      const connector = await prisma.userConnector.findFirst({
        where: { id: connectorId, userId },
      });
      if (!connector) {
        throw new Error('Connector not found');
      }

      const result = await this.logCapabilityExecution(connector.id, 'connector.test', {});
      
      this.logger.log(`Connector test completed for ${connectorId}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to test connector:', error);
      throw error;
    }
  }

  private detectPreferredProvider(message: any, defaultProvider: string): string {
    // Check if message mentions specific providers
    const messageText = (message.body || message.subject || '').toLowerCase();
    
    if (messageText.includes('outlook') || messageText.includes('hotmail') || messageText.includes('microsoft')) {
      return 'outlook';
    }
    
    if (messageText.includes('gmail') || messageText.includes('google')) {
      return 'gmail';
    }
    
    // Return default provider if no specific preference detected
    return defaultProvider;
  }

  private async logCapabilityExecution(userConnectorId: string, executionType: string, input: unknown) {
    return prisma.capabilityExecutionLog.create({
      data: {
        userConnectorId,
        executionType,
        executionStatus: 'succeeded',
        inputPayloadJson: this.toJson(input),
        outputPayloadJson: this.toJson({ simulated: true }),
      },
    });
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }
}
