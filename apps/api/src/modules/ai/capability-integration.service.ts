import { Injectable, Logger } from '@nestjs/common';
import { CapabilityService } from '../../capability/services/capability.service';
import { IEmailProvider } from '../../capability/interfaces/email-capability.interface';

@Injectable()
export class CapabilityIntegrationService {
  private readonly logger = new Logger(CapabilityIntegrationService.name);

  constructor(private readonly capabilityService: CapabilityService) {}

  async sendEmail(userId: string, message: any): Promise<any> {
    try {
      // Get user's email connector
      const connector = await this.capabilityService.getUserConnector(userId, 'email');
      if (!connector) {
        throw new Error('No email connector configured');
      }

      // Get provider and execute send operation
      const result = await this.capabilityService.executeCapability(
        userId,
        'email',
        connector.capabilityProvider.providerName,
        'send',
        { message },
        { linkedEntityType: 'opportunity', linkedEntityId: message.opportunityId }
      );

      this.logger.log(`Email sent successfully via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async searchEmails(userId: string, params: any): Promise<any[]> {
    try {
      const connector = await this.capabilityService.getUserConnector(userId, 'email');
      if (!connector) {
        throw new Error('No email connector configured');
      }

      const result = await this.capabilityService.executeCapability(
        userId,
        'email',
        connector.capabilityProvider.providerName,
        'search',
        params
      );

      this.logger.log(`Email search completed via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to search emails:', error);
      throw error;
    }
  }

  async syncEmails(userId: string): Promise<any> {
    try {
      const connector = await this.capabilityService.getUserConnector(userId, 'email');
      if (!connector) {
        throw new Error('No email connector configured');
      }

      const result = await this.capabilityService.syncConnector(connector.id, {
        fullSync: false,
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          end: new Date()
        }
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
      const connector = await this.capabilityService.getUserConnector(userId, 'calendar');
      if (!connector) {
        throw new Error('No calendar connector configured');
      }

      const result = await this.capabilityService.executeCapability(
        userId,
        'calendar',
        connector.capabilityProvider.providerName,
        'create',
        { event }
      );

      this.logger.log(`Calendar event created via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async getCalendarEvents(userId: string, params: any): Promise<any[]> {
    try {
      const connector = await this.capabilityService.getUserConnector(userId, 'calendar');
      if (!connector) {
        throw new Error('No calendar connector configured');
      }

      const result = await this.capabilityService.executeCapability(
        userId,
        'calendar',
        connector.capabilityProvider.providerName,
        'list',
        params
      );

      this.logger.log(`Calendar events retrieved via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to get calendar events:', error);
      throw error;
    }
  }

  async sendMessage(userId: string, message: any): Promise<any> {
    try {
      const connector = await this.capabilityService.getUserConnector(userId, 'messaging');
      if (!connector) {
        throw new Error('No messaging connector configured');
      }

      const result = await this.capabilityService.executeCapability(
        userId,
        'messaging',
        connector.capabilityProvider.providerName,
        'send',
        { message }
      );

      this.logger.log(`Message sent via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async discoverContent(userId: string, url: string): Promise<any> {
    try {
      const connector = await this.capabilityService.getUserConnector(userId, 'discovery');
      if (!connector) {
        throw new Error('No discovery connector configured');
      }

      const result = await this.capabilityService.executeCapability(
        userId,
        'discovery',
        connector.capabilityProvider.providerName,
        'crawl',
        { url }
      );

      this.logger.log(`Content discovered via ${connector.capabilityProvider.providerName}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to discover content:', error);
      throw error;
    }
  }

  async getUserConnectors(userId: string): Promise<any[]> {
    try {
      const connectors = await this.capabilityService.getUserConnectors(userId);
      
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
      const connector = await this.capabilityService.createConnector(userId, capabilityType, providerName, config);
      
      this.logger.log(`Created ${capabilityType} connector with ${providerName}`);
      return connector;
    } catch (error) {
      this.logger.error('Failed to create connector:', error);
      throw error;
    }
  }

  async testConnector(userId: string, connectorId: string): Promise<any> {
    try {
      const result = await this.capabilityService.testConnector(connectorId);
      
      this.logger.log(`Connector test completed for ${connectorId}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to test connector:', error);
      throw error;
    }
  }
}
