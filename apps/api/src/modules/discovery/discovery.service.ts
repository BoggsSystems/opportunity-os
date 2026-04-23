import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { LocalDiscoveryProvider } from './providers/local-discovery.provider';

@Injectable()
export class DiscoveryService {
  constructor(private readonly localDiscoveryProvider: LocalDiscoveryProvider) {}

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

  async createScan(userId: string, dto: CreateDiscoveryScanDto) {
    const query = dto.query?.trim();
    if (!query) {
      throw new BadRequestException('Discovery query is required');
    }

    const context = await this.resolveScanContext(userId, dto);
    const scan = await prisma.discoveryScan.create({
      data: {
        userId,
        offeringId: context.offeringId,
        campaignId: context.campaignId,
        goalId: context.goalId,
        query,
        scanType: (dto.scanType ?? 'mixed') as DiscoveryScanType,
        providerKey: dto.providerKey?.trim() || this.localDiscoveryProvider.key,
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
    const provider = this.providerFor(scan.providerKey);

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
      const result = await provider.discover({
        userId,
        query: scan.query,
        scanType: scan.scanType,
        targetSegment: scan.targetSegment ?? undefined,
        maxTargets: scan.maxTargets,
        context: (scan.requestContextJson as Record<string, unknown>) ?? {},
      });

      const createdTargets = [];
      for (const target of result.targets) {
        const dedupeKey = this.buildDedupeKey(userId, scan.id, target);
        const existingTarget = await prisma.discoveryTarget.findFirst({
          where: { userId, dedupeKey, status: { not: DiscoveryTargetStatus.archived } },
          select: { id: true },
        });

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
            whyThisTarget: target.whyThisTarget,
            recommendedAction: target.recommendedAction,
            metadataJson: this.toJson(target.metadata),
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
          providerResultJson: this.toJson(result.metadata),
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

  private leverageInterpretation(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('trading') || lower.includes('market data') || lower.includes('latency')) {
      return 'Potentially useful for trading systems positioning and recruiter outreach.';
    }
    return 'Potentially useful as supporting context for future outreach.';
  }

  private async resolveScanContext(userId: string, dto: CreateDiscoveryScanDto) {
    let campaign: any = null;
    if (dto.campaignId) {
      campaign = await prisma.strategicCampaign.findFirst({
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
    if (!providerKey || providerKey === this.localDiscoveryProvider.key) {
      return this.localDiscoveryProvider;
    }
    return this.localDiscoveryProvider;
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

  private buildDedupeKey(userId: string, scanId: string, target: any) {
    const identity = target.email || target.linkedinUrl || target.website || `${target.companyName ?? ''}:${target.personName ?? ''}:${target.title}`;
    return `${userId}:${scanId}:${identity}`.toLowerCase().replace(/\s+/g, '-');
  }

  private scanInclude() {
    return {
      offering: { select: { id: true, title: true, description: true, offeringType: true } },
      campaign: { select: { id: true, title: true, targetSegment: true, offeringId: true, goalId: true } },
      goal: { select: { id: true, title: true, description: true } },
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
      evidence: target.evidence ?? [],
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
