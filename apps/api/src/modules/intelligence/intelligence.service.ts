import { Injectable, Logger } from '@nestjs/common';
import {
  prisma,
  ConceptCategory,
  ConceptSourceType,
  IngestionArtifactStatus,
  IntelligenceChunkKind,
  IntelligenceEmbeddingStatus,
  IntelligenceJobKind,
  IntelligenceJobStatus,
  Prisma,
} from '@opportunity-os/db';
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

  async getIngestionArtifacts(userId: string, status?: IngestionArtifactStatus) {
    return prisma.ingestionArtifact.findMany({
      where: {
        userId,
        status: status || undefined,
      },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        chunks: {
          select: {
            id: true,
            chunkKind: true,
            title: true,
            summary: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getIntelligenceJobs(userId: string, status?: IntelligenceJobStatus) {
    return prisma.intelligenceJob.findMany({
      where: {
        userId,
        status: status || undefined,
      },
      include: {
        ingestionArtifact: {
          select: {
            id: true,
            sourceKind: true,
            sourceName: true,
            sourcePath: true,
            status: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getIntelligenceChunks(userId: string, chunkKind?: IntelligenceChunkKind) {
    return prisma.intelligenceChunk.findMany({
      where: {
        userId,
        chunkKind: chunkKind || undefined,
      },
      include: {
        ingestionArtifact: {
          select: {
            id: true,
            sourceKind: true,
            sourceName: true,
            sourcePath: true,
          },
        },
        embeddings: {
          select: {
            id: true,
            providerName: true,
            modelName: true,
            status: true,
            embeddedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
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
  async shredText(userId: string, text: string, source: { type: ConceptSourceType; id: string; name?: string }, synthesisOnly: boolean = false) {
    if (synthesisOnly) {
      return this.summarizeAsset(userId, text, source.name || source.id);
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

    await this.stageAssetIngestionArtifacts({
      userId,
      batchId: batch.id,
      assetIds,
      sourceType,
      providerName,
      synthesisOnly,
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
    
    const allFindings = { concepts: [], proofPoints: [], summaries: [] };
    const results = [];
    
    for (const [index, id] of assetIds.entries()) {
      let activeJobId: string | undefined;
      let activeArtifactId: string | undefined;
      try {
        const assetRecord = await prisma.connectorAsset.findFirst({
          where: { externalId: id, userId },
          select: { id: true, fileName: true, displayName: true }
        });
        const ingestionItem = await prisma.assetIngestionItem.findFirst({
          where: { batchId, externalId: id, userId },
          select: { id: true },
        });
        const artifact = await prisma.ingestionArtifact.findFirst({
          where: { assetIngestionBatchId: batchId, sourcePath: id, userId },
          select: { id: true },
        });
        activeArtifactId = artifact?.id;
        const assetName = assetRecord?.displayName || assetRecord?.fileName || id;

        await prisma.assetIngestionItem.updateMany({
          where: { batchId: batchId, externalId: id },
          data: { status: 'processing' },
        });
        await this.markArtifactProcessing(activeArtifactId);
        activeJobId = await this.startNextJob(userId, activeArtifactId, batchId, ingestionItem?.id);
        
        // Emit "Starting Asset" progress
        this.logger.log(`📊 [Background] Batch ${batchId}: Emitting 'Starting Asset' for ${assetName}`);
        this.eventEmitter.emit('shredding.progress', {
          batchId: batchId,
          assetId: id,
          assetName: assetName,
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
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] 📄 TEXT CLEANED (${cleanText.length} chars)\n`);
        
        // Emit "Analyzing" progress
        this.eventEmitter.emit('shredding.progress', {
          batchId: batchId,
          assetId: id,
          assetName: assetName,
          step: 'Analyzing',
          percentage: Math.round(((index + 0.5) / assetIds.length) * 100),
          message: `Commander analyzing strategic frameworks...`
        });

        const shredResult = await this.shredText(userId, cleanText, { type: sourceType, id, name: assetName } as any, synthesisOnly);
        
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ✅ SHRED RESULT: ${shredResult.concepts.length} concepts, ${shredResult.proofPoints.length} proof points found.\n`);

        const assetSummary = shredResult.summary;

        allFindings.concepts.push(...shredResult.concepts);
        allFindings.proofPoints.push(...shredResult.proofPoints);
        if (assetSummary) allFindings.summaries.push(assetSummary);
        
        results.push({ id, status: 'success', ...shredResult, assetSummary });
        await this.persistChunkFromShredResult({
          userId,
          artifactId: activeArtifactId,
          jobId: activeJobId,
          sourceType,
          sourceId: id,
          title: assetName,
          content: cleanText,
          summary: assetSummary,
          synthesisOnly,
        });
        
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
          assetName: assetName,
          step: 'Complete',
          percentage: Math.round(((index + 1) / assetIds.length) * 100),
          message: synthesisOnly ? `Strategic summary captured.` : `Asset integrated into Strategic Brain.`,
          summary: assetSummary, // PASS THE INDIVIDUAL SUMMARY
        });
        await this.completeArtifactAndJob(activeArtifactId, activeJobId, {
          summary: assetSummary,
          conceptCount: shredResult.concepts.length,
          proofPointCount: shredResult.proofPoints.length,
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
        await this.failArtifactAndJob(activeArtifactId, activeJobId, e.message);

        this.eventEmitter.emit('shredding.error', {
          batchId: batchId,
          assetId: id,
          message: e.message
        });
      }
    }

    let summary = "Strategic assets integrated. The operating posture has been updated based on the internalized content.";
    if (allFindings.concepts.length > 0 || allFindings.proofPoints.length > 0 || allFindings.summaries.length > 0) {
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

  async stageLinkedInArchiveArtifacts(params: {
    userId: string;
    importId?: string;
    archiveName?: string;
    files: Array<{
      path: string;
      name: string;
      mimeType?: string;
      sizeBytes?: number;
      recordCount?: number;
      metadata?: Record<string, unknown>;
    }>;
  }) {
    const artifacts = [];

    for (const file of params.files) {
      const artifact = await this.upsertIngestionArtifact({
        userId: params.userId,
        connectionImportBatchId: params.importId,
        providerName: 'linkedin',
        sourceKind: 'linkedin_archive_file',
        sourceName: file.name,
        sourcePath: file.path,
        mimeType: file.mimeType || 'text/csv',
        sizeBytes: file.sizeBytes,
        recordCount: file.recordCount,
        status: IngestionArtifactStatus.queued,
        metadataJson: {
          archiveName: params.archiveName,
          ...(file.metadata || {}),
        },
      });

      const kinds = this.linkedinJobKindsForPath(file.path);
      await Promise.all(
        kinds.map((kind, index) =>
          this.enqueueIntelligenceJob({
            userId: params.userId,
            artifactId: artifact.id,
            kind,
            priority: 20 + index,
            inputJson: {
              sourcePath: file.path,
              recordCount: file.recordCount,
              archiveName: params.archiveName,
            },
          }),
        ),
      );

      artifacts.push(artifact);
    }

    return artifacts;
  }

  async completeLinkedInArchiveFastMemory(params: {
    userId: string;
    importId?: string;
    profileSummary?: string;
    headline?: string;
    connectionCount: number;
    topCompanies?: string[];
    topTitles?: string[];
  }) {
    const artifacts = await prisma.ingestionArtifact.findMany({
      where: {
        userId: params.userId,
        connectionImportBatchId: params.importId,
      },
      orderBy: { createdAt: 'desc' },
    });
    const profileArtifact = artifacts.find((artifact) => (artifact.sourcePath || '').toLowerCase().endsWith('profile.csv'));
    const networkArtifact = artifacts.find((artifact) => (artifact.sourcePath || '').toLowerCase().includes('connections'));

    if (profileArtifact) {
      const job = await this.findOrStartJob(params.userId, profileArtifact.id, IntelligenceJobKind.profile_shred);
      const summary = [
        params.headline ? `Headline: ${params.headline}` : null,
        params.profileSummary ? `Profile: ${params.profileSummary}` : null,
      ].filter(Boolean).join('\n');

      if (summary) {
        await this.createIntelligenceChunk({
          userId: params.userId,
          artifactId: profileArtifact.id,
          jobId: job?.id,
          chunkKind: IntelligenceChunkKind.profile_summary,
          sourceType: 'linkedin_archive',
          sourceId: params.importId || profileArtifact.id,
          externalKey: 'linkedin-profile-summary',
          title: 'LinkedIn profile posture',
          content: summary,
          summary: params.headline || params.profileSummary,
          metadataJson: { connectionImportBatchId: params.importId },
        });
      }

      await this.completeArtifactAndJob(profileArtifact.id, job?.id, { summary });
    }

    if (networkArtifact) {
      const job = await this.findOrStartJob(params.userId, networkArtifact.id, IntelligenceJobKind.connections_cluster);
      const content = [
        `${params.connectionCount.toLocaleString()} LinkedIn connections captured.`,
        params.topCompanies?.length ? `Top companies: ${params.topCompanies.join(', ')}` : null,
        params.topTitles?.length ? `Top titles: ${params.topTitles.join(', ')}` : null,
      ].filter(Boolean).join('\n');

      await this.createIntelligenceChunk({
        userId: params.userId,
        artifactId: networkArtifact.id,
        jobId: job?.id,
        chunkKind: IntelligenceChunkKind.connection_cluster,
        sourceType: 'linkedin_archive',
        sourceId: params.importId || networkArtifact.id,
        externalKey: 'linkedin-network-topography',
        title: 'LinkedIn network topography',
        content,
        summary: `${params.connectionCount.toLocaleString()} connections mapped across high-signal companies and roles.`,
        metadataJson: {
          connectionImportBatchId: params.importId,
          topCompanies: params.topCompanies || [],
          topTitles: params.topTitles || [],
        },
      });

      await this.completeArtifactAndJob(networkArtifact.id, job?.id, { summary: content });
    }
  }

  private async stageAssetIngestionArtifacts(params: {
    userId: string;
    batchId: string;
    assetIds: string[];
    sourceType: ConceptSourceType;
    providerName?: string;
    synthesisOnly: boolean;
  }) {
    for (const id of params.assetIds) {
      const connectorAsset = await prisma.connectorAsset.findFirst({
        where: { userId: params.userId, externalId: id },
      });

      const item = await prisma.assetIngestionItem.create({
        data: {
          batchId: params.batchId,
          userId: params.userId,
          connectorAssetId: connectorAsset?.id,
          externalId: id,
          displayName: connectorAsset?.displayName || connectorAsset?.fileName || id,
          status: 'queued',
          metadataJson: {
            providerName: params.providerName,
            sourceType: params.sourceType,
            synthesisOnly: params.synthesisOnly,
          },
        },
      });

      const artifact = await this.upsertIngestionArtifact({
        userId: params.userId,
        assetIngestionBatchId: params.batchId,
        assetIngestionItemId: item.id,
        userConnectorId: connectorAsset?.userConnectorId,
        connectorAssetId: connectorAsset?.id,
        providerName: params.providerName || connectorAsset?.externalProvider,
        sourceKind: this.sourceKindForConceptSource(params.sourceType, params.providerName),
        sourceName: connectorAsset?.displayName || connectorAsset?.fileName || id,
        sourcePath: id,
        mimeType: connectorAsset?.mimeType || undefined,
        sizeBytes: connectorAsset?.sizeBytes ? Number(connectorAsset.sizeBytes) : undefined,
        status: IngestionArtifactStatus.queued,
        metadataJson: {
          synthesisOnly: params.synthesisOnly,
          webViewLink: connectorAsset?.webViewLink,
          versionToken: connectorAsset?.versionToken,
        },
      });

      await this.enqueueIntelligenceJob({
        userId: params.userId,
        artifactId: artifact.id,
        batchId: params.batchId,
        itemId: item.id,
        kind: params.synthesisOnly ? IntelligenceJobKind.fast_summary : IntelligenceJobKind.profile_shred,
        priority: params.synthesisOnly ? 40 : 50,
        inputJson: {
          externalId: id,
          providerName: params.providerName,
          sourceType: params.sourceType,
          synthesisOnly: params.synthesisOnly,
        },
      });

      await this.enqueueIntelligenceJob({
        userId: params.userId,
        artifactId: artifact.id,
        batchId: params.batchId,
        itemId: item.id,
        kind: IntelligenceJobKind.vector_embedding,
        priority: 90,
        inputJson: {
          externalId: id,
          dependsOn: params.synthesisOnly ? 'fast_summary' : 'profile_shred',
        },
      });
    }
  }

  private async upsertIngestionArtifact(data: {
    userId: string;
    assetIngestionBatchId?: string;
    assetIngestionItemId?: string;
    connectionImportBatchId?: string;
    userConnectorId?: string;
    connectorAssetId?: string;
    userAssetId?: string;
    providerName?: string;
    sourceKind: string;
    sourceName: string;
    sourcePath?: string;
    mimeType?: string;
    sizeBytes?: number;
    recordCount?: number;
    status: IngestionArtifactStatus;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    const existing = data.assetIngestionBatchId && data.sourcePath
      ? await prisma.ingestionArtifact.findUnique({
          where: {
            assetIngestionBatchId_sourcePath: {
              assetIngestionBatchId: data.assetIngestionBatchId,
              sourcePath: data.sourcePath,
            },
          },
        })
      : await prisma.ingestionArtifact.findFirst({
          where: {
            userId: data.userId,
            connectionImportBatchId: data.connectionImportBatchId,
            sourcePath: data.sourcePath,
            sourceKind: data.sourceKind,
          },
        });

    const payload = {
      userId: data.userId,
      assetIngestionBatchId: data.assetIngestionBatchId || null,
      assetIngestionItemId: data.assetIngestionItemId || null,
      connectionImportBatchId: data.connectionImportBatchId || null,
      userConnectorId: data.userConnectorId || null,
      connectorAssetId: data.connectorAssetId || null,
      userAssetId: data.userAssetId || null,
      providerName: data.providerName || null,
      sourceKind: data.sourceKind,
      sourceName: data.sourceName,
      sourcePath: data.sourcePath || null,
      mimeType: data.mimeType || null,
      sizeBytes: data.sizeBytes ? BigInt(data.sizeBytes) : null,
      recordCount: data.recordCount ?? null,
      status: data.status,
      metadataJson: data.metadataJson ?? Prisma.JsonNull,
    };

    if (existing) {
      return prisma.ingestionArtifact.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return prisma.ingestionArtifact.create({ data: payload });
  }

  private async enqueueIntelligenceJob(data: {
    userId: string;
    artifactId?: string;
    batchId?: string;
    itemId?: string;
    kind: IntelligenceJobKind;
    priority?: number;
    inputJson?: Prisma.InputJsonValue;
  }) {
    const idempotencyKey = [
      data.userId,
      data.artifactId || 'no-artifact',
      data.batchId || 'no-batch',
      data.itemId || 'no-item',
      data.kind,
    ].join(':');

    return prisma.intelligenceJob.upsert({
      where: { idempotencyKey },
      create: {
        userId: data.userId,
        ingestionArtifactId: data.artifactId || null,
        assetIngestionBatchId: data.batchId || null,
        assetIngestionItemId: data.itemId || null,
        kind: data.kind,
        status: IntelligenceJobStatus.queued,
        priority: data.priority ?? 100,
        idempotencyKey,
        inputJson: data.inputJson ?? Prisma.JsonNull,
        scheduledAt: new Date(),
      },
      update: {
        inputJson: data.inputJson ?? Prisma.JsonNull,
        priority: data.priority ?? 100,
        scheduledAt: new Date(),
      },
    });
  }

  private async startNextJob(userId: string, artifactId?: string, batchId?: string, itemId?: string) {
    const job = await prisma.intelligenceJob.findFirst({
      where: {
        userId,
        ingestionArtifactId: artifactId || undefined,
        assetIngestionBatchId: batchId || undefined,
        assetIngestionItemId: itemId || undefined,
        status: { in: [IntelligenceJobStatus.queued, IntelligenceJobStatus.retrying] },
        kind: { not: IntelligenceJobKind.vector_embedding },
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    if (!job) return undefined;

    const updated = await prisma.intelligenceJob.update({
      where: { id: job.id },
      data: {
        status: IntelligenceJobStatus.running,
        attemptCount: { increment: 1 },
        startedAt: new Date(),
        lockedAt: new Date(),
        lockedBy: 'api-inline-background',
        progressPercent: 10,
      },
    });

    return updated.id;
  }

  private async findOrStartJob(userId: string, artifactId: string, kind: IntelligenceJobKind) {
    const job = await prisma.intelligenceJob.findFirst({
      where: { userId, ingestionArtifactId: artifactId, kind },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) return undefined;
    if (job.status === IntelligenceJobStatus.completed) return job;
    return prisma.intelligenceJob.update({
      where: { id: job.id },
      data: {
        status: IntelligenceJobStatus.running,
        attemptCount: { increment: 1 },
        startedAt: new Date(),
        lockedAt: new Date(),
        lockedBy: 'api-fast-memory',
        progressPercent: 50,
      },
    });
  }

  private async markArtifactProcessing(artifactId?: string) {
    if (!artifactId) return;
    await prisma.ingestionArtifact.update({
      where: { id: artifactId },
      data: { status: IngestionArtifactStatus.processing },
    });
  }

  private async completeArtifactAndJob(artifactId?: string, jobId?: string, output?: Prisma.InputJsonValue) {
    await Promise.all([
      artifactId
        ? prisma.ingestionArtifact.update({
            where: { id: artifactId },
            data: { status: IngestionArtifactStatus.processed, errorMessage: null },
          })
        : Promise.resolve(),
      jobId
        ? prisma.intelligenceJob.update({
            where: { id: jobId },
            data: {
              status: IntelligenceJobStatus.completed,
              progressPercent: 100,
              completedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              outputJson: output ?? Prisma.JsonNull,
              errorMessage: null,
            },
          })
        : Promise.resolve(),
    ]);
  }

  private async failArtifactAndJob(artifactId?: string, jobId?: string, errorMessage?: string) {
    await Promise.all([
      artifactId
        ? prisma.ingestionArtifact.update({
            where: { id: artifactId },
            data: {
              status: IngestionArtifactStatus.failed,
              errorMessage: errorMessage || 'Unknown ingestion error',
            },
          })
        : Promise.resolve(),
      jobId
        ? prisma.intelligenceJob.update({
            where: { id: jobId },
            data: {
              status: IntelligenceJobStatus.failed,
              progressPercent: 100,
              completedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              errorMessage: errorMessage || 'Unknown ingestion error',
            },
          })
        : Promise.resolve(),
    ]);
  }

  private async persistChunkFromShredResult(params: {
    userId: string;
    artifactId?: string;
    jobId?: string;
    sourceType: ConceptSourceType;
    sourceId: string;
    title: string;
    content: string;
    summary?: string;
    synthesisOnly: boolean;
  }) {
    const chunk = await this.createIntelligenceChunk({
      userId: params.userId,
      artifactId: params.artifactId,
      jobId: params.jobId,
      chunkKind: params.synthesisOnly ? IntelligenceChunkKind.document_section : IntelligenceChunkKind.strategic_thesis,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      externalKey: `asset:${params.sourceId}:summary`,
      title: params.title,
      content: params.content.substring(0, 50000),
      summary: params.summary,
      tokenCount: Math.ceil(params.content.length / 4),
      metadataJson: {
        synthesisOnly: params.synthesisOnly,
      },
    });

    await prisma.intelligenceEmbedding.upsert({
      where: {
        chunkId_providerName_modelName: {
          chunkId: chunk.id,
          providerName: 'openai',
          modelName: 'text-embedding-3-large',
        },
      },
      create: {
        userId: params.userId,
        chunkId: chunk.id,
        providerName: 'openai',
        modelName: 'text-embedding-3-large',
        status: IntelligenceEmbeddingStatus.pending,
      },
      update: {
        status: IntelligenceEmbeddingStatus.pending,
      },
    });
  }

  private async createIntelligenceChunk(data: {
    userId: string;
    artifactId?: string;
    jobId?: string;
    chunkKind: IntelligenceChunkKind;
    sourceType: string;
    sourceId: string;
    externalKey: string;
    title: string;
    content: string;
    summary?: string | null;
    tokenCount?: number;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    const existing = data.artifactId
      ? await prisma.intelligenceChunk.findUnique({
          where: {
            ingestionArtifactId_externalKey: {
              ingestionArtifactId: data.artifactId,
              externalKey: data.externalKey,
            },
          },
        })
      : undefined;

    const payload = {
      userId: data.userId,
      ingestionArtifactId: data.artifactId || null,
      intelligenceJobId: data.jobId || null,
      chunkKind: data.chunkKind,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      externalKey: data.externalKey,
      title: data.title,
      content: data.content,
      summary: data.summary || null,
      tokenCount: data.tokenCount ?? null,
      metadataJson: data.metadataJson ?? Prisma.JsonNull,
    };

    const chunk = existing
      ? await prisma.intelligenceChunk.update({ where: { id: existing.id }, data: payload })
      : await prisma.intelligenceChunk.create({ data: payload });

    await prisma.intelligenceSource.create({
      data: {
        chunkId: chunk.id,
        sourceType: this.conceptSourceTypeForChunk(data.sourceType),
        sourceId: data.sourceId,
      },
    }).catch(() => undefined);

    return chunk;
  }

  private sourceKindForConceptSource(sourceType: ConceptSourceType, providerName?: string) {
    if (providerName === 'google_drive') return 'google_drive_file';
    if (providerName === 'onedrive') return 'onedrive_file';
    if (sourceType === ConceptSourceType.knowledge_asset) return 'manual_upload';
    return `${sourceType}_asset`;
  }

  private linkedinJobKindsForPath(path: string): IntelligenceJobKind[] {
    const lower = path.toLowerCase();
    if (lower.includes('profile')) return [IntelligenceJobKind.profile_shred, IntelligenceJobKind.posture_synthesis, IntelligenceJobKind.vector_embedding];
    if (lower.includes('connection')) return [IntelligenceJobKind.connections_cluster, IntelligenceJobKind.vector_embedding];
    if (lower.includes('message')) return [IntelligenceJobKind.message_thread_memory, IntelligenceJobKind.vector_embedding];
    if (lower.includes('share') || lower.includes('post') || lower.includes('article')) return [IntelligenceJobKind.content_memory, IntelligenceJobKind.vector_embedding];
    if (lower.includes('comment')) return [IntelligenceJobKind.comments_signal_memory, IntelligenceJobKind.vector_embedding];
    if (lower.includes('recommendation')) return [IntelligenceJobKind.recommendations_proof, IntelligenceJobKind.vector_embedding];
    if (lower.includes('endorsement') || lower.includes('skill')) return [IntelligenceJobKind.endorsements_proof, IntelligenceJobKind.vector_embedding];
    if (lower.includes('job')) return [IntelligenceJobKind.job_market_memory, IntelligenceJobKind.vector_embedding];
    if (lower.includes('invitation')) return [IntelligenceJobKind.invitations_outreach_history, IntelligenceJobKind.vector_embedding];
    return [IntelligenceJobKind.fast_summary, IntelligenceJobKind.vector_embedding];
  }

  private conceptSourceTypeForChunk(sourceType: string): ConceptSourceType {
    if (Object.values(ConceptSourceType).includes(sourceType as ConceptSourceType)) {
      return sourceType as ConceptSourceType;
    }
    return ConceptSourceType.intelligence_chunk;
  }
}
