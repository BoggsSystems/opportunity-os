import { Injectable, Logger } from '@nestjs/common';
import { prisma, ConceptCategory, ConceptSourceType } from '@opportunity-os/db';
import { AiService } from '../ai/ai.service';
import { ConnectorsService } from '../connectors/connectors.service';

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly connectorsService: ConnectorsService,
  ) {}

  async createConcept(userId: string, data: {
    title: string;
    description: string;
    category: ConceptCategory;
    sourceType: ConceptSourceType;
    sourceId: string;
    metadata?: any;
  }) {
    this.logger.log(`Creating concept for user ${userId}: ${data.title}`);

    return prisma.$transaction(async (tx) => {
      const concept = await tx.concept.create({
        data: {
          userId,
          title: data.title,
          description: data.description,
          category: data.category,
          metadataJson: data.metadata,
        },
      });

      await tx.intelligenceSource.create({
        data: {
          targetId: concept.id,
          targetType: 'concept',
          sourceType: data.sourceType,
          sourceId: data.sourceId,
        },
      });

      return concept;
    });
  }

  async createProofPoint(userId: string, data: {
    title: string;
    content: string;
    sourceType: ConceptSourceType;
    sourceId: string;
  }) {
    this.logger.log(`Creating proof point for user ${userId}: ${data.title}`);

    return prisma.$transaction(async (tx) => {
      const proofPoint = await tx.proofPoint.create({
        data: {
          userId,
          title: data.title,
          content: data.content,
        },
      });

      await tx.intelligenceSource.create({
        data: {
          targetId: proofPoint.id,
          targetType: 'proof_point',
          sourceType: data.sourceType,
          sourceId: data.sourceId,
        },
      });

      return proofPoint;
    });
  }

  async getVault(userId: string) {
    const concepts = await prisma.concept.findMany({
      where: { userId },
      include: {
        sources: true,
        proofLinks: {
          include: { proofPoint: true }
        }
      }
    });

    const proofPoints = await prisma.proofPoint.findMany({
      where: { userId },
      include: {
        sources: true
      }
    });

    return { concepts, proofPoints };
  }

  /**
   * THE SHREDDER: Extracts concepts and proof points from raw text
   */
  async shredText(userId: string, text: string, source: { type: ConceptSourceType; id: string }) {
    this.logger.log(`Shredding text for user ${userId} from source ${source.type}:${source.id}`);
    
    // 1. Identify Concepts
    const extracted = await this.aiService.extractStrategicIntelligence(text);
    
    const results = {
      concepts: [] as any[],
      proofPoints: [] as any[],
    };

    // 2. Persist Concepts
    for (const c of extracted.concepts) {
      const concept = await this.createConcept(userId, {
        title: c.title,
        description: c.description,
        category: c.category as ConceptCategory,
        sourceType: source.type,
        sourceId: source.id,
        metadata: c.metadata
      });
      results.concepts.push(concept);
    }

    // 3. Persist Proof Points
    for (const p of extracted.proofPoints) {
      const proofPoint = await this.createProofPoint(userId, {
        title: p.title,
        content: p.content,
        sourceType: source.type,
        sourceId: source.id,
      });
      results.proofPoints.push(proofPoint);
    }

    return results;
  }

  /**
   * BULK SHREDDER: Downloads and shreds multiple assets
   */
  async shredAssets(
    userId: string,
    assetIds: string[],
    sourceType: ConceptSourceType,
    providerName?: string,
    connectorId?: string,
  ) {
    this.logger.log(`Bulk shredding ${assetIds.length} assets for user ${userId}`);
    
    const allFindings = { concepts: [], proofPoints: [] };
    const results = [];
    const batch = await prisma.assetIngestionBatch.create({
      data: {
        userId,
        userConnectorId: connectorId ?? null,
        sourceType,
        status: 'running',
        providerName: providerName ?? null,
        requestedAssetCount: assetIds.length,
        startedAt: new Date(),
      },
    });

    await prisma.assetIngestionItem.createMany({
      data: assetIds.map((id) => ({
        batchId: batch.id,
        userId,
        externalId: id,
        status: 'queued',
      })),
    });
    
    for (const id of assetIds) {
      try {
        await prisma.assetIngestionItem.updateMany({
          where: { batchId: batch.id, externalId: id },
          data: { status: 'processing' },
        });
        const { buffer } = await this.connectorsService.downloadFile(userId, id);
        const text = buffer.toString('utf8').substring(0, 15000); 
        
        const shredResult = await this.shredText(userId, text, { type: sourceType, id });
        
        allFindings.concepts.push(...shredResult.concepts);
        allFindings.proofPoints.push(...shredResult.proofPoints);
        
        results.push({ id, status: 'success', ...shredResult });
        await prisma.assetIngestionItem.updateMany({
          where: { batchId: batch.id, externalId: id },
          data: {
            status: 'imported',
            conceptCount: shredResult.concepts.length,
            proofPointCount: shredResult.proofPoints.length,
            importedAt: new Date(),
          },
        });
      } catch (e: any) {
        this.logger.error(`Failed to shred asset ${id}`, e);
        results.push({ id, status: 'failed', error: e.message });
        await prisma.assetIngestionItem.updateMany({
          where: { batchId: batch.id, externalId: id },
          data: {
            status: 'failed',
            errorMessage: e.message ?? 'Unknown ingestion error',
          },
        });
      }
    }

    let summary = "Assets ingested. No specific strategic concepts were extracted.";
    if (allFindings.concepts.length > 0 || allFindings.proofPoints.length > 0) {
      summary = await this.aiService.summarizeStrategicFindings(allFindings);
    }

    const importedCount = results.filter((r: any) => r.status === 'success').length;
    const failedCount = results.length - importedCount;
    await prisma.assetIngestionBatch.update({
      where: { id: batch.id },
      data: {
        status: failedCount === 0 ? 'completed' : importedCount > 0 ? 'partial' : 'failed',
        importedCount,
        failedCount,
        summary,
        completedAt: new Date(),
      },
    });

    return { batchId: batch.id, results, summary };
  }

  async linkConceptToProof(conceptId: string, proofPointId: string) {
    return prisma.conceptProofLink.create({
      data: {
        conceptId,
        proofPointId,
      },
    });
  }

  /**
   * COGNITIVE HARVESTING: Extracts intelligence from a conversation thread
   */
  async harvestConversation(userId: string, threadId: string) {
    this.logger.log(`Harvesting intelligence from thread ${threadId} for user ${userId}`);

    const messages = await prisma.conversationThreadMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    const chatLog = messages.map(m => `${m.direction.toUpperCase()}: ${m.bodyText || ''}`).join('\n');
    
    // We use the same shredder logic but with a conversation source type
    return this.shredText(userId, chatLog, { 
      type: 'conversation_thread', 
      id: threadId 
    });
  }

  /**
   * FLYWHEEL FEEDBACK: Tracks usage of a vault item
   */
  async trackUsage(userId: string, data: {
    targetId: string;
    actionItemId: string;
    sentiment?: number;
    outcome?: string;
  }) {
    return prisma.intelligenceUsage.create({
      data: {
        userId,
        targetId: data.targetId,
        actionItemId: data.actionItemId,
        sentiment: data.sentiment,
        outcome: data.outcome,
      },
    });
  }
}
