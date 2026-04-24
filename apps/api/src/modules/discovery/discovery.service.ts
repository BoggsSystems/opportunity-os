import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AssetCategory,
  CompanyType,
  DiscoveryScanStatus,
  DiscoveryScanType,
  DiscoveryTargetStatus,
  DiscoveryTargetType,
  OpportunityStage,
  OpportunityType,
  Prisma,
  prisma,
} from '@opportunity-os/db';
import { CreateDiscoveryScanDto } from './dto/create-discovery-scan.dto';
import { ContentUploadResponseDto } from './dto/content-upload-response.dto';
import { ExecuteContentOpportunityDto } from './dto/execute-content-opportunity.dto';
import { UploadContentDto } from './dto/upload-content.dto';
import {
  DiscoveryExistingMatch,
  DiscoveryProvider,
  DiscoveryProviderTarget,
} from './providers/discovery-provider.interface';
import { OpenAiDiscoveryProvider } from './providers/openai-discovery.provider';
import { TavilyDiscoveryProvider } from './providers/tavily-discovery.provider';
import { PerplexityDiscoveryProvider } from './providers/perplexity-discovery.provider';
import { ApolloDiscoveryProvider } from './providers/apollo-discovery.provider';
import { AiService } from '../ai/ai.service';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly openAiDiscoveryProvider: OpenAiDiscoveryProvider,
    private readonly tavilyDiscoveryProvider: TavilyDiscoveryProvider,
    private readonly perplexityDiscoveryProvider: PerplexityDiscoveryProvider,
    private readonly apolloDiscoveryProvider: ApolloDiscoveryProvider,
    private readonly aiService: AiService,
  ) {}

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

    // Dynamic interpretation based on active context
    const context = await this.resolveScanContext(userId, { offeringId: body.offeringId });
    const whyItMatters = await this.aiService.interpretDiscoveryRelevance(extractedText, {
      goalTitle: context.goal?.title || 'General business growth',
      campaignTitle: context.campaign?.title,
      targetSegment: context.targetSegment,
    });

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
      whyItMatters,
      leverageInterpretation: whyItMatters,
      aiInterpretationSucceeded: true,
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

  async createScan(userId: string, dto: CreateDiscoveryScanDto) {
    const context = await this.resolveScanContext(userId, dto);
    
    // Strengthen the intent: If the query is generic, use AI to refine it based on context
    let query = dto.query?.trim();
    if (!query || query.length < 10 || query.includes('relevant prospects')) {
      query = await this.aiService.generateDiscoveryQuery({
        offering: context.offering,
        campaign: context.campaign,
        goal: context.goal,
        targetSegment: dto.targetSegment || context.targetSegment,
      });
    }

    const providerKeys = this.resolveProviderKeys(dto);
    const scan = await prisma.discoveryScan.create({
      data: {
        userId,
        offeringId: context.offeringId,
        campaignId: context.campaignId,
        goalId: context.goalId,
        query,
        scanType: (dto.scanType ?? 'mixed') as DiscoveryScanType,
        providerKey: providerKeys[0] ?? 'tavily',
        providerKeys,
        targetSegment: dto.targetSegment?.trim() || context.targetSegment,
        maxTargets: dto.maxTargets ?? 10,
        requestContextJson: this.toJson({
          ...(dto.context ?? {}),
          offering: context.offering,
          campaign: context.campaign,
          goal: context.goal,
        }),
      },
    });

    return this.runScan(userId, scan.id);
  }

  async runScan(userId: string, scanId: string) {
    const scan = await this.findScan(userId, scanId);
    const providerKeys = this.resolveProviderKeys({
      providerKey: scan.providerKey,
      providerKeys: scan.providerKeys ?? [],
    });

    await prisma.discoveryScan.update({
      where: { id: scan.id },
      data: {
        status: DiscoveryScanStatus.running,
        startedAt: new Date(),
        failureReason: null,
        failedAt: null,
      },
    });

    try {
      const providerResults = [];
      for (const providerKey of providerKeys) {
        const provider = this.providerFor(providerKey);
        if (!provider) continue;

        const providerRun = await prisma.discoveryProviderRun.create({
          data: {
            discoveryScanId: scan.id,
            providerKey,
            status: DiscoveryScanStatus.running,
            query: scan.query,
            requestJson: this.toJson({
              scanType: scan.scanType,
              targetSegment: scan.targetSegment ?? undefined,
              maxTargets: scan.maxTargets,
              context: (scan.requestContextJson as Record<string, unknown>) ?? {},
            }),
            startedAt: new Date(),
          },
        });

        try {
          const result = await provider.discover({
            userId,
            query: scan.query,
            scanType: scan.scanType,
            targetSegment: scan.targetSegment ?? undefined,
            maxTargets: scan.maxTargets,
            context: (scan.requestContextJson as Record<string, unknown>) ?? {},
          });

          await prisma.discoveryProviderRun.update({
            where: { id: providerRun.id },
            data: {
              status: DiscoveryScanStatus.completed,
              completedAt: new Date(),
              rawTargetCount: result.targets.length,
              normalizedTargetCount: result.targets.length,
              resultJson: this.toJson(result.metadata),
            },
          });

          providerResults.push(result);
        } catch (error) {
          await prisma.discoveryProviderRun.update({
            where: { id: providerRun.id },
            data: {
              status: DiscoveryScanStatus.failed,
              failedAt: new Date(),
              failureReason: error instanceof Error ? error.message : 'Provider discovery failed',
            },
          });
        }
      }

      const consolidatedTargets = this.consolidateTargets(providerResults);
      
      // Waterfall Enrichment: If any targets lack emails/LinkedIn, try Apollo
      const enrichedTargets = await this.enrichTargetsWithApollo(consolidatedTargets);

      const createdTargets = [];
      for (const target of enrichedTargets) {
        const dedupeKey = this.buildDedupeKey(userId, target);
        const existingTarget = await prisma.discoveryTarget.findFirst({
          where: { userId, dedupeKey, status: { not: DiscoveryTargetStatus.archived } },
          select: { id: true, status: true, companyId: true, personId: true, opportunityId: true },
        });
        const existingMatch = await this.matchExistingRecords(userId, target, existingTarget?.id);
        const metadata = {
          ...(target.metadata ?? {}),
          providerKeys: this.providerKeysFromTarget(target),
          existingMatch,
          duplicateDiscoveryTargetId: existingTarget?.id,
        };

        const created = await prisma.discoveryTarget.create({
          data: {
            userId,
            scanId: scan.id,
            targetType: target.targetType,
            status: existingTarget ? DiscoveryTargetStatus.duplicate : DiscoveryTargetStatus.proposed,
            title: target.title,
            companyName: target.companyName,
            personName: target.personName,
            roleTitle: target.roleTitle,
            email: target.email,
            phone: target.phone,
            website: target.website,
            linkedinUrl: target.linkedinUrl,
            location: target.location,
            sourceUrl: target.sourceUrl,
            dedupeKey,
            confidenceScore: target.confidenceScore,
            relevanceScore: target.relevanceScore,
            qualificationScore: target.qualificationScore,
            whyThisTarget: this.decorateWhyThisTarget(target.whyThisTarget, existingMatch),
            recommendedAction: this.decorateRecommendedAction(target.recommendedAction, existingMatch),
            metadataJson: this.toJson(metadata),
            evidence: {
              create: target.evidence.map((evidence) => ({
                evidenceType: evidence.evidenceType,
                title: evidence.title,
                sourceUrl: evidence.sourceUrl,
                sourceName: evidence.sourceName,
                snippet: evidence.snippet,
                confidenceScore: evidence.confidenceScore ?? target.confidenceScore,
                metadataJson: this.toJson(evidence.metadata),
              })),
            },
          },
          include: { evidence: true },
        });
        createdTargets.push(created);
      }

      const updatedScan = await prisma.discoveryScan.update({
        where: { id: scan.id },
        data: {
          status: DiscoveryScanStatus.completed,
          completedAt: new Date(),
          providerResultJson: this.toJson({
            providerKeys,
            providers: providerResults.map((result) => ({
              providerKey: result.providerKey,
              metadata: result.metadata,
              targetCount: result.targets.length,
            })),
            consolidatedTargetCount: consolidatedTargets.length,
          }),
        },
        include: this.scanInclude(),
      });

      await this.createScanSignal(userId, updatedScan);

      return {
        scan: this.toScanSummary(updatedScan),
        targets: createdTargets.map((target) => this.toTargetSummary(target)),
      };
    } catch (error) {
      await prisma.discoveryScan.update({
        where: { id: scan.id },
        data: {
          status: DiscoveryScanStatus.failed,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Discovery scan failed',
        },
      });
      throw error;
    }
  }

  async getScan(userId: string, scanId: string) {
    const scan = await prisma.discoveryScan.findFirst({
      where: { id: scanId, userId },
      include: this.scanInclude(),
    });
    if (!scan) {
      throw new NotFoundException('Discovery scan not found');
    }
    return this.toScanSummary(scan);
  }

  async listScans(userId: string, campaignId?: string) {
    const scans = await prisma.discoveryScan.findMany({
      where: {
        userId,
        ...(campaignId ? { campaignId } : {}),
      },
      include: this.scanInclude(),
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return scans.map((scan) => this.toScanSummary(scan));
  }

  async listTargets(userId: string, scanId: string) {
    await this.findScan(userId, scanId);
    const targets = await prisma.discoveryTarget.findMany({
      where: { userId, scanId },
      include: { evidence: true },
      orderBy: [{ status: 'asc' }, { relevanceScore: 'desc' }, { confidenceScore: 'desc' }],
    });
    return targets.map((target) => this.toTargetSummary(target));
  }

  async acceptTarget(userId: string, targetId: string) {
    const target = await this.findTarget(userId, targetId);
    if (target.status === DiscoveryTargetStatus.promoted) {
      return { target: this.toTargetSummary(target), alreadyPromoted: true };
    }

    const updated = await prisma.discoveryTarget.update({
      where: { id: target.id },
      data: {
        status: DiscoveryTargetStatus.accepted,
        acceptedAt: target.acceptedAt ?? new Date(),
        rejectedAt: null,
        rejectionReason: null,
      },
      include: { evidence: true },
    });
    await this.refreshScanCounts(target.scanId);
    return { target: this.toTargetSummary(updated) };
  }

  async rejectTarget(userId: string, targetId: string, reason?: string) {
    const target = await this.findTarget(userId, targetId);
    const updated = await prisma.discoveryTarget.update({
      where: { id: target.id },
      data: {
        status: DiscoveryTargetStatus.rejected,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
      include: { evidence: true },
    });
    await this.refreshScanCounts(target.scanId);
    return { target: this.toTargetSummary(updated) };
  }

  async promoteAcceptedTargets(userId: string, scanId: string) {
    const scan = await this.findScan(userId, scanId);
    const targets = await prisma.discoveryTarget.findMany({
      where: {
        userId,
        scanId,
        status: DiscoveryTargetStatus.accepted,
      },
      include: { evidence: true },
      orderBy: [{ relevanceScore: 'desc' }, { confidenceScore: 'desc' }],
    });

    const promoted = [];
    for (const target of targets) {
      promoted.push(await this.promoteTarget(userId, scan, target));
    }

    await this.refreshScanCounts(scan.id);
    return { promoted: promoted.length, targets: promoted.map((target) => this.toTargetSummary(target)) };
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

  private async resolveScanContext(userId: string, dto: Partial<CreateDiscoveryScanDto>) {
    let campaign: any = null;
    if (dto.campaignId) {
      campaign = await prisma.campaign.findFirst({
        where: { id: dto.campaignId, userId },
        include: { offering: true, goal: true },
      });
      if (!campaign) {
        throw new NotFoundException('Campaign not found for discovery scan');
      }
    }

    let offering: any = campaign?.offering ?? null;
    if (dto.offeringId && !offering) {
      offering = await prisma.offering.findFirst({ where: { id: dto.offeringId, userId } });
      if (!offering) {
        throw new NotFoundException('Offering not found for discovery scan');
      }
    }

    let goal: any = campaign?.goal ?? null;
    if (dto.goalId && !goal) {
      goal = await prisma.goal.findFirst({ where: { id: dto.goalId, userId } });
      if (!goal) {
        throw new NotFoundException('Goal not found for discovery scan');
      }
    }

    return {
      offeringId: campaign?.offeringId ?? offering?.id ?? dto.offeringId,
      campaignId: campaign?.id ?? dto.campaignId,
      goalId: campaign?.goalId ?? goal?.id ?? dto.goalId,
      targetSegment: campaign?.targetSegment ?? undefined,
      offering: offering ? { id: offering.id, title: offering.title, description: offering.description } : undefined,
      campaign: campaign ? { id: campaign.id, title: campaign.title, targetSegment: campaign.targetSegment } : undefined,
      goal: goal ? { id: goal.id, title: goal.title } : undefined,
    };
  }

  private async findScan(userId: string, scanId: string) {
    const scan = await prisma.discoveryScan.findFirst({ where: { id: scanId, userId } });
    if (!scan) {
      throw new NotFoundException('Discovery scan not found');
    }
    return scan;
  }

  private async findTarget(userId: string, targetId: string) {
    const target = await prisma.discoveryTarget.findFirst({
      where: { id: targetId, userId },
      include: { evidence: true, scan: true },
    });
    if (!target) {
      throw new NotFoundException('Discovery target not found');
    }
    return target;
  }

  private providerFor(providerKey: string) {
    const providers = this.providers();
    return providers.get(providerKey) ?? null;
  }

  private async promoteTarget(userId: string, scan: any, target: any) {
    const company = await this.findOrCreateCompany(userId, target);
    const person = await this.findOrCreatePerson(userId, company.id, target);
    const opportunity = await prisma.opportunity.create({
      data: {
        userId,
        companyId: company.id,
        primaryPersonId: person?.id,
        campaignId: scan.campaignId,
        title: target.title,
        opportunityType: OpportunityType.consulting,
        stage: OpportunityStage.targeted,
        source: 'discovery_target',
        priority: target.relevanceScore >= 80 ? 'high' : 'medium',
        fitScore: target.relevanceScore,
        qualificationScore: target.qualificationScore ?? target.confidenceScore,
        summary: target.whyThisTarget,
        nextAction: target.recommendedAction ?? 'Draft outreach for this discovered target.',
      },
    });

    if (person) {
      await prisma.opportunityPerson.create({
        data: {
          opportunityId: opportunity.id,
          personId: person.id,
          roleInOpportunity: 'primary_contact',
        },
      }).catch(() => null);
    }

    return prisma.discoveryTarget.update({
      where: { id: target.id },
      data: {
        status: DiscoveryTargetStatus.promoted,
        promotedAt: new Date(),
        acceptedAt: target.acceptedAt ?? new Date(),
        companyId: company.id,
        personId: person?.id,
        opportunityId: opportunity.id,
      },
      include: { evidence: true },
    });
  }

  private async findOrCreateCompany(userId: string, target: any) {
    const name = target.companyName || target.title || 'Discovered company';
    const existing = await prisma.company.findFirst({
      where: {
        userId,
        OR: [
          { name },
          ...(target.website ? [{ website: target.website }] : []),
        ],
      },
    });
    if (existing) return existing;

    return prisma.company.create({
      data: {
        userId,
        name,
        website: target.website,
        linkedinUrl: target.targetType === DiscoveryTargetType.company ? target.linkedinUrl : undefined,
        geography: target.location,
        companyType: CompanyType.prospect,
        description: target.whyThisTarget,
      },
    });
  }

  private async findOrCreatePerson(userId: string, companyId: string, target: any) {
    if (!target.personName && !target.email) return null;
    const existing = await prisma.person.findFirst({
      where: {
        userId,
        OR: [
          ...(target.email ? [{ email: target.email }] : []),
          ...(target.personName ? [{ fullName: target.personName, companyId }] : []),
        ],
      },
    });
    if (existing) return existing;

    return prisma.person.create({
      data: {
        userId,
        companyId,
        fullName: target.personName ?? target.email,
        title: target.roleTitle,
        email: target.email,
        phone: target.phone,
        linkedinUrl: target.targetType !== DiscoveryTargetType.company ? target.linkedinUrl : undefined,
        location: target.location,
        contactSource: 'discovery_target',
        notesSummary: target.whyThisTarget,
      },
    });
  }

  private async createScanSignal(userId: string, scan: any) {
    const targetCount = scan.targets?.filter((target: any) => target.status === DiscoveryTargetStatus.proposed).length ?? 0;
    if (targetCount === 0) return;

    await prisma.workspaceSignal.create({
      data: {
        userId,
        sourceType: 'discovery_scan',
        sourceId: scan.id,
        title: `${targetCount} discovery targets ready for review`,
        summary: scan.query,
        importance: targetCount >= 5 ? 'high' : 'medium',
        status: 'surfaced',
        priorityScore: Math.min(95, 60 + targetCount * 5),
        reason: 'Discovery produced explainable targets that can be accepted into the campaign workflow.',
        recommendedAction: 'Review discovery targets and accept the strongest prospects.',
        recommendedWorkspaceMode: 'signal_review',
        evidenceJson: this.toJson({ scanId: scan.id, targetCount }),
        surfacedAt: new Date(),
      },
    });
  }

  private async refreshScanCounts(scanId: string) {
    const [acceptedCount, rejectedCount, promotedCount] = await Promise.all([
      prisma.discoveryTarget.count({ where: { scanId, status: DiscoveryTargetStatus.accepted } }),
      prisma.discoveryTarget.count({ where: { scanId, status: DiscoveryTargetStatus.rejected } }),
      prisma.discoveryTarget.count({ where: { scanId, status: DiscoveryTargetStatus.promoted } }),
    ]);

    await prisma.discoveryScan.update({
      where: { id: scanId },
      data: { acceptedCount, rejectedCount, promotedCount },
    });
  }

  private buildDedupeKey(userId: string, target: any) {
    const identity = target.email || target.linkedinUrl || target.website || `${target.companyName ?? ''}:${target.personName ?? ''}:${target.title}`;
    return `${userId}:${identity}`.toLowerCase().replace(/\s+/g, '-');
  }

  private scanInclude() {
    return {
      offering: { select: { id: true, title: true, description: true, offeringType: true } },
      campaign: { select: { id: true, title: true, targetSegment: true, offeringId: true, goalId: true } },
      goal: { select: { id: true, title: true, description: true } },
      providerRuns: { orderBy: [{ createdAt: 'asc' }] },
      targets: { include: { evidence: true }, orderBy: [{ relevanceScore: 'desc' }, { confidenceScore: 'desc' }] },
    } satisfies Prisma.DiscoveryScanInclude;
  }

  private toScanSummary(scan: any) {
    return {
      id: scan.id,
      query: scan.query,
      scanType: scan.scanType,
      status: scan.status,
      providerKey: scan.providerKey,
      providerKeys: scan.providerKeys ?? [],
      targetSegment: scan.targetSegment,
      maxTargets: scan.maxTargets,
      acceptedCount: scan.acceptedCount,
      rejectedCount: scan.rejectedCount,
      promotedCount: scan.promotedCount,
      targetCount: scan.targets?.length ?? 0,
      offeringId: scan.offeringId,
      campaignId: scan.campaignId,
      goalId: scan.goalId,
      offering: scan.offering,
      campaign: scan.campaign,
      goal: scan.goal,
      createdAt: scan.createdAt,
      updatedAt: scan.updatedAt,
      completedAt: scan.completedAt,
      failureReason: scan.failureReason,
      providerRuns: scan.providerRuns ?? [],
      targets: scan.targets?.map((target: any) => this.toTargetSummary(target)) ?? undefined,
    };
  }

  private toTargetSummary(target: any) {
    return {
      id: target.id,
      scanId: target.scanId,
      targetType: target.targetType,
      status: target.status,
      title: target.title,
      companyName: target.companyName,
      personName: target.personName,
      roleTitle: target.roleTitle,
      email: target.email,
      website: target.website,
      linkedinUrl: target.linkedinUrl,
      location: target.location,
      sourceUrl: target.sourceUrl,
      confidenceScore: target.confidenceScore,
      relevanceScore: target.relevanceScore,
      qualificationScore: target.qualificationScore,
      whyThisTarget: target.whyThisTarget,
      recommendedAction: target.recommendedAction,
      companyId: target.companyId,
      personId: target.personId,
      opportunityId: target.opportunityId,
      metadata: target.metadataJson ?? null,
      evidence: target.evidence ?? [],
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
  }

  private providers(): Map<string, DiscoveryProvider> {
    return new Map<string, DiscoveryProvider>([
      [this.openAiDiscoveryProvider.key, this.openAiDiscoveryProvider],
      [this.tavilyDiscoveryProvider.key, this.tavilyDiscoveryProvider],
      [this.perplexityDiscoveryProvider.key, this.perplexityDiscoveryProvider],
      [this.apolloDiscoveryProvider.key, this.apolloDiscoveryProvider],
    ]);
  }

  private resolveProviderKeys(input: { providerKey?: string | null; providerKeys?: string[] | null }): string[] {
    const requested = [
      ...(input.providerKeys ?? []),
      ...(input.providerKey ? [input.providerKey] : []),
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    if (requested.length > 0) {
      return Array.from(new Set(requested));
    }

    return Array.from(this.providers().keys());
  }

  private consolidateTargets(results: Array<{ providerKey: string; targets: DiscoveryProviderTarget[] }>): DiscoveryProviderTarget[] {
    const map = new Map<string, DiscoveryProviderTarget>();

    for (const result of results) {
      for (const target of result.targets) {
        const key = this.targetIdentityKey(target);
        const existing = map.get(key);
        const enrichedTarget: DiscoveryProviderTarget = {
          ...target,
          metadata: {
            ...(target.metadata ?? {}),
            providerKeys: [result.providerKey],
          },
        };

        if (!existing) {
          map.set(key, enrichedTarget);
          continue;
        }

        const providerKeys = Array.from(
          new Set([
            ...this.providerKeysFromTarget(existing),
            ...this.providerKeysFromTarget(enrichedTarget),
          ]),
        );

        map.set(key, {
          ...existing,
          confidenceScore: Math.max(existing.confidenceScore, enrichedTarget.confidenceScore),
          relevanceScore: Math.max(existing.relevanceScore, enrichedTarget.relevanceScore),
          qualificationScore: Math.max(existing.qualificationScore ?? 0, enrichedTarget.qualificationScore ?? 0),
          email: existing.email ?? enrichedTarget.email,
          phone: existing.phone ?? enrichedTarget.phone,
          website: existing.website ?? enrichedTarget.website,
          linkedinUrl: existing.linkedinUrl ?? enrichedTarget.linkedinUrl,
          location: existing.location ?? enrichedTarget.location,
          sourceUrl: existing.sourceUrl ?? enrichedTarget.sourceUrl,
          whyThisTarget: existing.whyThisTarget,
          recommendedAction: existing.recommendedAction,
          metadata: {
            ...(existing.metadata ?? {}),
            providerKeys,
          },
          evidence: [...existing.evidence, ...enrichedTarget.evidence],
        });
      }
    }

    return Array.from(map.values()).sort((left, right) => {
      const qualificationDelta = (right.qualificationScore ?? 0) - (left.qualificationScore ?? 0);
      if (qualificationDelta !== 0) return qualificationDelta;
      const relevanceDelta = right.relevanceScore - left.relevanceScore;
      if (relevanceDelta !== 0) return relevanceDelta;
      return right.confidenceScore - left.confidenceScore;
    });
  }

  private targetIdentityKey(target: DiscoveryProviderTarget): string {
    return (target.email || target.linkedinUrl || target.website || `${target.companyName ?? ''}:${target.personName ?? ''}:${target.title}`)
      .toLowerCase()
      .replace(/\s+/g, '-');
  }

  private providerKeysFromTarget(target: DiscoveryProviderTarget): string[] {
    const metadata = (target.metadata ?? {}) as Record<string, unknown>;
    const providerKeys = metadata['providerKeys'];
    return Array.isArray(providerKeys) ? providerKeys.filter((value): value is string => typeof value === 'string') : [];
  }

  private async matchExistingRecords(
    userId: string,
    target: DiscoveryProviderTarget,
    existingDiscoveryTargetId?: string,
  ): Promise<DiscoveryExistingMatch> {
    if (existingDiscoveryTargetId) {
      const discoveryTarget = await prisma.discoveryTarget.findFirst({
        where: { id: existingDiscoveryTargetId, userId },
        select: { id: true, status: true, personId: true, companyId: true, opportunityId: true },
      });
      if (discoveryTarget) {
        return {
          matchType: 'discovery_target',
          discoveryTargetId: discoveryTarget.id,
          companyId: discoveryTarget.companyId ?? undefined,
          personId: discoveryTarget.personId ?? undefined,
          opportunityId: discoveryTarget.opportunityId ?? undefined,
          promoted: discoveryTarget.status === DiscoveryTargetStatus.promoted,
          details: discoveryTarget.status === DiscoveryTargetStatus.promoted ? 'Previously promoted from discovery.' : 'Previously seen in discovery.',
        };
      }
    }

    if (target.email || target.personName) {
      const person = await prisma.person.findFirst({
        where: {
          userId,
          OR: [
            ...(target.email ? [{ email: target.email }] : []),
            ...(target.personName ? [{ fullName: target.personName }] : []),
          ],
        },
        include: {
          primaryOpportunities: {
            where: { stage: { in: [OpportunityStage.outreach_sent, OpportunityStage.conversation_started, OpportunityStage.interviewing] } },
            take: 1,
          },
        },
      });

      if (person) {
        return {
          matchType: 'person',
          personId: person.id,
          contacted: person.primaryOpportunities.length > 0,
          details: person.primaryOpportunities.length > 0 ? 'This contact already has an active opportunity.' : 'This contact already exists.',
        };
      }
    }

    if (target.companyName || target.website) {
      const company = await prisma.company.findFirst({
        where: {
          userId,
          OR: [
            ...(target.companyName ? [{ name: target.companyName }] : []),
            ...(target.website ? [{ website: target.website }] : []),
          ],
        },
      });

      if (company) {
        return {
          matchType: 'company',
          companyId: company.id,
          details: 'This company already exists in your workspace.',
        };
      }
    }

    return { matchType: 'none' };
  }

  private decorateWhyThisTarget(whyThisTarget: string, existingMatch: DiscoveryExistingMatch): string {
    if (existingMatch.matchType === 'none') return whyThisTarget;
    return `${whyThisTarget} ${existingMatch.details ?? ''}`.trim();
  }

  private decorateRecommendedAction(recommendedAction: string, existingMatch: DiscoveryExistingMatch): string {
    if (existingMatch.matchType === 'person' && existingMatch.contacted) {
      return 'Review the existing contact record and decide whether to follow up or re-engage.';
    }
    if (existingMatch.matchType === 'company') {
      return 'Review the existing company and identify whether a new recruiter contact should be added.';
    }
    if (existingMatch.matchType === 'discovery_target') {
      return existingMatch.promoted
        ? 'Review the previously promoted record before creating any new outreach.'
        : 'Review the prior discovery target and decide whether to reuse or reject it.';
    }
    return recommendedAction;
  }

  private async enrichTargetsWithApollo(
    targets: DiscoveryProviderTarget[],
  ): Promise<DiscoveryProviderTarget[]> {
    this.logger.log(`Performing waterfall enrichment for ${targets.length} targets...`);
    const enriched = [];

    for (const target of targets) {
      // If we already have a direct B2B result with email, skip
      if (target.email && target.linkedinUrl) {
        enriched.push(target);
        continue;
      }

      try {
        const enrichmentData = await this.apolloDiscoveryProvider.enrich(target);
        
        // Only merge if we actually found something
        if (Object.keys(enrichmentData).length > 0) {
          enriched.push({
            ...target,
            ...enrichmentData,
            metadata: {
              ...(target.metadata as Record<string, unknown> ?? {}),
              ...(enrichmentData.metadata as Record<string, unknown> ?? {}),
              enrichedBy: 'apollo',
            },
          } as DiscoveryProviderTarget);
        } else {
          enriched.push(target);
        }
      } catch (error) {
        this.logger.error(`Enrichment failed for target ${target.personName}`, error);
        enriched.push(target);
      }
    }

    return enriched;
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
