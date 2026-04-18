import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ActivityType,
  CompanyType,
  DiscoveredOpportunity,
  OpportunityStage,
  OpportunityType,
  TaskPriority,
  prisma,
} from '@opportunity-os/db';
import { AiService } from '../ai/ai.service';
import { ExecuteContentOpportunityDto } from './dto/execute-content-opportunity.dto';
import {
  ExecuteContentOpportunityResponseDto,
  ExecutedTargetDto,
} from './dto/execute-content-opportunity-response.dto';
import { ContentUploadResponseDto } from './dto/content-upload-response.dto';
import { UploadContentDto } from './dto/upload-content.dto';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(private readonly aiService: AiService) {}

  async listContent(userId: string) {
    const contentItems = await prisma.discoveredOpportunity.findMany({
      where: {
        searchRun: {
          searchProfile: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 25,
    });

    return contentItems.map((item) => ({
      id: item.id,
      title: item.title,
      source: item.sourceUrl || item.sourceType,
      summary: item.aiSummary || item.descriptionRaw || '',
      linkedOfferingName: item.suggestedPositioningProfile || null,
      campaignPotential: item.suggestedAction || item.aiSummary || 'Review this content for outreach potential.',
      lifecycleStatus: item.lifecycleStatus,
      fitScore: item.fitScore,
      priorityScore: item.priorityScore,
    }));
  }

  async uploadContent(
    userId: string,
    file: { mimetype: string; originalname: string; buffer: Buffer },
    dto: UploadContentDto,
  ): Promise<ContentUploadResponseDto> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF uploads are supported in V1');
    }

    const { offeringId, title, source, notes } = dto;
    await this.ensureUserExists(userId);
    await this.ensureOfferingOwnership(userId, offeringId);

    const extractedText = await this.extractTextFromPDF(file);
    const contentHash = this.computeContentHash(file.buffer);
    const normalizedTitle = title?.trim() || file.originalname.replace(/\.pdf$/i, '');
    const normalizedSource = source?.trim();
    const inferredContentUrl = this.normalizeUrl(normalizedSource);

    const searchProfile = await this.ensureContentSearchProfile(userId);
    const searchRun = await prisma.searchRun.create({
      data: {
        searchProfileId: searchProfile.id,
        startedAt: new Date(),
        completedAt: new Date(),
        status: 'completed',
        resultCount: 1,
        highPriorityCount: 1,
      },
    });

    const existingUpload = await prisma.discoveredOpportunity.findFirst({
      where: {
        searchRun: {
          searchProfile: {
            userId,
          },
        },
        rawExternalId: `upload-sha256:${contentHash}`,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existingUpload) {
      return this.buildUploadResponse(existingUpload, normalizedSource, offeringId);
    }

    const aiResult = await this.generateContentInterpretation(extractedText, normalizedTitle, normalizedSource, notes);

    const discoveredOpportunity = await prisma.discoveredOpportunity.create({
      data: {
        searchRunId: searchRun.id,
        sourceType: 'content_upload',
        sourceUrl: inferredContentUrl || normalizedSource || null,
        rawExternalId: `upload-sha256:${contentHash}`,
        title: normalizedTitle,
        companyNameRaw: offeringId || undefined,
        descriptionRaw: extractedText,
        aiSummary: this.combineInterpretation(aiResult.summary, aiResult.whyItMatters, aiResult.leverageInterpretation),
        suggestedAction: offeringId
          ? `Review this content for offering ${offeringId} and decide how to use it in outreach or positioning`
          : 'Review this content and decide how to use it in outreach or positioning',
        suggestedPositioningProfile: offeringId || null,
        fitScore: aiResult.succeeded ? 80 : 60,
        priorityScore: offeringId ? 85 : 70,
      },
    });

    return this.buildUploadResponse(discoveredOpportunity, normalizedSource, offeringId, aiResult);
  }

  async executeContentOpportunity(
    userId: string,
    contentOpportunityId: string,
    dto: ExecuteContentOpportunityDto,
  ): Promise<ExecuteContentOpportunityResponseDto> {
    const discoveredOpportunity = await prisma.discoveredOpportunity.findFirst({
      where: {
        id: contentOpportunityId,
        searchRun: {
          searchProfile: {
            userId,
          },
        },
      },
    });

    if (!discoveredOpportunity) {
      throw new NotFoundException('Content opportunity not found');
    }

    const existingTargets = await this.findExistingExecutionTargets(userId, discoveredOpportunity.id);
    if (existingTargets.length > 0) {
      return {
        contentOpportunityId: discoveredOpportunity.id,
        discoveredItemId: discoveredOpportunity.id,
        offeringId: discoveredOpportunity.suggestedPositioningProfile || undefined,
        executed: true,
        targetCount: existingTargets.length,
        targets: existingTargets,
      };
    }

    const contentText = discoveredOpportunity.descriptionRaw?.trim();
    if (!contentText) {
      throw new BadRequestException('Content opportunity has no extracted text to operationalize');
    }

    const maxTargets = dto.maxTargets ?? 3;
    const extractedTargets = await this.extractOutreachTargets(
      discoveredOpportunity.title,
      contentText,
      discoveredOpportunity.suggestedPositioningProfile || undefined,
      maxTargets,
    );

    if (extractedTargets.length === 0) {
      const fallbackTarget = this.buildFallbackExecutionTarget(discoveredOpportunity);
      if (fallbackTarget) {
        extractedTargets.push(fallbackTarget);
      }
    }

    if (extractedTargets.length === 0) {
      throw new BadRequestException('No outreach targets could be derived from this content opportunity');
    }

    const executedTargets: ExecutedTargetDto[] = [];

    for (const target of extractedTargets) {
      const company = await this.findOrCreateCompany(userId, target.companyName);
      const person = await this.findOrCreatePerson(userId, company.id, target);

      const opportunity = await prisma.opportunity.create({
        data: {
          userId,
          companyId: company.id,
          primaryPersonId: person.id,
          title: `Reach out: ${person.fullName} re ${discoveredOpportunity.title}`,
          opportunityType: OpportunityType.networking,
          stage: OpportunityStage.targeted,
          source: `content_opportunity:${discoveredOpportunity.id}`,
          priority: 'high',
          summary: target.reasonForOutreach,
          nextAction: `Draft outreach using angle: ${target.suggestedAngle}`,
          nextActionDate: new Date(),
        },
      });

      const task = await prisma.task.create({
        data: {
          userId,
          opportunityId: opportunity.id,
          companyId: company.id,
          personId: person.id,
          title: `Draft outreach to ${person.fullName}`,
          description: [
            `ContentOpportunity:${discoveredOpportunity.id}`,
            `Angle: ${target.suggestedAngle}`,
            `Reason: ${target.reasonForOutreach}`,
          ].join('\n'),
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          priority: TaskPriority.high,
          taskType: 'content_outreach',
        },
      });

      const activity = await prisma.activity.create({
        data: {
          userId,
          opportunityId: opportunity.id,
          companyId: company.id,
          personId: person.id,
          activityType: ActivityType.note_event,
          subject: `Content-driven outreach package created for ${person.fullName}`,
          bodySummary: `Prepared outreach execution from content opportunity ${discoveredOpportunity.id}`,
          occurredAt: new Date(),
          metadataJson: {
            contentOpportunityId: discoveredOpportunity.id,
            suggestedAngle: target.suggestedAngle,
            reasonForOutreach: target.reasonForOutreach,
          },
        },
      });

      executedTargets.push({
        personId: person.id,
        fullName: person.fullName,
        companyId: company.id,
        companyName: company.name,
        opportunityId: opportunity.id,
        taskId: task.id,
        activityId: activity.id,
        reasonForOutreach: target.reasonForOutreach,
        suggestedAngle: target.suggestedAngle,
      });
    }

    await prisma.discoveredOpportunity.update({
      where: { id: discoveredOpportunity.id },
      data: {
        lifecycleStatus: 'reviewed',
        suggestedAction: 'Outreach execution package created from uploaded content',
      },
    });

    return {
      contentOpportunityId: discoveredOpportunity.id,
      discoveredItemId: discoveredOpportunity.id,
      offeringId: discoveredOpportunity.suggestedPositioningProfile || undefined,
      executed: true,
      targetCount: executedTargets.length,
      targets: executedTargets,
    };
  }

  private async buildUploadResponse(
    discoveredOpportunity: DiscoveredOpportunity,
    source?: string,
    offeringId?: string,
    aiResult?: {
      summary: string;
      whyItMatters: string;
      leverageInterpretation: string;
      succeeded: boolean;
    },
  ): Promise<ContentUploadResponseDto> {
    const contentText = discoveredOpportunity.descriptionRaw || '';
    const interpretation =
      aiResult ||
      (contentText
        ? await this.generateContentInterpretation(contentText, discoveredOpportunity.title, source)
        : {
            summary: undefined,
            whyItMatters: undefined,
            leverageInterpretation: undefined,
            succeeded: false,
          });

    return {
      discoveredItemId: discoveredOpportunity.id,
      contentOpportunityId: discoveredOpportunity.id,
      title: discoveredOpportunity.title,
      source,
      offeringId: offeringId || discoveredOpportunity.suggestedPositioningProfile || undefined,
      summary: interpretation.summary,
      whyItMatters: interpretation.whyItMatters,
      leverageInterpretation: interpretation.leverageInterpretation,
      aiInterpretationSucceeded: interpretation.succeeded,
      processingStatus: interpretation.succeeded ? 'classified' : 'pending',
    };
  }

  private async extractTextFromPDF(file: { buffer: Buffer }): Promise<string> {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: file.buffer });
      const data = await parser.getText();
      if (!data.text?.trim()) {
        throw new Error('No extractable text found in PDF');
      }
      return data.text.trim();
    } catch (error) {
      this.logger.error('Failed to extract text from PDF', error);
      throw new BadRequestException('PDF text extraction failed');
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }
  }

  private computeContentHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found for discovery ingestion');
    }
  }

  private async ensureOfferingOwnership(userId: string, offeringId?: string): Promise<void> {
    if (!offeringId) {
      return;
    }

    const offering = await prisma.offering.findFirst({
      where: { id: offeringId, userId },
      select: { id: true },
    });

    if (!offering) {
      throw new NotFoundException('Offering not found for current user');
    }
  }

  private async ensureContentSearchProfile(userId: string) {
    const existing = await prisma.searchProfile.findFirst({
      where: {
        userId,
        name: 'Manual Content Uploads',
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.searchProfile.create({
      data: {
        userId,
        name: 'Manual Content Uploads',
        searchProfileType: 'mixed',
        queryText: 'manual-content',
        isActive: true,
      },
    });
  }

  private async generateContentInterpretation(
    extractedText: string,
    title: string,
    source?: string,
    notes?: string,
  ): Promise<{
    summary: string;
    whyItMatters: string;
    leverageInterpretation: string;
    succeeded: boolean;
  }> {
    const fallbackSummary = this.buildFallbackSummary(extractedText);
    const fallbackWhyItMatters = 'Useful as positioning support and outreach leverage for active offerings.';
    const fallbackLeverage =
      'Reference this content in positioning, use it in prospect conversations, and create derivative commentary for outreach.';

    const prompt = `
You are helping an offering-aware opportunity operating system interpret uploaded external content.

Title: ${title}
Source: ${source || 'Unknown'}
Notes: ${notes || 'None'}

Extracted content:
${extractedText.slice(0, 12000)}

Return strict JSON with keys:
- summary: concise 2-4 sentence summary
- whyItMatters: why this matters commercially or strategically for an offering-driven workflow
- leverageInterpretation: practical ways to use this content in positioning, outreach, or opportunity development
`.trim();

    try {
      const aiResponse = await this.aiService.generateText(prompt, {
        temperature: 0.2,
        maxTokens: 700,
      });
      const parsed = this.tryParseJson(aiResponse) ?? this.tryExtractStructuredFields(aiResponse);

      return {
        summary: this.asNonEmptyString(parsed?.['summary']) || fallbackSummary,
        whyItMatters: this.asNonEmptyString(parsed?.['whyItMatters']) || fallbackWhyItMatters,
        leverageInterpretation:
          this.asNonEmptyString(parsed?.['leverageInterpretation']) || fallbackLeverage,
        succeeded: !!parsed,
      };
    } catch (error) {
      this.logger.warn(
        `AI interpretation failed for content upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        summary: fallbackSummary,
        whyItMatters: fallbackWhyItMatters,
        leverageInterpretation: fallbackLeverage,
        succeeded: false,
      };
    }
  }

  private combineInterpretation(summary?: string, whyItMatters?: string, leverageInterpretation?: string): string {
    return [summary, whyItMatters, leverageInterpretation].filter(Boolean).join('\n\n');
  }

  private tryParseJson(value: string): Record<string, unknown> | null {
    try {
      return JSON.parse(value);
    } catch {
      const match = value.match(/\{[\s\S]*\}/);
      if (!match) {
        return null;
      }

      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  private tryExtractStructuredFields(value: string): Record<string, unknown> | null {
    const normalized = value
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const summary = this.extractQuotedField(normalized, 'summary', 'whyItMatters');
    const whyItMatters = this.extractQuotedField(normalized, 'whyItMatters', 'leverageInterpretation');
    const leverageInterpretation = this.extractLastQuotedField(normalized, 'leverageInterpretation');

    if (!summary || !whyItMatters || !leverageInterpretation) {
      return null;
    }

    return {
      summary,
      whyItMatters,
      leverageInterpretation,
    };
  }

  private extractQuotedField(value: string, field: string, nextField: string): string | null {
    const pattern = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"${nextField}"`, 'i');
    const match = value.match(pattern);
    return this.decodeJsonLikeString(match?.[1]);
  }

  private extractLastQuotedField(value: string, field: string): string | null {
    const pattern = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*}\\s*$`, 'i');
    const match = value.match(pattern);
    return this.decodeJsonLikeString(match?.[1]);
  }

  private decodeJsonLikeString(value?: string): string | null {
    if (!value) {
      return null;
    }

    const normalized = value
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\r/g, '')
      .trim();

    return normalized || null;
  }

  private async extractOutreachTargets(
    title: string,
    contentText: string,
    offeringTitle?: string,
    maxTargets = 3,
  ): Promise<Array<{
    fullName: string;
    title?: string;
    companyName: string;
    reasonForOutreach: string;
    suggestedAngle: string;
  }>> {
    const prompt = `
You are identifying outreach targets associated with a piece of external content.

Content title: ${title}
Active offering: ${offeringTitle || 'None provided'}

Return strict JSON in this shape:
{
  "targets": [
    {
      "fullName": "person name",
      "title": "role or title",
      "companyName": "organization name",
      "reasonForOutreach": "why this person is strategically relevant",
      "suggestedAngle": "specific outreach angle tied to the content and offering"
    }
  ]
}

Rules:
- Return at most ${maxTargets} targets.
- Prefer executives, quoted experts, interviewees, authors, publishers, or sponsoring organizations clearly associated with the content.
- Do not invent email addresses or contact details.
- Only include targets with a clear connection to the content.

Content:
${contentText.slice(0, 12000)}
    `.trim();

    try {
      const response = await this.aiService.generateText(prompt, {
        temperature: 0.2,
        maxTokens: 900,
      });

      const parsed = this.tryParseJson(response) ?? this.tryParseCodeFenceJson(response);
      const rawTargets = Array.isArray(parsed?.['targets']) ? parsed['targets'] : [];
      const normalizedTargets = rawTargets
        .map((target) => this.normalizeTarget(target))
        .filter((target): target is NonNullable<typeof target> => !!target)
        .slice(0, maxTargets);

      const fallbackTargets = this.extractAcknowledgedPeopleTargets(contentText, offeringTitle, maxTargets);
      const mergedTargets = [...normalizedTargets];
      for (const fallbackTarget of fallbackTargets) {
        const alreadyIncluded = mergedTargets.some(
          (target) =>
            target.fullName.localeCompare(fallbackTarget.fullName, undefined, { sensitivity: 'accent' }) === 0,
        );
        if (!alreadyIncluded) {
          mergedTargets.push(fallbackTarget);
        }
        if (mergedTargets.length >= maxTargets) {
          break;
        }
      }

      if (mergedTargets.length > 0) {
        return mergedTargets.slice(0, maxTargets);
      }
    } catch (error) {
      this.logger.warn(
        `Target extraction failed for content execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return this.extractAcknowledgedPeopleTargets(contentText, offeringTitle, maxTargets);
  }

  private buildFallbackExecutionTarget(discoveredOpportunity: DiscoveredOpportunity): {
    fullName: string;
    title?: string;
    companyName: string;
    reasonForOutreach: string;
    suggestedAngle: string;
  } | null {
    const companyName =
      this.asNonEmptyString(discoveredOpportunity.companyNameRaw) ||
      this.extractOrganizationFromUrl(discoveredOpportunity.sourceUrl) ||
      'Research Team';

    const reasonForOutreach =
      this.asNonEmptyString(discoveredOpportunity.aiSummary) ||
      this.asNonEmptyString(discoveredOpportunity.suggestedAction) ||
      `This content item appears strategically relevant to ${companyName}.`;

    const suggestedAngle =
      this.asNonEmptyString(discoveredOpportunity.suggestedAction) ||
      `Use ${discoveredOpportunity.title} as a relevant hook for a consultative outreach conversation.`;

    return {
      fullName: `${companyName} Strategy Lead`,
      title: 'Strategy Lead',
      companyName,
      reasonForOutreach,
      suggestedAngle,
    };
  }

  private extractOrganizationFromUrl(url?: string | null): string | null {
    if (!url) {
      return null;
    }

    try {
      const hostname = new URL(url).hostname.replace(/^www\./i, '');
      const primary = hostname.split('.').filter(Boolean)[0];
      if (!primary) {
        return null;
      }

      return primary
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    } catch {
      return null;
    }
  }

  private tryParseCodeFenceJson(value: string): Record<string, unknown> | null {
    const match = value.match(/```json\s*([\s\S]*?)\s*```/i) || value.match(/```\s*([\s\S]*?)\s*```/i);
    if (!match?.[1]) {
      return null;
    }

    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  private normalizeTarget(target: unknown):
    | {
        fullName: string;
        title?: string;
        companyName: string;
        reasonForOutreach: string;
        suggestedAngle: string;
      }
    | null {
    if (!target || typeof target !== 'object') {
      return null;
    }

    const record = target as Record<string, unknown>;
    const fullName = this.asNonEmptyString(record['fullName']);
    let companyName = this.asNonEmptyString(record['companyName']);
    let title = this.asNonEmptyString(record['title']) || undefined;
    const reasonForOutreach = this.asNonEmptyString(record['reasonForOutreach']);
    const suggestedAngle = this.asNonEmptyString(record['suggestedAngle']);

    if (!fullName || !companyName || !reasonForOutreach || !suggestedAngle) {
      return null;
    }

    if (title?.includes(',') && !companyName.includes(',')) {
      const titleParts = title.split(',').map((part) => part.trim()).filter(Boolean);
      const trailingOrganization = titleParts.at(-1);
      if (
        trailingOrganization &&
        this.isLikelyOrganizationName(trailingOrganization) &&
        !this.isLikelyOrganizationName(companyName)
      ) {
        companyName = trailingOrganization;
        title = titleParts.slice(0, -1).join(', ') || undefined;
      }
    }

    if (!this.isLikelyPersonName(fullName) || !this.isLikelyOrganizationName(companyName)) {
      return null;
    }

    return {
      fullName,
      title,
      companyName,
      reasonForOutreach,
      suggestedAngle,
    };
  }

  private async findOrCreateCompany(userId: string, companyName: string) {
    const normalizedName = companyName.trim();
    const existing = await prisma.company.findFirst({
      where: {
        userId,
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.company.create({
      data: {
        userId,
        name: normalizedName,
        companyType: CompanyType.prospect,
      },
    });
  }

  private async findOrCreatePerson(
    userId: string,
    companyId: string,
    target: {
      fullName: string;
      title?: string;
      suggestedAngle: string;
    },
  ) {
    const existing = await prisma.person.findFirst({
      where: {
        userId,
        companyId,
        fullName: {
          equals: target.fullName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing;
    }

    const [firstName, ...rest] = target.fullName.split(' ');

    return prisma.person.create({
      data: {
        userId,
        companyId,
        fullName: target.fullName,
        firstName: firstName || null,
        lastName: rest.length > 0 ? rest.join(' ') : null,
        title: target.title,
        contactSource: 'content_opportunity_execution',
        notesSummary: target.suggestedAngle,
      },
    });
  }

  private async findExistingExecutionTargets(
    userId: string,
    contentOpportunityId: string,
  ): Promise<ExecutedTargetDto[]> {
    const marker = `ContentOpportunity:${contentOpportunityId}`;
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        taskType: 'content_outreach',
        description: {
          contains: marker,
        },
      },
      include: {
        person: true,
        company: true,
        opportunity: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (tasks.length === 0) {
      return [];
    }

    const activities = await prisma.activity.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return tasks
      .filter((task) => task.person && task.company && task.opportunity)
      .map((task) => {
        const activity = activities.find(
          (item) =>
            item.personId === task.personId &&
            item.opportunityId === task.opportunityId &&
            typeof item.metadataJson === 'object' &&
            item.metadataJson !== null &&
            (item.metadataJson as Record<string, unknown>)['contentOpportunityId'] === contentOpportunityId,
        );
        const reasonMatch = task.description?.match(/Reason:\s*([\s\S]*)$/);
        const angleMatch = task.description?.match(/Angle:\s*(.*)\nReason:/);

        return {
          personId: task.person!.id,
          fullName: task.person!.fullName,
          companyId: task.company!.id,
          companyName: task.company!.name,
          opportunityId: task.opportunity!.id,
          taskId: task.id,
          activityId: activity?.id || '',
          reasonForOutreach: reasonMatch?.[1]?.trim() || '',
          suggestedAngle: angleMatch?.[1]?.trim() || '',
        };
      });
  }

  private extractAcknowledgedPeopleTargets(
    contentText: string,
    offeringTitle?: string,
    maxTargets = 3,
  ): Array<{
    fullName: string;
    title?: string;
    companyName: string;
    reasonForOutreach: string;
    suggestedAngle: string;
  }> {
    const start = contentText.indexOf('We would like to thank');
    const end = contentText.indexOf('Methodology', start >= 0 ? start : 0);

    if (start < 0 || end < 0 || end <= start) {
      return [];
    }

    const section = contentText.slice(start, end);
    const lines = section
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1);

    const entries: string[] = [];
    for (const line of lines) {
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+,/.test(line)) {
        entries.push(line);
      } else if (entries.length > 0) {
        entries[entries.length - 1] = `${entries[entries.length - 1]} ${line}`;
      }
    }

    return entries.slice(0, maxTargets).map((entry) => {
      const firstComma = entry.indexOf(',');
      const lastComma = entry.lastIndexOf(',');
      const fullName = entry.slice(0, firstComma).trim();
      const title = entry.slice(firstComma + 1, lastComma).trim();
      const companyName = entry.slice(lastComma + 1).trim();

      return {
        fullName,
        title,
        companyName,
        reasonForOutreach: `${fullName} is directly associated with the report and can provide a credible perspective related to ${offeringTitle || 'the active offering'}.`,
        suggestedAngle: `Reference the report and open a conversation about how ${offeringTitle || 'your offering'} connects to the changes discussed there.`,
      };
    });
  }

  private isLikelyPersonName(value: string): boolean {
    return /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,4}$/.test(value.trim());
  }

  private isLikelyOrganizationName(value: string): boolean {
    const normalized = value.trim();
    if (!normalized || normalized.length < 2) {
      return false;
    }

    const roleMarkers =
      /\b(chief|officer|director|manager|engineer|architect|professor|distinguished|partner|portfolio)\b/i;

    return !roleMarkers.test(normalized);
  }

  private asNonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private buildFallbackSummary(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return 'No summary available.';
    }
    return normalized.slice(0, 280) + (normalized.length > 280 ? '...' : '');
  }

  private normalizeUrl(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const normalized = value.match(/^https?:\/\//i) ? value : `https://${value}`;
      return new URL(normalized).toString();
    } catch {
      return undefined;
    }
  }
}
