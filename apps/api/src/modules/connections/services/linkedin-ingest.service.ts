import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
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

import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class LinkedInIngestService {
  private readonly logger = new Logger(LinkedInIngestService.name);

  constructor(
    private readonly connectionImportService: ConnectionImportService,
    private readonly aiService: AiService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async processFullZip(buffer: Buffer, userId?: string, importId?: string): Promise<StrategicDraft & { connectionCount: number; networkTopography?: any }> {
    this.logger.log(`Processing full LinkedIn ZIP. userId: ${userId || 'ANONYMOUS'}`);
    
    try {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      
      const dataMap: Record<string, any[]> = {};
      
      for (const entry of zipEntries) {
        if (entry.entryName.endsWith('.csv')) {
          try {
            const content = entry.getData().toString('utf8');
            const records = this.connectionImportService.parseCSV(content);
            dataMap[entry.entryName] = records;
          } catch (e) {
            this.logger.warn(`Failed to parse CSV entry: ${entry.entryName}`);
          }
        }
      }

      if (userId) {
        await this.eventEmitter.emitAsync('linkedin.archive.discovered', {
          userId,
          importId,
          archiveName: importId ? `LinkedIn Archive ${importId}` : 'LinkedIn Archive',
          files: Object.entries(dataMap).map(([path, records]) => ({
            path,
            name: path.split('/').pop() || path,
            mimeType: 'text/csv',
            sizeBytes: Buffer.byteLength(JSON.stringify(records), 'utf8'),
            recordCount: records.length,
            metadata: {
              source: 'linkedin_data_export',
              highSignal: this.isHighSignalLinkedInArchivePath(path),
            },
          })),
        });
      }

      // 1. Handle Connections
      // 1. Handle Connections - Be more aggressive in finding the connections file
      const connectionsEntry = zipEntries.find(e => {
        const name = e.entryName.toLowerCase();
        return name.endsWith('.csv') && 
               (name.includes('connections.csv') || name.includes('connection.csv')) &&
               !name.includes('sync') &&
               !name.includes('contact'); // Avoid Contacts.csv which is different
      });
      
      let connectionsData = null;
      if (connectionsEntry) {
        try {
          const content = connectionsEntry.getData().toString('utf8');
          connectionsData = this.connectionImportService.parseCSV(content);
          this.logger.log(`Successfully extracted ${connectionsData.length} connections from ${connectionsEntry.entryName}`);
        } catch (e) {
          this.logger.warn(`Failed to parse connections CSV: ${connectionsEntry.entryName}`);
        }
      }
                               
      const connectionCount = connectionsData?.length || 0;

      if (connectionsData && userId && importId) {
        this.logger.log(`Found ${connectionsData.length} connections. Starting background processing for importId: ${importId}`);
        this.connectionImportService.processImportFile(importId, connectionsData)
          .then(() => this.logger.log(`Background processing completed for importId: ${importId}`))
          .catch(err => this.logger.error(`Failed to process connections for importId: ${importId}`, err));
      } else {
        this.logger.warn(`Skipping connection processing. connectionsData: ${!!connectionsData}, userId: ${!!userId}, importId: ${!!importId}`);
      }

      // 2. Extract Strategic Context
      const profileData = dataMap['Profile.csv'] || dataMap['profile/Profile.csv'];
      const positionsData = dataMap['Positions.csv'] || dataMap['profile/Positions.csv'];
      const skillsData = dataMap['Skills.csv'] || dataMap['profile/Skills.csv'];
      const messagesData = dataMap['Messages.csv'] || dataMap['profile/Messages.csv'];

      // 2.1 Get connection metadata (top companies/titles)
      const connectionMetadata = connectionsData ? {
        topCompanies: this.getTopFrequencies(connectionsData, 'Company'),
        topTitles: this.getTopFrequencies(connectionsData, 'Position'),
      } : undefined;

      const draft = await this.generateStrategicDraft(
        profileData, 
        positionsData, 
        skillsData, 
        messagesData,
        connectionMetadata
      );
      
      // 3. Persist Strategic Draft to Database (Only if authenticated)
      if (userId) {
        await this.persistStrategicDraft(userId, draft);
        await this.eventEmitter.emitAsync('linkedin.archive.fast-memory', {
          userId,
          importId,
          profileSummary: profileData?.[0]?.Summary || profileData?.[0]?.['About Me'] || undefined,
          headline: profileData?.[0]?.Headline || undefined,
          connectionCount,
          topCompanies: connectionMetadata?.topCompanies || [],
          topTitles: connectionMetadata?.topTitles || [],
        });
        
        // 4. SHRED THE RAW CONTENT: Turn profile and positions into Concepts/ProofPoints
        this.logger.log(`Emitting linkedin.ingested event for user: ${userId}`);
        this.eventEmitter.emit('linkedin.ingested', {
          userId,
          importId: importId || 'linkedin_profile',
          about: profileData?.[0]?.Summary || '',
          headline: profileData?.[0]?.Headline || '',
          positions: positionsData?.map(p => ({
            title: p.Title,
            company: p.Company,
            description: p.Description || ''
          }))
        });
      }
      
      return {
        ...draft,
        connectionCount,
        networkTopography: connectionMetadata
      };
    } catch (error) {
      this.logger.error('Failed to process LinkedIn ZIP archive', error);
      throw new Error(`Failed to process ZIP archive: ${error instanceof Error ? error.message : 'Invalid ZIP file'}`);
    }
  }

  private async generateStrategicDraft(
    profile?: any[],
    positions?: any[],
    skills?: any[],
    messages?: any[],
    network?: { topCompanies: string[]; topTitles: string[] }
  ): Promise<StrategicDraft> {
    const summary = profile?.[0]?.Summary || profile?.[0]?.['About Me'] || 'No summary available';
    const headline = profile?.[0]?.Headline || 'Professional';
    const experience = positions?.slice(0, 5).map(p => `- ${p.Title} at ${p.Company || p['Company Name']}`).join('\n') || 'No experience data';
    const skillsList = skills?.map(s => s.Name || s.NameRaw).slice(0, 15).join(', ') || 'No skills listed';
    
    // Sample messages to find tone and active topics
    const recentMessages = messages?.slice(0, 20).map(m => m.Content || m['Content']).filter(c => c && c.length > 20).slice(0, 5).join('\n---\n') || '';

    this.logger.log(`Synthesizing deep strategic draft with network metadata and message signal`);

    const prompt = `
You are a High-Signal Strategic Commander for "Opportunity OS." 
Your task is to analyze a professional's LinkedIn ZIP archive (Profile, Connections, and Messages) and architect a high-leverage strategic posture.

USER POSTURE:
- HEADLINE: ${headline}
- SUMMARY: ${summary}
- RECENT EXPERIENCE:
${experience}
- SKILLS: ${skillsList}

NETWORK TOPOGRAPHY:
- TOP COMPANIES IN NETWORK: ${network?.topCompanies.join(', ') || 'Unknown'}
- TOP TITLES IN NETWORK: ${network?.topTitles.join(', ') || 'Unknown'}

COMMUNICATION SIGNAL (Sample Messages):
${recentMessages || 'No message history available.'}

TASK:
1. Define a "Professional Posture": A persona that captures their seniority, intellectual property, and specific network leverage.
2. Identify 3 "Offerings": High-value products or services they can deploy (Consulting, Books, Software, etc.).
3. Identify 3 "Strategic Theses": The fundamental "physics" of their success.
4. explain the "Leverage": How exactly does their network (the companies/titles above) create a shortcut for these offerings?

OUTPUT FORMAT (JSON ONLY):
{
  "posture": {
    "text": "The persona description...",
    "objectives": ["Targeting [Industry] for [Value]"],
    "preferredTone": "Direct and authoritative"
  },
  "offerings": [
    { "title": "Offering Name", "description": "How it specifically weaponizes their network leverage (mentioning companies/roles)", "type": "consulting|service|book|software" }
  ],
  "theses": [
    { "title": "Thesis Title", "content": "The deep logic...", "tags": ["tag1"] }
  ]
}

Only return the JSON.
`.trim();

    try {
      const response = await this.aiService.generateText(prompt, {
        temperature: 0.3,
        maxTokens: 2500
      });

      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      
      parsed.offerings = parsed.offerings.map(o => ({
        ...o,
        type: this.mapOfferingType(o.type)
      }));

      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate strategic draft via AI', error);
      return this.getFallbackDraft(headline, summary);
    }
  }

  private getTopFrequencies(data: any[], key: string, limit: number = 5): string[] {
    const counts: Record<string, number> = {};
    data.forEach(item => {
      // Handle both uppercase (CSV) and lowercase (Prisma) keys
      const val = item[key] || item[key.toLowerCase()];
      if (val && typeof val === 'string') {
        const cleaned = val.trim();
        if (cleaned) {
          counts[cleaned] = (counts[cleaned] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([val]) => val);
  }

  private isHighSignalLinkedInArchivePath(path: string): boolean {
    const lower = path.toLowerCase();
    return [
      'profile',
      'connections',
      'messages',
      'shares',
      'comments',
      'recommendations',
      'endorsements',
      'positions',
      'skills',
      'invitations',
      'jobs',
    ].some(token => lower.includes(token));
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
    if (t.includes('software') || t.includes('app')) return OfferingType.software;
    if (t.includes('book') || t.includes('course')) return OfferingType.book;
    if (t.includes('service') || t.includes('agency')) return OfferingType.service;
    if (t.includes('consulting')) return OfferingType.consulting;
    if (t.includes('advisory')) return OfferingType.advisory_program;
    return OfferingType.other;
  }

  private getFallbackDraft(headline: string, summary: string): StrategicDraft {
    return {
      posture: {
        text: `${headline}. Experienced professional with focus on ${summary.slice(0, 50)}...`,
        objectives: ['Expand network leverage', 'Identify new opportunities'],
        preferredTone: 'Professional'
      },
      offerings: [
        { title: 'Strategic Advisory', description: 'High-level consulting based on experience', type: OfferingType.consulting }
      ],
      theses: [
        { title: 'The Network Inversion', content: 'Leveraging existing relationships for new growth', tags: ['strategy'] }
      ]
    };
  }
}
