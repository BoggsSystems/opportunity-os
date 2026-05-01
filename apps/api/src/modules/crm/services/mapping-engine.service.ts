import { Injectable, Logger } from '@nestjs/common';
import { prisma, ExternalMapping, Prisma } from '@opportunity-os/db';

@Injectable()
export class MappingEngine {
  private readonly logger = new Logger(MappingEngine.name);

  /**
   * Retrieves the remote ID for a given local entity and provider.
   */
  async getRemoteId(
    userId: string,
    localEntityType: string,
    localEntityId: string,
    remoteProvider: string,
  ): Promise<string | null> {
    const mapping = await prisma.externalMapping.findUnique({
      where: {
        userId_localEntityType_localEntityId_remoteProvider: {
          userId,
          localEntityType,
          localEntityId,
          remoteProvider,
        },
      },
    });

    return mapping?.remoteEntityId || null;
  }

  /**
   * Stores or updates a mapping between a local entity and a remote CRM record.
   */
  async setRemoteMapping(
    userId: string,
    params: {
      localEntityType: string;
      localEntityId: string;
      remoteProvider: string;
      remoteEntityId: string;
      remoteUrl?: string;
      metadata?: any;
    },
  ): Promise<ExternalMapping> {
    const {
      localEntityType,
      localEntityId,
      remoteProvider,
      remoteEntityId,
      remoteUrl,
      metadata,
    } = params;

    return prisma.externalMapping.upsert({
      where: {
        userId_localEntityType_localEntityId_remoteProvider: {
          userId,
          localEntityType,
          localEntityId,
          remoteProvider,
        },
      },
      update: {
        remoteEntityId,
        remoteUrl,
        metadataJson: metadata as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      },
      create: {
        userId,
        localEntityType,
        localEntityId,
        remoteProvider,
        remoteEntityId,
        remoteUrl,
        metadataJson: metadata as Prisma.InputJsonValue,
        syncStatus: 'synced',
      },
    });
  }

  /**
   * Marks a mapping as failed or stale.
   */
  async updateSyncStatus(
    userId: string,
    localEntityType: string,
    localEntityId: string,
    remoteProvider: string,
    status: 'failed' | 'stale' | 'synced',
  ): Promise<void> {
    await prisma.externalMapping.update({
      where: {
        userId_localEntityType_localEntityId_remoteProvider: {
          userId,
          localEntityType,
          localEntityId,
          remoteProvider,
        },
      },
      data: {
        syncStatus: status,
        lastSyncedAt: new Date(),
      },
    });
  }
}
