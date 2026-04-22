import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@opportunity-os/db';
import { ContentUploadResponseDto } from './dto/content-upload-response.dto';
import pdfParse from 'pdf-parse';

const prisma = new PrismaClient();

@Injectable()
export class DiscoveryService {
  async uploadContent(
    userId: string,
    file: any,
    offeringId?: string,
    title?: string,
    source?: string,
    notes?: string,
  ): Promise<ContentUploadResponseDto> {
    // Extract text from PDF
    const extractedText = await this.extractTextFromPDF(file);
    
    // Create a minimal discovery run for tracking
    const discoveryRun = await prisma.discoveryRun.create({
      data: {
        userId,
        discoveryStrategyId: '00000000-0000-0000-0000-000000000000', // Default placeholder
        runType: 'targeted' as any,
        status: 'completed' as any,
        startedAt: new Date(),
        completedAt: new Date(),
        discoverySourceId: '00000000-0000-0000-0000-000000000000', // Default placeholder
        itemsDiscovered: 1,
        itemsPromoted: 0,
        errorsCount: 0,
      },
    });
    
    // Create discovered item
    const discoveredItem = await prisma.discoveredItem.create({
      data: {
        userId,
        discoveryRunId: discoveryRun.id,
        title: title || file.originalname,
        description: notes,
        contentText: extractedText,
        contentUrl: source,
        externalId: file.originalname,
        itemType: 'content' as any,
        relevanceScore: 5, // Default score for uploaded content
        confidenceScore: 8, // High confidence for user uploads
        discoveredAt: new Date(),
        processingStatus: 'pending' as any,
        searchKeywords: this.extractKeywords(extractedText),
      },
    });

    // Create content opportunity
    const contentOpportunity = await prisma.contentOpportunity.create({
      data: {
        discoveredItemId: discoveredItem.id,
        contentType: 'article' as any, // Default for uploaded PDFs
        contentPurpose: 'positioning_support' as any, // Default purpose
        keyTopics: this.extractTopics(extractedText),
        leverageActions: ['reference_in_positioning', 'share_with_prospect'],
        urgencyLevel: 3, // Default urgency
        offeringId: offeringId || null,
      },
    });

    // Generate simple summary for V1
    const summary = extractedText.substring(0, 200) + '...';

    return {
      discoveredItemId: discoveredItem.id,
      contentOpportunityId: contentOpportunity.id,
      title: discoveredItem.title,
      source: source,
      extractedText,
      summary,
      offeringLinked: !!offeringId,
      processingStatus: discoveredItem.processingStatus,
    };
  }

  private async extractTextFromPDF(file: any): Promise<string> {
    try {
      const buffer = file.buffer;
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('Failed to extract text from PDF:', error);
      throw new Error('PDF text extraction failed');
    }
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction for V1
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 20); // Limit to top 20 keywords
  }

  private extractTopics(text: string): string[] {
    // Simple topic extraction for V1
    const topics = [];
    const techKeywords = ['api', 'microservice', 'backend', 'frontend', 'database', 'cloud', 'devops', 'security', 'performance'];
    const businessKeywords = ['revenue', 'growth', 'strategy', 'market', 'customer', 'product', 'service'];
    
    techKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword)) {
        topics.push(keyword);
      }
    });
    
    businessKeywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword)) {
        topics.push(keyword);
      }
    });
    
    return [...new Set(topics)].slice(0, 10); // Limit to top 10 topics
  }
}
