import { Injectable, Logger } from '@nestjs/common';
import { prisma, ConceptCategory, ConceptSourceType } from '@opportunity-os/db';
import * as pdf from 'pdf-parse';
import * as fs from 'fs';
import { AiService } from '../ai/ai.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly connectorsService: ConnectorsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private mapCategory(category: string): ConceptCategory {
    const validCategories = Object.values(ConceptCategory) as string[];
    const normalized = category.toLowerCase().trim();
    
    if (validCategories.includes(normalized)) {
      return normalized as ConceptCategory;
    }

    // Heuristics for common AI variations
    if (normalized === 'role' || normalized === 'persona') return ConceptCategory.stance;
    if (normalized === 'technique' || normalized === 'tactic') return ConceptCategory.methodology;
    if (normalized === 'evidence' || normalized === 'data') return ConceptCategory.proof_point;
    if (normalized === 'value' || normalized === 'ethos') return ConceptCategory.stance;
    
    // Default to framework if unknown
    return ConceptCategory.framework;
  }

  async createConcept(userId: string, data: {
    title: string;
    description: string;
    category: string;
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
          category: this.mapCategory(data.category),
          metadataJson: data.metadata,
        },
      });

      await tx.intelligenceSource.create({
        data: {
          conceptId: concept.id,
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
          proofPointId: proofPoint.id,
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
   * THE COMMANDER'S BRIEFING: Understands the asset holistically without atomic shredding
   */
  async summarizeAsset(userId: string, text: string, assetName: string) {
    this.logger.log(`Commander is internalizing asset: ${assetName} for user ${userId}`);
    
    const summary = await this.aiService.generateStrategicBriefing(text, assetName);
    
    return {
      summary,
      concepts: [],
      proofPoints: []
    };
  }

  /**
   * THE SHREDDER: Extracts concepts and proof points from raw text
   */
  async shredText(userId: string, text: string, source: { type: ConceptSourceType; id: string }, synthesisOnly: boolean = false) {
    if (synthesisOnly) {
      return this.summarizeAsset(userId, text, source.id);
    }

    this.logger.log(`Shredding text for user ${userId} from source ${source.type}:${source.id}`);
    
    // 1. Identify Concepts (Using the efficient 5.4-mini shredder)
    const extracted = await this.aiService.extractStrategicIntelligence(text, 'openai/gpt-5.4-mini');
    
    const results = {
      concepts: [] as any[],
      proofPoints: [] as any[],
    };

    // 2. Persist (Only if NOT synthesisOnly)
    if (!synthesisOnly) {
      for (const c of extracted.concepts) {
        const concept = await this.createConcept(userId, {
          title: c.title,
          description: c.description,
          category: c.category,
          sourceType: source.type,
          sourceId: source.id,
          metadata: c.metadata
        });
        results.concepts.push(concept);
      }

      for (const p of extracted.proofPoints) {
        const proofPoint = await this.createProofPoint(userId, {
          title: p.title,
          content: p.content,
          sourceType: source.type,
          sourceId: source.id,
        });
        results.proofPoints.push(proofPoint);
      }
    } else {
      // In synthesis mode, we just return the raw extracted findings without DB records
      results.concepts = extracted.concepts;
      results.proofPoints = extracted.proofPoints;
    }

    return {
      ...results,
      summary: extracted.summary
    };
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
    synthesisOnly: boolean = false,
  ) {
    this.logger.log(`${synthesisOnly ? 'Synthesizing' : 'Bulk shredding'} ${assetIds.length} assets for user ${userId}`);
    
    const batch = await prisma.assetIngestionBatch.create({
      data: {
        userId,
        userConnectorId: connectorId ?? null,
        sourceType,
        status: 'running',
        providerName: providerName ?? null,
        requestedAssetCount: assetIds.length,
        startedAt: new Date(),
        metadataJson: synthesisOnly ? { mode: 'synthesis_only' } : null,
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

    // START BACKGROUND PROCESS
    // We use setImmediate to ensure this runs in the next event loop tick, 
    // allowing the return statement below to execute first.
    setImmediate(() => {
      this.runShreddingProcess(userId, assetIds, sourceType, providerName, batch.id, synthesisOnly).catch(err => {
        this.logger.error(`Background shredding process failed for batch ${batch.id}`, err);
      });
    });

    return { batchId: batch.id, status: 'running' };
  }

  private async runShreddingProcess(
    userId: string,
    assetIds: string[],
    sourceType: ConceptSourceType,
    providerName: string | undefined,
    batchId: string,
    synthesisOnly: boolean,
  ) {
    // Give the frontend 1 second to receive the batchId and subscribe to the socket
    this.logger.log(`🕒 [Background] Batch ${batchId}: Cooling down for 1s for socket subscription...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.logger.log(`🚀 [Background] Batch ${batchId}: Starting execution...`);
    
    const allFindings = { concepts: [], proofPoints: [] };
    const results = [];
    
    for (const [index, id] of assetIds.entries()) {
      try {
        await prisma.assetIngestionItem.updateMany({
          where: { batchId: batchId, externalId: id },
          data: { status: 'processing' },
        });
        
        // Emit "Starting Asset" progress
        this.logger.log(`📊 [Background] Batch ${batchId}: Emitting 'Starting Asset' for ${id}`);
        this.eventEmitter.emit('shredding.progress', {
          batchId: batchId,
          assetId: id,
          step: 'Downloading',
          percentage: Math.round(((index) / assetIds.length) * 100),
          message: `Accessing asset ${index + 1} of ${assetIds.length}...`
        });
        
        const { buffer, mimeType } = await this.connectorsService.downloadFile(userId, id, providerName);
        
        let text = '';
        if (mimeType === 'application/pdf') {
          try {
            this.logger.log(`📄 ROBUST PDF EXTRACTION: ${id} (${buffer.length} bytes)`);
            
            let pdfParser = pdf; // Already imported as * as pdf
            // Handle both CommonJS, ES module exports, and specialized versions (2.4.5)
            if (typeof pdfParser !== 'function') {
              if ((pdfParser as any).default) {
                pdfParser = (pdfParser as any).default;
              } else if ((pdfParser as any).PDFParse) {
                pdfParser = (pdfParser as any).PDFParse;
              }
            }

            if (typeof pdfParser === 'function') {
              try {
                const data = await (pdfParser as any)(buffer);
                text = data?.text || '';
              } catch (e: any) {
                if (e.message?.includes("Class constructor") || e.message?.includes("cannot be invoked without 'new'")) {
                  const parser = new (pdfParser as any)({ data: buffer });
                  const result = await parser.getText();
                  text = result.text || '';
                } else {
                  throw e;
                }
              }
            } else if ((pdfParser as any).PDFParse) {
              const parser = new (pdfParser as any).PDFParse({ data: buffer });
              const result = await parser.getText();
              text = result.text || '';
            }

            this.logger.log(`📄 PDF SUCCESS: Extracted ${text.length} characters from ${id}`);
          } catch (err) {
            this.logger.error(`Failed to parse PDF ${id}`, err);
            text = buffer.toString('utf8'); // Fallback
          }
        } else {
          text = buffer.toString('utf8');
        }

        // Emit "Parsing Complete" progress
        this.eventEmitter.emit('shredding.progress', {
          batchId: batchId,
          assetId: id,
          step: 'Parsing',
          percentage: Math.round(((index + 0.3) / assetIds.length) * 100),
          message: `Extracting text from asset...`
        });

        const cleanText = text.trim().substring(0, 300000); 
        
        // --- DIAGNOSTIC LOGGING ---
        const logPath = '/Users/jeffboggs/opportunity-os/apps/api/debug.log';
        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] 📄 SHREDDING ASSET (HOLISTIC): ${id} (${mimeType})\nTEXT LENGTH: ${cleanText.length} chars\nPREVIEW: ${cleanText.substring(0, 500)}...\n`);
        // ---------------------------

        // Emit "AI Synthesis" progress
        this.eventEmitter.emit('shredding.progress', {
          batchId: batchId,
          assetId: id,
          step: 'AI Synthesis',
          percentage: Math.round(((index + 0.6) / assetIds.length) * 100),
          message: `Commander analyzing strategic frameworks...`
        });

        const shredResult = await this.shredText(userId, cleanText, { type: sourceType, id }, synthesisOnly);
        
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ✅ SHRED RESULT: ${shredResult.concepts.length} concepts, ${shredResult.proofPoints.length} proof points found.\n`);

        const assetSummary = shredResult.summary;

        allFindings.concepts.push(...shredResult.concepts);
        allFindings.proofPoints.push(...shredResult.proofPoints);
        
        results.push({ id, status: 'success', ...shredResult, assetSummary });
        
        if (!synthesisOnly) {
          await prisma.assetIngestionItem.updateMany({
            where: { batchId: batchId, externalId: id },
            data: {
              status: 'imported',
              conceptCount: shredResult.concepts.length,
              proofPointCount: shredResult.proofPoints.length,
              importedAt: new Date(),
            },
          });
        } else {
          await prisma.assetIngestionItem.updateMany({
            where: { batchId: batchId, externalId: id },
            data: {
              status: 'imported',
              importedAt: new Date(),
            },
          });
        }

        // Emit "Asset Complete" progress
        this.eventEmitter.emit('shredding.progress', {
          batchId: batchId,
          assetId: id,
          step: 'Complete',
          percentage: Math.round(((index + 1) / assetIds.length) * 100),
          message: synthesisOnly ? `Strategic summary captured.` : `Asset integrated into Strategic Brain.`
        });
      } catch (e: any) {
        const logPath = '/Users/jeffboggs/opportunity-os/apps/api/debug.log';
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ❌ SHREDDING FAILED for asset ${id}: ${e.message}\n`);
        this.logger.error(`Failed to shred asset ${id}`, e);
        results.push({ id, status: 'failed', error: e.message });
        await prisma.assetIngestionItem.updateMany({
          where: { batchId: batchId, externalId: id },
          data: {
            status: 'failed',
            errorMessage: e.message ?? 'Unknown ingestion error',
          },
        });

        this.eventEmitter.emit('shredding.error', {
          batchId: batchId,
          assetId: id,
          message: e.message
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
      where: { id: batchId },
      data: {
        status: failedCount === 0 ? 'completed' : importedCount > 0 ? 'partial' : 'failed',
        importedCount,
        failedCount,
        summary,
        completedAt: new Date(),
      },
    });

    this.eventEmitter.emit('shredding.completed', {
      batchId: batchId,
      importedCount,
      failedCount,
      summary
    });
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
    conceptId?: string;
    proofPointId?: string;
    actionItemId: string;
    sentiment?: number;
    outcome?: string;
  }) {
    return prisma.intelligenceUsage.create({
      data: {
        userId,
        conceptId: data.conceptId,
        proofPointId: data.proofPointId,
        actionItemId: data.actionItemId,
        sentiment: data.sentiment,
        outcome: data.outcome,
      },
    });
  }
}
