import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@opportunity-os/db';
import { ICapabilityProvider, ExecutionContext, RateLimitStatus } from '../interfaces';

@Injectable()
export class CapabilityService {
  private readonly logger = new Logger(CapabilityService.name);
  private providerRegistry = new Map<string, ICapabilityProvider>();
  private activeConnectors = new Map<string, any>();

  constructor(private readonly prisma: PrismaService) {}

  async registerProvider(provider: ICapabilityProvider): Promise<void> {
    const key = `${provider.capabilityType}:${provider.providerName}`;
    this.providerRegistry.set(key, provider);
    this.logger.log(`Registered provider: ${key}`);
  }

  async getProvider(capabilityType: string, providerName: string): Promise<ICapabilityProvider | null> {
    const key = `${capabilityType}:${providerName}`;
    return this.providerRegistry.get(key) || null;
  }

  async getProvidersByCapability(capabilityType: string): Promise<ICapabilityProvider[]> {
    const providers: ICapabilityProvider[] = [];
    
    for (const [key, provider] of this.providerRegistry.entries()) {
      if (provider.capabilityType === capabilityType) {
        providers.push(provider);
      }
    }
    
    return providers;
  }

  async getAllProviders(): Promise<ICapabilityProvider[]> {
    return Array.from(this.providerRegistry.values());
  }

  async getCapabilities(): Promise<any[]> {
    return await this.prisma.capability.findMany({
      where: { isActive: true },
      include: {
        capabilityProviders: {
          where: { isActive: true },
          orderBy: { displayName: 'asc' }
        }
      }
    });
  }

  async getCapability(capabilityType: string): Promise<any | null> {
    return await this.prisma.capability.findUnique({
      where: { 
        capabilityType,
        isActive: true 
      },
      include: {
        capabilityProviders: {
          where: { isActive: true },
          orderBy: { displayName: 'asc' }
        }
      }
    });
  }

  async executeCapability(
    userId: string,
    capabilityType: string,
    providerName: string,
    operation: string,
    parameters: any,
    context?: Partial<ExecutionContext>
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Get user's connector for this capability
      const connector = await this.getUserConnector(userId, capabilityType);
      if (!connector) {
        throw new NotFoundException(`No active connector found for capability: ${capabilityType}`);
      }

      // Get provider
      const provider = await this.getProvider(capabilityType, providerName);
      if (!provider) {
        throw new NotFoundException(`Provider not found: ${providerName}`);
      }

      // Create execution context
      const executionContext: ExecutionContext = {
        userId,
        connectorId: connector.id,
        requestId: this.generateRequestId(),
        correlationId: context?.correlationId,
        startTime: new Date(),
        metadata: context?.metadata
      };

      // Check rate limits
      await this.checkRateLimits(provider, userId);

      // Execute the operation
      const result = await provider.execute(operation, parameters, executionContext);

      // Log execution
      await this.logExecution(executionContext, operation, parameters, result, 'succeeded', Date.now() - startTime);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.logExecution(
        { userId, connectorId: '', requestId: '', startTime: new Date() },
        operation,
        parameters,
        null,
        'failed',
        duration,
        error.message
      );
      
      this.logger.error(`Capability execution failed:`, error);
      throw error;
    }
  }

  async getUserConnector(userId: string, capabilityType: string): Promise<any> {
    return await this.prisma.userConnector.findFirst({
      where: {
        userId,
        capability: {
          capabilityType,
          isActive: true
        },
        status: 'connected'
      },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: true
      }
    });
  }

  async getUserConnectors(userId: string): Promise<any[]> {
    return await this.prisma.userConnector.findMany({
      where: { userId },
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: true,
        connectorSyncStates: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createConnector(userId: string, capabilityType: string, providerName: string, config: any): Promise<any> {
    // Get capability and provider
    const capability = await this.getCapability(capabilityType);
    const provider = await this.getProvider(capabilityType, providerName);

    if (!capability || !provider) {
      throw new NotFoundException('Capability or provider not found');
    }

    // Create connector
    const connector = await this.prisma.userConnector.create({
      data: {
        userId,
        capabilityId: capability.id,
        capabilityProviderId: (provider as any).id,
        connectorName: `${provider.displayName} Connector`,
        status: 'pending_setup',
        enabledFeaturesJson: provider.rateLimits,
        metadataJson: config
      },
      include: {
        capability: true,
        capabilityProvider: true
      }
    });

    this.logger.log(`Created connector: ${connector.id} for user: ${userId}`);
    return connector;
  }

  async updateConnector(connectorId: string, updates: any): Promise<any> {
    const connector = await this.prisma.userConnector.update({
      where: { id: connectorId },
      data: updates,
      include: {
        capability: true,
        capabilityProvider: true,
        connectorCredentials: true
      }
    });

    this.logger.log(`Updated connector: ${connectorId}`);
    return connector;
  }

  async deleteConnector(connectorId: string): Promise<void> {
    await this.prisma.userConnector.delete({
      where: { id: connectorId }
    });

    this.logger.log(`Deleted connector: ${connectorId}`);
  }

  async testConnector(connectorId: string): Promise<any> {
    const connector = await this.prisma.userConnector.findUnique({
      where: { id: connectorId },
      include: {
        capabilityProvider: true,
        connectorCredentials: true
      }
    });

    if (!connector) {
      throw new NotFoundException('Connector not found');
    }

    // Get provider and test connection
    const provider = await this.getProvider(
      connector.capability.capabilityType,
      connector.capabilityProvider.providerName
    );

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Initialize provider with credentials
    const credentials = connector.connectorCredentials?.encryptedData;
    if (credentials) {
      await provider.initialize(connector.capabilityProvider);
      await provider.connect(credentials);
    }

    const testResult = await provider.testConnection();
    
    // Update connector status
    await this.updateConnector(connectorId, {
      status: testResult.success ? 'connected' : 'error',
      lastSuccessAt: testResult.success ? new Date() : undefined,
      errorMessage: testResult.success ? undefined : testResult.message
    });

    return testResult;
  }

  async syncConnector(connectorId: string, options?: any): Promise<any> {
    const connector = await this.prisma.userConnector.findUnique({
      where: { id: connectorId },
      include: {
        capabilityProvider: true,
        connectorCredentials: true
      }
    });

    if (!connector) {
      throw new NotFoundException('Connector not found');
    }

    const provider = await this.getProvider(
      connector.capability.capabilityType,
      connector.capabilityProvider.providerName
    );

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    // Update status to syncing
    await this.updateConnector(connectorId, { status: 'syncing' });

    try {
      const credentials = connector.connectorCredentials?.encryptedData;
      if (credentials) {
        await provider.initialize(connector.capabilityProvider);
        await provider.connect(credentials);
      }

      const syncResult = await provider.sync(undefined, options);

      // Update sync state
      await this.prisma.connectorSyncState.upsert({
        where: {
          userConnectorId_connectorId: {
            userConnectorId: connectorId,
            syncType: 'full'
          }
        },
        update: {
          syncStatus: syncResult.success ? 'completed' : 'error',
          lastSyncAt: new Date(),
          itemsSynced: syncResult.itemsProcessed,
          errorDetailsJson: syncResult.errors ? { errors: syncResult.errors } : null
        },
        create: {
          userConnectorId: connectorId,
          syncType: 'full',
          syncStatus: syncResult.success ? 'completed' : 'error',
          lastSyncAt: new Date(),
          itemsSynced: syncResult.itemsProcessed,
          errorDetailsJson: syncResult.errors ? { errors: syncResult.errors } : null
        }
      });

      // Update connector status
      await this.updateConnector(connectorId, {
        status: syncResult.success ? 'connected' : 'error',
        lastSyncAt: new Date(),
        lastSuccessAt: syncResult.success ? new Date() : undefined,
        errorMessage: syncResult.success ? undefined : syncResult.errors?.join(', ')
      });

      return syncResult;
    } catch (error) {
      await this.updateConnector(connectorId, {
        status: 'error',
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  private async checkRateLimits(provider: ICapabilityProvider, userId: string): Promise<void> {
    const status = await provider.checkRateLimit();
    if (status.isLimited) {
      throw new Error(`Rate limit exceeded. Retry after: ${status.resetTime}`);
    }
  }

  private async logExecution(
    context: ExecutionContext,
    operation: string,
    parameters: any,
    result: any,
    status: string,
    duration: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.prisma.capabilityExecutionLog.create({
        data: {
          userConnectorId: context.connectorId,
          executionType: operation,
          executionStatus: status as any,
          inputPayloadJson: parameters,
          outputPayloadJson: result,
          durationMs: duration,
          linkedEntityType: context.metadata?.linkedEntityType,
          linkedEntityId: context.metadata?.linkedEntityId,
          errorDetailsJson: errorMessage ? { error: errorMessage } : null
        }
      });
    } catch (logError) {
      this.logger.error('Failed to log execution:', logError);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
