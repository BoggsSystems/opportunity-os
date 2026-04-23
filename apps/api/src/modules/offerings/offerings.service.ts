import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AIConversationPurpose,
  Offering,
  OfferingAsset,
  OfferingPositioning,
  OfferingProposalStatus,
  OfferingStatus,
  OfferingType,
  Prisma,
  PrismaClient,
} from '@opportunity-os/db';
import { AiService } from '../ai/ai.service';
import { CreateOfferingProposalDto } from './dto/create-offering-proposal.dto';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingProposalDto } from './dto/update-offering-proposal.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

const prisma = new PrismaClient();

@Injectable()
export class OfferingsService {
  constructor(private readonly aiService: AiService) {}

  async create(createOfferingDto: CreateOfferingDto, userId: string): Promise<Offering> {
    return prisma.offering.create({
      data: {
        ...createOfferingDto,
        userId,
      },
    });
  }

  async findAll(userId: string): Promise<Offering[]> {
    return prisma.offering.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Offering> {
    const offering = await prisma.offering.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!offering) {
      throw new NotFoundException('Offering not found');
    }

    return offering;
  }

  async update(id: string, updateOfferingDto: UpdateOfferingDto, userId: string): Promise<Offering> {
    // First check if offering exists and belongs to user
    await this.findOne(id, userId);

    return prisma.offering.update({
      where: { id },
      data: updateOfferingDto,
    });
  }

  async findPositionings(offeringId: string, userId: string): Promise<OfferingPositioning[]> {
    // Verify offering belongs to user
    await this.findOne(offeringId, userId);

    return prisma.offeringPositioning.findMany({
      where: {
        offeringId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findAssets(offeringId: string, userId: string): Promise<OfferingAsset[]> {
    // Verify offering belongs to user
    await this.findOne(offeringId, userId);

    return prisma.offeringAsset.findMany({
      where: {
        offeringId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createProposal(userId: string, dto: CreateOfferingProposalDto) {
    if (dto.aiConversationId) {
      await this.assertConversationOwned(userId, dto.aiConversationId);
      await prisma.offeringProposal.updateMany({
        where: {
          userId,
          aiConversationId: dto.aiConversationId,
          status: OfferingProposalStatus.proposed,
        },
        data: {
          status: OfferingProposalStatus.superseded,
          supersededAt: new Date(),
        },
      });
    }

    return prisma.offeringProposal.create({
      data: {
        userId,
        aiConversationId: dto.aiConversationId,
        title: dto.title,
        description: dto.description,
        offeringType: dto.offeringType,
        targetAudiencesJson: this.toJsonOrNull(dto.targetAudiences),
        problemSolved: dto.problemSolved,
        outcomeCreated: dto.outcomeCreated,
        credibility: dto.credibility,
        bestOutreachAngle: dto.bestOutreachAngle,
        suggestedAssetsJson: this.toJsonOrNull(dto.suggestedAssets),
        positioningJson: this.toJsonOrNull(dto.positioning),
        metadataJson: this.toJsonOrNull(dto.metadata),
      },
    });
  }

  async createProposalFromConversation(userId: string, sessionId: string) {
    await this.assertConversationOwned(userId, sessionId);
    const messages = await prisma.aIConversationMessage.findMany({
      where: { conversationId: sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    const transcript = messages.map((message) => `${message.messageType}: ${message.content}`).join('\n');
    const proposal = await this.extractOfferingProposal(transcript);
    return this.createProposal(userId, {
      ...proposal,
      aiConversationId: sessionId,
      metadata: {
        source: 'ai_conversation',
        sessionId,
      },
    });
  }

  async findProposals(userId: string) {
    return prisma.offeringProposal.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async findPendingProposal(userId: string) {
    return prisma.offeringProposal.findFirst({
      where: {
        userId,
        status: OfferingProposalStatus.proposed,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findProposal(id: string, userId: string) {
    const proposal = await prisma.offeringProposal.findFirst({
      where: { id, userId },
    });
    if (!proposal) {
      throw new NotFoundException('Offering proposal not found');
    }
    return proposal;
  }

  async updateProposal(id: string, userId: string, dto: UpdateOfferingProposalDto) {
    await this.findProposal(id, userId);

    return prisma.offeringProposal.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        offeringType: dto.offeringType,
        targetAudiencesJson: this.toJsonOrUndefined(dto.targetAudiences),
        problemSolved: dto.problemSolved,
        outcomeCreated: dto.outcomeCreated,
        credibility: dto.credibility,
        bestOutreachAngle: dto.bestOutreachAngle,
        suggestedAssetsJson: this.toJsonOrUndefined(dto.suggestedAssets),
        positioningJson: this.toJsonOrUndefined(dto.positioning),
        metadataJson: this.toJsonOrUndefined(dto.metadata),
      },
    });
  }

  async confirmProposal(id: string, userId: string, dto: UpdateOfferingProposalDto = {}) {
    const existing = await this.findProposal(id, userId);
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const proposal =
        Object.keys(dto).length > 0
          ? await tx.offeringProposal.update({
              where: { id: existing.id },
              data: {
                title: dto.title,
                description: dto.description,
                offeringType: dto.offeringType,
                targetAudiencesJson: this.toJsonOrUndefined(dto.targetAudiences),
                problemSolved: dto.problemSolved,
                outcomeCreated: dto.outcomeCreated,
                credibility: dto.credibility,
                bestOutreachAngle: dto.bestOutreachAngle,
                suggestedAssetsJson: this.toJsonOrUndefined(dto.suggestedAssets),
                positioningJson: this.toJsonOrUndefined(dto.positioning),
                metadataJson: this.toJsonOrUndefined(dto.metadata),
              },
            })
          : existing;

      if (proposal.confirmedOfferingId) {
        const offering = await tx.offering.findFirst({
          where: { id: proposal.confirmedOfferingId, userId },
        });
        return { proposal, offering };
      }

      const offering = await tx.offering.create({
        data: {
          userId,
          title: proposal.title,
          description: proposal.description,
          offeringType: proposal.offeringType,
          status: OfferingStatus.active,
        },
      });

      const positioningDescription = this.buildPositioningDescription(proposal);
      if (positioningDescription) {
        await tx.offeringPositioning.create({
          data: {
            offeringId: offering.id,
            title: 'Primary positioning',
            description: positioningDescription,
            status: 'active',
          },
        });
      }

      const confirmedProposal = await tx.offeringProposal.update({
        where: { id: proposal.id },
        data: {
          status: OfferingProposalStatus.confirmed,
          confirmedOfferingId: offering.id,
          confirmedAt: now,
        },
      });

      if (proposal.aiConversationId) {
        await tx.aIConversation.update({
          where: { id: proposal.aiConversationId },
          data: {
            offeringId: offering.id,
            purpose: AIConversationPurpose.offering_strategy,
          },
        });
      }

      return { proposal: confirmedProposal, offering };
    });
  }

  async rejectProposal(id: string, userId: string) {
    await this.findProposal(id, userId);

    return prisma.offeringProposal.update({
      where: { id },
      data: {
        status: OfferingProposalStatus.rejected,
        rejectedAt: new Date(),
      },
    });
  }

  async getActiveOfferingContext(userId: string) {
    return prisma.offering.findFirst({
      where: {
        userId,
        status: OfferingStatus.active,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        positionings: {
          orderBy: { updatedAt: 'desc' },
          take: 3,
        },
        assets: {
          orderBy: { updatedAt: 'desc' },
          take: 3,
        },
      },
    });
  }

  private async assertConversationOwned(userId: string, aiConversationId: string) {
    const conversation = await prisma.aIConversation.findFirst({
      where: { id: aiConversationId, userId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException('AI conversation not found');
    }
  }

  private async extractOfferingProposal(transcript: string): Promise<CreateOfferingProposalDto> {
    const prompt = `
Extract the user's offering from this Opportunity OS conversation.

Return only valid JSON with this structure:
{
  "title": "short offering name",
  "description": "1-2 sentence description",
  "offeringType": "product | service | consulting | job_profile | other",
  "targetAudiences": ["audience"],
  "problemSolved": "problem this offering solves",
  "outcomeCreated": "outcome it creates",
  "credibility": "why the user is credible",
  "bestOutreachAngle": "best first outreach angle",
  "suggestedAssets": ["asset that would help"],
  "positioning": { "primaryAngle": "short angle" }
}

Conversation:
${transcript || 'No transcript available.'}
`.trim();

    try {
      const response = await this.aiService.generateText(prompt, { temperature: 0.2, maxTokens: 700 });
      const parsed = JSON.parse(this.extractJsonPayload(response)) as Partial<CreateOfferingProposalDto>;
      return this.normalizeExtractedProposal(parsed, transcript);
    } catch {
      return this.fallbackProposal(transcript);
    }
  }

  private normalizeExtractedProposal(parsed: Partial<CreateOfferingProposalDto>, transcript: string): CreateOfferingProposalDto {
    return {
      title: parsed.title?.trim() || this.fallbackProposal(transcript).title,
      description: parsed.description?.trim() || this.fallbackProposal(transcript).description,
      offeringType: this.normalizeOfferingType(parsed.offeringType),
      targetAudiences: this.stringArray(parsed.targetAudiences),
      problemSolved: parsed.problemSolved?.trim(),
      outcomeCreated: parsed.outcomeCreated?.trim(),
      credibility: parsed.credibility?.trim(),
      bestOutreachAngle: parsed.bestOutreachAngle?.trim(),
      suggestedAssets: this.stringArray(parsed.suggestedAssets),
      positioning: parsed.positioning && typeof parsed.positioning === 'object' ? parsed.positioning : undefined,
    };
  }

  private fallbackProposal(transcript: string): CreateOfferingProposalDto {
    const lower = transcript.toLowerCase();
    const isBook = lower.includes('book');
    const isConsulting = lower.includes('consulting') || lower.includes('audit') || lower.includes('transformation');
    return {
      title: isBook ? 'AI-Native Software Engineering Book' : 'AI-Native SDLC Offering',
      description: isBook
        ? 'A book and related point of view about AI-native software engineering.'
        : 'A practical offering around AI-native software engineering and delivery transformation.',
      offeringType: isConsulting ? OfferingType.consulting : OfferingType.product,
      targetAudiences: lower.includes('professor') ? ['Software engineering professors'] : ['Software engineering leaders'],
      problemSolved: 'Helps the audience understand and act on the shift toward AI-native software engineering.',
      outcomeCreated: 'Creates a clearer path to adopting AI-native engineering practices.',
      credibility: 'Grounded in the user conversation, book, platform work, and software engineering background.',
      bestOutreachAngle: 'Lead with the book as a useful conversation asset.',
      suggestedAssets: ['Book excerpt or executive summary'],
      positioning: { primaryAngle: 'AI-native software engineering as a practical operating shift' },
    };
  }

  private normalizeOfferingType(value: unknown): OfferingType {
    if (typeof value === 'string' && Object.values(OfferingType).includes(value as OfferingType)) {
      return value as OfferingType;
    }
    return OfferingType.other;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private extractJsonPayload(content: string): string {
    const trimmed = content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced?.[1]) return fenced[1].trim();
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }
    return trimmed;
  }

  private buildPositioningDescription(proposal: {
    targetAudiencesJson: Prisma.JsonValue | null;
    problemSolved: string | null;
    outcomeCreated: string | null;
    bestOutreachAngle: string | null;
  }) {
    const parts = [
      this.stringArrayFromJson(proposal.targetAudiencesJson).length > 0
        ? `Audience: ${this.stringArrayFromJson(proposal.targetAudiencesJson).join(', ')}`
        : null,
      proposal.problemSolved ? `Problem: ${proposal.problemSolved}` : null,
      proposal.outcomeCreated ? `Outcome: ${proposal.outcomeCreated}` : null,
      proposal.bestOutreachAngle ? `Outreach angle: ${proposal.bestOutreachAngle}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join('\n') : null;
  }

  private stringArrayFromJson(value: Prisma.JsonValue | null): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private toJsonOrNull(value: unknown): Prisma.InputJsonValue | null {
    if (value === undefined || value === null) return null;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toJsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
