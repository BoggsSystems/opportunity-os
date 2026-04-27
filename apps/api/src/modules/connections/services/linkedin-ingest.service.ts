import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { prisma, OfferingType, OfferingStatus } from '@opportunity-os/db';
import { ConnectionImportService } from './connection-import.service';
import { AiService } from '../../ai/ai.service';

export interface StrategicDraft {
  posture: {
    text: string;
    objectives: string[];
    preferredTone: string;
  };
  offerings: Array<{
    title: string;
    description: string;
    type: OfferingType;
  }>;
  theses: Array<{
    title: string;
    content: string;
    tags: string[];
  }>;
}

@Injectable()
export class LinkedInIngestService {
  private readonly logger = new Logger(LinkedInIngestService.name);

  constructor(
    private readonly connectionImportService: ConnectionImportService,
    private readonly aiService: AiService
  ) {}

  async processFullZip(buffer: Buffer, userId: string, importId: string): Promise<StrategicDraft> {
    this.logger.log(`Processing full LinkedIn ZIP for user: ${userId}`);
    
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      
      const dataMap: Record<string, any[]> = {};
      
      for (const entry of zipEntries) {
        if (entry.entryName.endsWith('.csv')) {
          try {
            const content = entry.getData().toString('utf8');
            const records = parse(content, {
              columns: true,
              skip_empty_lines: true,
              trim: true,
            });
            dataMap[entry.entryName] = records;
          } catch (e) {
            this.logger.warn(`Failed to parse CSV entry: ${entry.entryName}`);
          }
        }
      }

      // 1. Handle Connections (Async)
      const connectionsData = dataMap['Connections.csv'] || 
                              dataMap['connections/Connections.csv'] || 
                              dataMap['Connections.csv'];
                              
      if (connectionsData) {
        this.connectionImportService.processImportFile(importId, connectionsData)
          .catch(err => this.logger.error('Failed to process connections from ZIP', err));
      }

      // 2. Extract Strategic Context
      const profileData = dataMap['Profile.csv'] || dataMap['profile/Profile.csv'];
      const positionsData = dataMap['Positions.csv'] || dataMap['profile/Positions.csv'];
      const skillsData = dataMap['Skills.csv'] || dataMap['profile/Skills.csv'];

      const draft = await this.generateStrategicDraft(profileData, positionsData, skillsData);
      
      // 3. Persist Strategic Draft to Database
      await this.persistStrategicDraft(userId, draft);
      
      return draft;
    } catch (error) {
      this.logger.error('Failed to process LinkedIn ZIP archive', error);
      throw new Error(`Failed to process ZIP archive: ${error instanceof Error ? error.message : 'Invalid ZIP file'}`);
    }
  }

  private async generateStrategicDraft(
    profile?: any[],
    positions?: any[],
    skills?: any[]
  ): Promise<StrategicDraft> {
    const summary = profile?.[0]?.Summary || profile?.[0]?.['About Me'] || 'No summary available';
    const headline = profile?.[0]?.Headline || 'Professional';
    const experience = positions?.slice(0, 10).map(p => `- ${p.Title} at ${p.Company}: ${p.Description}`).join('\n') || 'No experience data';
    const skillsList = skills?.map(s => s.Name || s.NameRaw).join(', ') || 'No skills listed';

    this.logger.log(`Synthesizing strategic draft for user with ${positions?.length || 0} roles`);

    const prompt = `
You are an expert Strategic Business Analyst for "Opportunity OS." Your task is to analyze a professional's LinkedIn history and propose a high-leverage strategic profile.

USER DATA:
- HEADLINE: ${headline}
- SUMMARY: ${summary}
- RECENT EXPERIENCE:
${experience}
- SKILLS: ${skillsList}

TASK:
1. Define a "Professional Posture": A persona description that captures their seniority and expertise.
2. Identify 2-4 "Offerings": Specific products or services they could sell based on their history (Consulting, Advisory, Software, Book, etc.).
3. Identify 2-3 "Strategic Theses": Philosophical perspectives or "physics of success" they hold (e.g., "The Economics of AI Velocity").

OUTPUT FORMAT (JSON ONLY):
{
  "posture": {
    "text": "Senior architect persona...",
    "objectives": ["Promote flagship audit", "Increase velocity"],
    "preferredTone": "Professional and strategic"
  },
  "offerings": [
    { "title": "Offering Name", "description": "What is it?", "type": "consulting|service|book|software" }
  ],
  "theses": [
    { "title": "Thesis Title", "content": "The underlying philosophy...", "tags": ["tag1", "tag2"] }
  ]
}

Only return the JSON. No other text.
`.trim();

    try {
      const response = await this.aiService.generateText(prompt, {
        temperature: 0.4,
        maxTokens: 2000
      });

      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      
      // Map string types to Prisma Enums
      parsed.offerings = parsed.offerings.map(o => ({
        ...o,
        type: this.mapOfferingType(o.type)
      }));

      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate strategic draft via AI', error);
      // Fallback
      return this.getFallbackDraft(headline, summary);
    }
  }

  private async persistStrategicDraft(userId: string, draft: StrategicDraft): Promise<void> {
    this.logger.log(`Persisting strategic draft for user: ${userId}`);
    
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Persist Posture
        await tx.userPosture.upsert({
          where: { userId },
          create: {
            userId,
            postureText: draft.posture.text,
            objectives: draft.posture.objectives,
            preferredTone: draft.posture.preferredTone
          },
          update: {
            postureText: draft.posture.text,
            objectives: draft.posture.objectives,
            preferredTone: draft.posture.preferredTone
          }
        });

        // 2. Persist Offerings (as DRAFT)
        for (const offering of draft.offerings) {
          await tx.offering.create({
            data: {
              userId,
              title: offering.title,
              description: offering.description,
              offeringType: offering.type,
              status: OfferingStatus.draft
            }
          });
        }

        // 3. Persist Theses
        for (const thesis of draft.theses) {
          await tx.strategicThesis.create({
            data: {
              userId,
              title: thesis.title,
              content: thesis.content,
              relevanceTags: thesis.tags
            }
          });
        }
      });
      
      this.logger.log('Strategic draft successfully persisted to database');
    } catch (error) {
      this.logger.error('Failed to persist strategic draft', error);
      // We don't throw here to avoid failing the whole ingest if persistence fails
    }
  }

  private mapOfferingType(type: string): OfferingType {
    const t = type.toLowerCase();
    if (t.includes('consulting')) return OfferingType.consulting;
    if (t.includes('service')) return OfferingType.service;
    if (t.includes('book')) return OfferingType.book;
    if (t.includes('software')) return OfferingType.software;
    if (t.includes('product')) return OfferingType.product;
    return OfferingType.other;
  }

  private getFallbackDraft(headline: string, summary: string): StrategicDraft {
    return {
      posture: { text: headline, objectives: [], preferredTone: 'Professional' },
      offerings: [{ title: 'Consulting', description: summary.substring(0, 100), type: OfferingType.consulting }],
      theses: []
    };
  }
}
