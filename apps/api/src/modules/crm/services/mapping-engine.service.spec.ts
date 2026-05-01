jest.mock('@opportunity-os/db', () => ({
  prisma: {
    externalMapping: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { MappingEngine } from './mapping-engine.service';
import { prisma } from '@opportunity-os/db';

describe('MappingEngine', () => {
  let service: MappingEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MappingEngine],
    }).compile();

    service = module.get<MappingEngine>(MappingEngine);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRemoteId', () => {
    it('should return remoteId if mapping exists', async () => {
      const mockMapping = { remoteEntityId: 'remote-123' };
      (prisma.externalMapping.findUnique as jest.Mock).mockResolvedValue(mockMapping);

      const result = await service.getRemoteId('user-1', 'Person', 'local-1', 'hubspot');

      expect(prisma.externalMapping.findUnique).toHaveBeenCalledWith({
        where: {
          userId_localEntityType_localEntityId_remoteProvider: {
            userId: 'user-1',
            localEntityType: 'Person',
            localEntityId: 'local-1',
            remoteProvider: 'hubspot',
          },
        },
      });
      expect(result).toBe('remote-123');
    });

    it('should return null if mapping does not exist', async () => {
      (prisma.externalMapping.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getRemoteId('user-1', 'Person', 'local-1', 'hubspot');

      expect(result).toBeNull();
    });
  });

  describe('setRemoteMapping', () => {
    it('should upsert mapping', async () => {
      const mockMapping = { id: 'mapping-1', remoteEntityId: 'remote-123' };
      (prisma.externalMapping.upsert as jest.Mock).mockResolvedValue(mockMapping);

      const result = await service.setRemoteMapping('user-1', {
        localEntityType: 'Person',
        localEntityId: 'local-1',
        remoteProvider: 'hubspot',
        remoteEntityId: 'remote-123',
        remoteUrl: 'https://hubspot.com/123',
      });

      expect(prisma.externalMapping.upsert).toHaveBeenCalled();
      expect(result).toEqual(mockMapping);
    });
  });
});
