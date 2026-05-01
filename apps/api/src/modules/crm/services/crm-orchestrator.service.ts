import { Injectable, Logger } from '@nestjs/common';
import { prisma, Person, Opportunity, Activity } from '@opportunity-os/db';
import { MappingEngine } from './mapping-engine.service';
import { CrmProvider } from '../interfaces/crm-provider.interface';

@Injectable()
export class CrmOrchestrator {
  private readonly logger = new Logger(CrmOrchestrator.name);
  private providers: Map<string, CrmProvider> = new Map();

  constructor(private readonly mappingEngine: MappingEngine) {}

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
    const activeProviders = await this.getActiveProvidersForUser(userId);
    
    for (const providerName of activeProviders) {
      const provider = this.providers.get(providerName);
      if (!provider) {
        this.logger.warn(`Provider ${providerName} not found or not registered.`);
        continue;
      }

      try {
        const remoteId = await provider.upsertContact(person);
        await this.mappingEngine.setRemoteMapping(userId, {
          localEntityType: 'Person',
          localEntityId: person.id,
          remoteProvider: providerName,
          remoteEntityId: remoteId,
        });
      } catch (error) {
        this.logger.error(`Failed to sync person ${person.id} to ${providerName}:`, error);
      }
    }
  }

  /**
   * Syncs an opportunity to all active CRM connectors for the user.
   */
  async syncOpportunity(userId: string, opportunity: Opportunity): Promise<void> {
    const activeProviders = await this.getActiveProvidersForUser(userId);

    for (const providerName of activeProviders) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        const remoteId = await provider.createDeal(opportunity);
        await this.mappingEngine.setRemoteMapping(userId, {
          localEntityType: 'Opportunity',
          localEntityId: opportunity.id,
          remoteProvider: providerName,
          remoteEntityId: remoteId,
        });
      } catch (error) {
        this.logger.error(`Failed to sync opportunity ${opportunity.id} to ${providerName}:`, error);
      }
    }
  }

  /**
   * Pushes an activity/message to all active CRM connectors for the user.
   */
  async syncActivity(userId: string, activity: Activity): Promise<void> {
    const activeProviders = await this.getActiveProvidersForUser(userId);

    for (const providerName of activeProviders) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        await provider.pushMessage(activity);
      } catch (error) {
        this.logger.error(`Failed to push activity ${activity.id} to ${providerName}:`, error);
      }
    }
  }

  /**
   * Retrieves the list of active CRM provider names for a user.
   */
  private async getActiveProvidersForUser(userId: string): Promise<string[]> {
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
      },
    });

    return connectors.map((c) => c.capabilityProvider.providerName);
  }
}
