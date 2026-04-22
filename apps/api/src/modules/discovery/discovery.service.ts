import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetCategory, prisma } from '@opportunity-os/db';
import { ContentUploadResponseDto } from './dto/content-upload-response.dto';
import { ExecuteContentOpportunityDto } from './dto/execute-content-opportunity.dto';
import { UploadContentDto } from './dto/upload-content.dto';

@Injectable()
export class DiscoveryService {
  async listContent(userId: string) {
    return prisma.userAsset.findMany({
      where: { userId, category: AssetCategory.other },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async uploadContent(
    userId: string,
    file: any,
    body: UploadContentDto,
  ): Promise<ContentUploadResponseDto> {
    const displayName = body.title?.trim() || file.originalname || 'Uploaded content';
    const source = body.source?.trim() || `upload://${file.originalname || displayName}`;
    const extractedText = await this.extractTextFromPDF(file);
    const summary = this.summarizeText(extractedText, body.notes);

    const asset = await prisma.userAsset.create({
      data: {
        userId,
        displayName,
        fileName: file.originalname || displayName,
        fileUrl: source,
        mimeType: file.mimetype || 'application/pdf',
        category: AssetCategory.other,
      },
    });

    return {
      discoveredItemId: asset.id,
      title: asset.displayName,
      source,
      offeringId: body.offeringId,
      summary,
      whyItMatters: 'Uploaded research content is available as campaign context.',
      leverageInterpretation: this.leverageInterpretation(extractedText),
      aiInterpretationSucceeded: false,
      processingStatus: 'classified',
    };
  }

  async executeContentOpportunity(
    userId: string,
    id: string,
    body: ExecuteContentOpportunityDto,
  ) {
    const asset = await prisma.userAsset.findFirst({
      where: { id, userId },
    });
    if (!asset) {
      throw new NotFoundException('Discovery content not found');
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title: `Use research: ${asset.displayName}`,
        description: `Review this research asset and identify up to ${body.maxTargets ?? 3} outreach targets or campaign hooks.`,
        priority: 'medium',
        status: 'open',
        taskType: 'discovery_execution',
      },
    });

    return {
      success: true,
      assetId: asset.id,
      task,
      maxTargets: body.maxTargets ?? 3,
    };
  }

  private async extractTextFromPDF(file: any): Promise<string> {
    const buffer = file?.buffer;
    if (!buffer) return '';

    // Keep this dependency-light for now; full PDF parsing can be reintroduced
    // once the discovery schema and parser package are aligned.
    return buffer.toString('utf8').replace(/\s+/g, ' ').trim();
  }

  private summarizeText(text: string, notes?: string): string {
    const base = notes?.trim() || text;
    if (!base) return 'Uploaded content is ready for review.';
    return base.length > 240 ? `${base.slice(0, 240)}...` : base;
  }

  private leverageInterpretation(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('trading') || lower.includes('market data') || lower.includes('latency')) {
      return 'Potentially useful for trading systems positioning and recruiter outreach.';
    }
    return 'Potentially useful as supporting context for future outreach.';
  }
}
