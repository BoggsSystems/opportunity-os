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
  async shredAssets(userId: string, assetIds: string[], sourceType: ConceptSourceType) {
    this.logger.log(`Bulk shredding ${assetIds.length} assets for user ${userId}`);
    
    const results = [];
    for (const id of assetIds) {
      try {
        const { buffer, fileName, mimeType } = await this.connectorsService.downloadFile(userId, id);
        
        // Simple text extraction for now (we'd use a real PDF parser in prod)
        // For demonstration, we'll assume the buffer can be converted to text if it's text-based
        // or just pass a snippet if it's a binary (mocking the extraction)
        const text = buffer.toString('utf8').substring(0, 10000); 
        
        const shredResult = await this.shredText(userId, text, { type: sourceType, id });
        results.push({ id, status: 'success', ...shredResult });
      } catch (e) {
        this.logger.error(`Failed to shred asset ${id}`, e);
        results.push({ id, status: 'failed', error: e.message });
      }
    }
    return results;
  }

  async linkConceptToProof(conceptId: string, proofPointId: string) {
    return prisma.conceptProofLink.create({
      data: {
        conceptId,
        proofPointId,
      },
    });
  }
}
