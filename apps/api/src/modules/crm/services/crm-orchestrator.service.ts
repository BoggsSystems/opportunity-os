import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { prisma, Person, Opportunity, Activity } from '@opportunity-os/db';
import { MappingEngine } from './mapping-engine.service';
import { CrmProvider } from '../interfaces/crm-provider.interface';
import { HubspotProvider } from '../providers/hubspot.provider';
import { SalesforceProvider } from '../providers/salesforce.provider';

@Injectable()
export class CrmOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(CrmOrchestrator.name);
  private providers: Map<string, CrmProvider> = new Map();

  constructor(
    private readonly mappingEngine: MappingEngine,
    private readonly hubspotProvider: HubspotProvider,
    private readonly salesforceProvider: SalesforceProvider,
  ) {}

  onModuleInit() {
    this.registerProvider(this.hubspotProvider);
    this.registerProvider(this.salesforceProvider);
  }

  /**
   * Registers a CRM provider implementation.
   */
  registerProvider(provider: CrmProvider) {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered CRM provider: ${provider.name}`);
  }

  /**
   * Syncs a person to all active CRM connectors for the user.
   */
  async syncPerson(userId: string, person: Person): Promise<void> {
    const activeConnectors = await this.getActiveConnectorsForUser(userId);
    
    for (const connector of activeConnectors) {
      const provider = this.providers.get(connector.providerName);
      if (!provider) {
        this.logger.warn(`Provider ${connector.providerName} not found or not registered.`);
        continue;
      }

      try {
        const remoteId = await provider.upsertContact(person, connector.credentials);
        await this.mappingEngine.setRemoteMapping(userId, {
          localEntityType: 'Person',
          localEntityId: person.id,
          remoteProvider: connector.providerName,
          remoteEntityId: remoteId,
        });
      } catch (error) {
        this.logger.error(`Failed to sync person ${person.id} to ${connector.providerName}:`, error);
      }
    }
  }

  /**
   * Syncs an opportunity to all active CRM connectors for the user.
   */
  async syncOpportunity(userId: string, opportunity: Opportunity): Promise<void> {
    const activeConnectors = await this.getActiveConnectorsForUser(userId);

    for (const connector of activeConnectors) {
      const provider = this.providers.get(connector.providerName);
      if (!provider) continue;

      try {
        const remoteId = await provider.createDeal(opportunity, connector.credentials);
        await this.mappingEngine.setRemoteMapping(userId, {
          localEntityType: 'Opportunity',
          localEntityId: opportunity.id,
          remoteProvider: connector.providerName,
          remoteEntityId: remoteId,
        });
      } catch (error) {
        this.logger.error(`Failed to sync opportunity ${opportunity.id} to ${connector.providerName}:`, error);
      }
    }
  }

  /**
   * Pushes an activity/message to all active CRM connectors for the user.
   */
  async syncActivity(userId: string, activity: Activity): Promise<void> {
    const activeConnectors = await this.getActiveConnectorsForUser(userId);

    for (const connector of activeConnectors) {
      const provider = this.providers.get(connector.providerName);
      if (!provider) continue;

      try {
        await provider.pushMessage(activity, connector.credentials);
      } catch (error) {
        this.logger.error(`Failed to push activity ${activity.id} to ${connector.providerName}:`, error);
      }
    }
  }

  /**
   * Retrieves the list of active CRM connectors and their credentials for a user.
   */
  private async getActiveConnectorsForUser(userId: string) {
    const connectors = await prisma.userConnector.findMany({
      where: {
        userId,
        status: 'connected',
        capabilityProvider: {
          capabilityType: 'crm',
        },
      },
      include: {
        capabilityProvider: true,
        connectorCredentials: true,
      },
    });

    return connectors.map((c) => ({
      providerName: c.capabilityProvider.providerName,
      credentials: this.parseCredentials(c.connectorCredentials?.encryptedData),
    }));
  }

  private parseCredentials(data?: string | null): any {
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
}
