import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionCycleStatus,
  ActivityType,
  OpportunityCyclePhase,
  OpportunityCycleStatus,
  OpportunityStage,
  CampaignStatus,
  Prisma,
  prisma,
  TaskPriority,
  TaskStatus,
  WorkspaceCommandStatus,
  WorkspaceMode,
  WorkspaceSignalImportance,
  WorkspaceSignalStatus,
} from '@opportunity-os/db';
import { NextActionItem } from '../next-actions/interfaces/next-action.interface';
import { NextActionsService } from '../next-actions/next-actions.service';
import { CommercialService } from '../commercial/commercial.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { OfferingsService } from '../offerings/offerings.service';
import { WorkspaceCommandDto } from './dto/workspace-command.dto';
import {
  CanvasAction,
  CanvasCommand,
  CanvasState,
  WorkspaceCycleSummary,
  WorkspaceSignalSummary,
  WorkspaceState,
} from './workspace.types';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly nextActionsService: NextActionsService,
    private readonly commercialService: CommercialService,
    private readonly discoveryService: DiscoveryService,
    private readonly offeringsService: OfferingsService,
  ) {}

  async getWorkspaceState(userId: string): Promise<WorkspaceState> {
    const nextActions = await this.nextActionsService.getNextActions(userId);
    await this.ensureSignalsFromNextActions(userId, nextActions);

    const [activeOpportunityCycle, activeCampaignActionCycle, activeCampaign, signals, activeConversation, velocity, pendingOfferingProposal, activeOffering] = await Promise.all([
      this.findActiveOpportunityCycle(userId),
      this.findActiveCampaignActionCycle(userId),
      this.findActiveCampaign(userId),
      this.findSignals(userId),
      this.findActiveConversation(userId),
      this.getVelocity(userId),
      this.offeringsService.findPendingProposal(userId),
      this.offeringsService.getActiveOfferingContext(userId),
    ]);

    const recommendation = nextActions[0] ?? null;
    const activeCycleSummary = activeOpportunityCycle
      ? this.toCycleSummary(activeOpportunityCycle)
      : activeCampaignActionCycle
        ? this.toCampaignActionCycleSummary(activeCampaignActionCycle)
        : null;
    const mode = activeCycleSummary?.workspaceMode ?? activeCampaign?.workspaceMode ?? this.workspaceModeFromRecommendation(recommendation);
    const allowedActions = activeCycleSummary?.allowedActions ?? this.allowedActionsForMode(mode, recommendation);
    const canvas = this.buildCanvasState(
      activeCycleSummary,
      recommendation,
      mode,
      allowedActions,
      pendingOfferingProposal,
      activeOffering,
      activeCampaign,
    );

    return {
      conductor: {
        activeConversationId: activeConversation?.id ?? null,
        suggestedPrompts: this.buildSuggestedPrompts(activeCycleSummary, recommendation, pendingOfferingProposal, activeOffering),
        currentReasoningSummary:
          activeCycleSummary?.whyItMatters ??
          recommendation?.reason ??
          this.offeringReasoningSummary(pendingOfferingProposal, activeOffering),
      },
      activeCycle: activeCycleSummary,
      activeWorkspace: {
        mode,
        allowedActions,
        entity: this.buildActiveEntity(activeCycleSummary, recommendation, pendingOfferingProposal, activeOffering),
      },
      canvas,
      signals: signals.map((signal) => this.toSignalSummary(signal)),
      recommendation,
      velocity,
    };
  }

  async executeCommand(userId: string, dto: WorkspaceCommandDto) {
    const command = await prisma.workspaceCommand.create({
      data: {
        userId,
        commandType: dto.type,
        opportunityCycleId: dto.cycleId,
        inputJson: this.toJson({
          signalId: dto.signalId,
          cycleId: dto.cycleId,
          input: dto.input ?? {},
          reason: dto.reason,
        }),
        status: WorkspaceCommandStatus.running,
        startedAt: new Date(),
      },
    });

    try {
      const result = await this.runCommand(userId, dto);
      const completedCommand = await prisma.workspaceCommand.update({
        where: { id: command.id },
        data: {
          status: WorkspaceCommandStatus.succeeded,
          resultJson: this.toJson(result),
          completedAt: new Date(),
        },
      });
      return { command: completedCommand, result };
    } catch (error) {
      await prisma.workspaceCommand.update({
        where: { id: command.id },
        data: {
          status: WorkspaceCommandStatus.failed,
          errorMessage: error instanceof Error ? error.message : 'Unknown workspace command failure',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async runCommand(userId: string, dto: WorkspaceCommandDto) {
    console.log(`[DEBUG] runCommand called with type: ${dto.type}`);
    switch (dto.type) {
      case 'confirm_offering':
        return this.confirmOfferingFromCommand(userId, dto);
      case 'adjust_offering':
        return this.adjustOfferingFromCommand(userId, dto);
      case 'reject_offering':
        return this.rejectOfferingFromCommand(userId, dto);
      case 'activate_campaign':
        return this.activateCampaignFromCommand(userId, dto);
      case 'start_discovery_scan':
        return this.startDiscoveryScanFromCommand(userId, dto);
      case 'accept_discovery_target':
        return this.acceptDiscoveryTargetFromCommand(userId, dto);
      case 'reject_discovery_target':
        return this.rejectDiscoveryTargetFromCommand(userId, dto);
      case 'promote_discovery_targets':
        return this.promoteDiscoveryTargetsFromCommand(userId, dto);
      case 'activate_signal':
        return this.activateSignal(userId, dto.signalId);
      case 'dismiss_signal':
        return this.dismissSignal(userId, dto.signalId);
      case 'dismiss_cycle':
        return this.updateCycleStatus(userId, dto.cycleId, OpportunityCycleStatus.dismissed);
      case 'complete_cycle':
        return this.updateCycleStatus(userId, dto.cycleId, OpportunityCycleStatus.completed);
      case 'create_task':
        return this.createTaskFromCommand(userId, dto);
      case 'advance_opportunity':
        return this.advanceOpportunityFromCommand(userId, dto);
      case 'set_workspace_mode':
        return this.handleSetWorkspaceMode(userId, dto);
      case 'build_recipient_queue':
        return this.buildRecipientQueueFromCommand(userId, dto);
      case 'select_recipient':
        return this.selectRecipientFromCommand(userId, dto);
      default:
        return assertNever(dto.type);
    }
  }

  private async confirmOfferingFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const proposalId = await this.resolveOfferingProposalId(userId, dto);
    return this.offeringsService.confirmProposal(proposalId, userId, dto.input ?? {});
  }

  private async adjustOfferingFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const proposalId = await this.resolveOfferingProposalId(userId, dto);
    return {
      proposal: await this.offeringsService.updateProposal(proposalId, userId, dto.input ?? {}),
    };
  }

  private async rejectOfferingFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const proposalId = await this.resolveOfferingProposalId(userId, dto);
    return {
      proposal: await this.offeringsService.rejectProposal(proposalId, userId),
    };
  }

  private async activateCampaignFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const campaignId = this.stringInput(dto, 'campaignId');
    if (!campaignId) {
      throw new NotFoundException('campaignId is required');
    }

    await prisma.campaign.update({
      where: { id: campaignId, userId },
      data: { 
        status: CampaignStatus.ACTIVE,
        workspaceMode: WorkspaceMode.discovery_scan,
      },
    });

    return { success: true, mode: WorkspaceMode.discovery_scan };
  }

  private async startDiscoveryScanFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const input = dto.input ?? {};
    const query = typeof input['query'] === 'string' ? input['query'] : undefined;
    if (!query) {
      throw new NotFoundException('Discovery query is required');
    }

    const scan = await this.discoveryService.createScan(userId, {
      query,
      scanType: typeof input['scanType'] === 'string' ? input['scanType'] as any : undefined,
      maxTargets: typeof input['maxTargets'] === 'number' ? input['maxTargets'] : 10,
      targetSegment: typeof input['targetSegment'] === 'string' ? input['targetSegment'] : undefined,
      campaignId: typeof input['campaignId'] === 'string' ? input['campaignId'] : undefined,
      offeringId: typeof input['offeringId'] === 'string' ? input['offeringId'] : undefined,
      goalId: typeof input['goalId'] === 'string' ? input['goalId'] : undefined,
      providerKey: typeof input['providerKey'] === 'string' ? input['providerKey'] : undefined,
      providerKeys: Array.isArray(input['providerKeys']) ? input['providerKeys'] : undefined,
      context: typeof input['context'] === 'object' && input['context'] !== null ? input['context'] as Record<string, unknown> : undefined,
    });

    // Automatically transition workspace to discovery mode for this campaign
    if (typeof input['campaignId'] === 'string') {
      await prisma.campaign.update({
        where: { id: input['campaignId'] as string, userId },
        data: { 
          status: CampaignStatus.ACTIVE,
          workspaceMode: WorkspaceMode.discovery_scan,
        },
      }).catch(() => null);
    }

    return scan;
  }

  private async acceptDiscoveryTargetFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const targetId = this.stringInput(dto, 'discoveryTargetId');
    if (!targetId) {
      throw new NotFoundException('discoveryTargetId is required');
    }
    return this.discoveryService.acceptTarget(userId, targetId);
  }

  private async rejectDiscoveryTargetFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const targetId = this.stringInput(dto, 'discoveryTargetId');
    if (!targetId) {
      throw new NotFoundException('discoveryTargetId is required');
    }
    return this.discoveryService.rejectTarget(userId, targetId, this.stringInput(dto, 'reason'));
  }

  private async promoteDiscoveryTargetsFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const scanId = this.stringInput(dto, 'discoveryScanId');
    if (!scanId) {
      throw new NotFoundException('discoveryScanId is required');
    }
    return this.discoveryService.promoteAcceptedTargets(userId, scanId);
  }

  private async resolveOfferingProposalId(userId: string, dto: WorkspaceCommandDto) {
    const inputProposalId = typeof dto.input?.['offeringProposalId'] === 'string' ? dto.input['offeringProposalId'] : undefined;
    if (inputProposalId) {
      return inputProposalId;
    }

    const pendingProposal = await this.offeringsService.findPendingProposal(userId);
    if (!pendingProposal) {
      throw new NotFoundException('Offering proposal not found');
    }
    return pendingProposal.id;
  }

  private stringInput(dto: WorkspaceCommandDto, key: string) {
    const value = dto.input?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private async activateSignal(userId: string, signalId?: string) {
    if (!signalId) {
      throw new NotFoundException('signalId is required');
    }

    const signal = await prisma.workspaceSignal.findFirst({
      where: { id: signalId, userId },
    });
    if (!signal) {
      throw new NotFoundException('Workspace signal not found');
    }

    const existingCycle = await prisma.opportunityCycle.findFirst({
      where: {
        userId,
        workspaceSignalId: signal.id,
        status: OpportunityCycleStatus.active,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingCycle) {
      await prisma.workspaceSignal.update({
        where: { id: signal.id },
        data: {
          status: WorkspaceSignalStatus.active,
          consumedAt: new Date(),
        },
      });

      return { cycle: this.toCycleSummary(existingCycle) };
    }

    const allowance = await this.commercialService.incrementUsage(userId, 'opportunity_cycles');
    if (!allowance.allowed) {
      return {
        blocked: true,
        ...allowance,
      };
    }

    const cycle = await this.createCycleFromSignal(userId, signal);

    await prisma.workspaceSignal.update({
      where: { id: signal.id },
      data: {
        status: WorkspaceSignalStatus.active,
        consumedAt: new Date(),
      },
    });

    return { cycle: this.toCycleSummary(cycle) };
  }

  private async createCycleFromSignal(userId: string, signal: any) {
    const refs = await this.refsFromSignal(userId, signal);

    return prisma.opportunityCycle.create({
      data: {
        userId,
        workspaceSignalId: signal.id,
        title: signal.title,
        whyItMatters: signal.reason ?? signal.summary,
        recommendedAction: signal.recommendedAction,
        priorityScore: signal.priorityScore,
        workspaceMode: signal.recommendedWorkspaceMode,
        allowedActionsJson: this.toJson(this.allowedActionsForMode(signal.recommendedWorkspaceMode as WorkspaceMode)),
        stateJson: this.toJson({
          canvas: this.canvasActionFromWorkspaceMode(signal.recommendedWorkspaceMode as WorkspaceMode),
          source: 'activate_signal',
        }),
        ...refs,
      },
    });
  }

  private async dismissSignal(userId: string, signalId?: string) {
    if (!signalId) {
      throw new NotFoundException('signalId is required');
    }
    const signal = await prisma.workspaceSignal.findFirst({ where: { id: signalId, userId } });
    if (!signal) {
      throw new NotFoundException('Workspace signal not found');
    }
    return prisma.workspaceSignal.update({
      where: { id: signal.id },
      data: {
        status: WorkspaceSignalStatus.dismissed,
        dismissedAt: new Date(),
      },
    });
  }

  private async updateCycleStatus(userId: string, cycleId: string | undefined, status: OpportunityCycleStatus) {
    if (!cycleId) {
      throw new NotFoundException('cycleId is required');
    }
    const cycle = await prisma.opportunityCycle.findFirst({ where: { id: cycleId, userId } });
    if (!cycle) {
      throw new NotFoundException('Opportunity cycle not found');
    }

    const now = new Date();
    const updatedCycle = await prisma.opportunityCycle.update({
      where: { id: cycle.id },
      data: {
        status,
        phase: status === OpportunityCycleStatus.completed ? OpportunityCyclePhase.completed : OpportunityCyclePhase.dismissed,
        completedAt: status === OpportunityCycleStatus.completed ? now : undefined,
        dismissedAt: status === OpportunityCycleStatus.dismissed ? now : undefined,
        lastAdvancedAt: now,
      },
    });

    if (cycle.workspaceSignalId) {
      await prisma.workspaceSignal.update({
        where: { id: cycle.workspaceSignalId },
        data: {
          status:
            status === OpportunityCycleStatus.completed
              ? WorkspaceSignalStatus.consumed
              : WorkspaceSignalStatus.dismissed,
          consumedAt: status === OpportunityCycleStatus.completed ? now : undefined,
          dismissedAt: status === OpportunityCycleStatus.dismissed ? now : undefined,
        },
      });
    }

    return updatedCycle;
  }

  private async createTaskFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const input = dto.input ?? {};
    const cycle = dto.cycleId
      ? await prisma.opportunityCycle.findFirst({ where: { id: dto.cycleId, userId } })
      : null;
    const inputOpportunityId = typeof input['opportunityId'] === 'string' ? input['opportunityId'] : undefined;
    const inputCompanyId = typeof input['companyId'] === 'string' ? input['companyId'] : undefined;
    const inputPersonId = typeof input['personId'] === 'string' ? input['personId'] : undefined;
    const opportunityId = cycle?.opportunityId ?? inputOpportunityId;

    await this.assertOwnedCommandRefs(userId, {
      opportunityId,
      companyId: inputCompanyId,
      personId: inputPersonId,
    });

    const title = typeof input['title'] === 'string' ? input['title'] : cycle?.recommendedAction ?? 'Follow up on workspace cycle';
    const task = await prisma.task.create({
      data: {
        userId,
        title,
        description: typeof input['description'] === 'string' ? input['description'] : cycle?.whyItMatters,
        dueAt: typeof input['dueAt'] === 'string' ? new Date(input['dueAt']) : undefined,
        priority: TaskPriority.medium,
        status: TaskStatus.open,
        opportunityId,
        companyId: inputCompanyId,
        personId: inputPersonId,
        taskType: 'workspace_command',
      },
    });

    if (cycle) {
      await prisma.opportunityCycle.update({
        where: { id: cycle.id },
        data: {
          taskId: task.id,
          phase: OpportunityCyclePhase.proposed,
          lastAdvancedAt: new Date(),
        },
      });
    }

    return { task };
  }

  private async advanceOpportunityFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const input = dto.input ?? {};
    const cycle = dto.cycleId
      ? await prisma.opportunityCycle.findFirst({ where: { id: dto.cycleId, userId } })
      : null;
    const opportunityId = cycle?.opportunityId ?? (typeof input['opportunityId'] === 'string' ? input['opportunityId'] : undefined);
    if (!opportunityId) {
      throw new NotFoundException('opportunityId is required');
    }
    const ownedOpportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
      select: { id: true },
    });
    if (!ownedOpportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    const stage = this.parseOpportunityStage(input['stage']);
    const opportunity = await prisma.opportunity.update({
      where: { id: ownedOpportunity.id },
      data: {
        stage,
        nextAction: typeof input['nextAction'] === 'string' ? input['nextAction'] : undefined,
        nextActionDate: typeof input['nextActionDate'] === 'string' ? new Date(input['nextActionDate']) : undefined,
      },
    });

    await prisma.activity.create({
      data: {
        userId,
        opportunityId,
        activityType: ActivityType.note_event,
        subject: 'Workspace advanced opportunity',
        bodySummary: `Advanced opportunity to ${stage}`,
        occurredAt: new Date(),
        metadataJson: { command: 'advance_opportunity', cycleId: cycle?.id },
      },
    });

    if (cycle) {
      await prisma.opportunityCycle.update({
        where: { id: cycle.id },
        data: {
          phase: OpportunityCyclePhase.executed,
          workspaceMode: WorkspaceMode.progress_summary,
          allowedActionsJson: this.toJson(this.allowedActionsForMode('progress_summary')),
          lastAdvancedAt: new Date(),
        },
      });
    }

    return { opportunity };
  }
  
  private async handleSetWorkspaceMode(userId: string, dto: WorkspaceCommandDto) {
    const mode = this.stringInput(dto, 'mode') as WorkspaceMode;
    const cycleId = dto.cycleId;
    const campaignId = dto.campaignId;
    
    if (cycleId) {
      await prisma.opportunityCycle.update({
        where: { id: cycleId, userId },
        data: { workspaceMode: mode },
      });
    } else if (campaignId) {
      await prisma.campaign.update({
        where: { id: campaignId, userId },
        data: { workspaceMode: mode },
      });
    }
    
    return { success: true, mode };
  }

  private async buildRecipientQueueFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const campaignId = dto.campaignId || this.stringInput(dto, 'campaignId');
    const actionLaneId = this.stringInput(dto, 'actionLaneId');
    const limit = typeof dto.input?.['limit'] === 'number' ? dto.input['limit'] : 10;
    const refinement = typeof dto.input?.['refinement'] === 'string' ? dto.input['refinement'] : undefined;

    if (!campaignId) throw new NotFoundException('campaignId is required');

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId, userId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // 1. Fetch potential contacts (from ConnectionRecord and Person)
    const [connections, people] = await Promise.all([
      prisma.connectionRecord.findMany({
        where: { userId },
        take: 200, // Reasonable sample for ranking
        orderBy: { connectedOn: 'desc' },
      }),
      prisma.person.findMany({
        where: { userId, opportunities: { none: { opportunity: { campaignId } } } },
        take: 100,
        orderBy: { updatedAt: 'desc' },
      })
    ]);

    // 2. Use AI to rank them
    const candidates = [
      ...connections.map(c => ({
        id: c.id,
        source: 'connection',
        name: `${c.firstName} ${c.lastName}`,
        title: c.title,
        company: c.company,
        linkedinUrl: c.linkedinUrl,
      })),
      ...people.map(p => ({
        id: p.id,
        source: 'person',
        name: p.fullName,
        title: p.title,
        company: p.companyName,
        linkedinUrl: p.linkedinUrl,
      }))
    ];

    const ranked = await this.aiService.rankRecipients({
      campaign: {
        title: campaign.title,
        description: campaign.description,
        targetSegment: campaign.targetSegment,
        strategicAngle: campaign.strategicAngle || campaign.hook,
      },
      candidates,
      limit,
      refinement,
    });

    console.log(`[DEBUG] AI ranked ${ranked.queue?.length || 0} recipients successfully`);

    return {
      queue: ranked.queue || [],
      campaignId,
      actionLaneId,
    };
  }

  private async selectRecipientFromCommand(userId: string, dto: WorkspaceCommandDto) {
    const actionItemId = this.stringInput(dto, 'actionItemId');
    const personId = this.stringInput(dto, 'personId');
    const connectionRecordId = this.stringInput(dto, 'connectionRecordId');

    if (!actionItemId) throw new NotFoundException('actionItemId is required');
    if (!personId && !connectionRecordId) throw new NotFoundException('Either personId or connectionRecordId is required');

    const actionItem = await prisma.actionItem.findUnique({
      where: { id: actionItemId },
      include: { actionCycle: true },
    });
    if (!actionItem) throw new NotFoundException('Action item not found');

    let finalPersonId = personId;

    // 1. If it's a connection record, promote it to a Person
    if (connectionRecordId && !personId) {
      const conn = await prisma.connectionRecord.findUnique({ where: { id: connectionRecordId } });
      if (conn) {
        // Find or create company
        let companyId: string | undefined;
        if (conn.company) {
          const company = await prisma.company.upsert({
            where: { userId_name: { userId, name: conn.company } },
            create: { userId, name: conn.company, companyType: 'prospect' },
            update: {},
          });
          companyId = company.id;
        }

        const person = await prisma.person.upsert({
          where: { userId_fullName_companyId: { userId, fullName: `${conn.firstName} ${conn.lastName}`, companyId: companyId || '' } },
          create: {
            userId,
            companyId,
            fullName: `${conn.firstName} ${conn.lastName}`,
            firstName: conn.firstName,
            lastName: conn.lastName,
            email: conn.email,
            title: conn.title,
            linkedinUrl: conn.linkedinUrl,
            contactSource: 'linkedin_import',
          },
          update: {
            linkedinUrl: conn.linkedinUrl || undefined,
            email: conn.email || undefined,
          },
        });
        finalPersonId = person.id;
      }
    }

    // 2. Update the action item with the target
    await prisma.actionItem.update({
      where: { id: actionItemId },
      data: {
        targetPersonId: finalPersonId,
        status: 'ready',
      },
    });

    // 3. Update the action cycle status if needed
    if (actionItem.actionCycleId) {
      await prisma.actionCycle.update({
        where: { id: actionItem.actionCycleId },
        data: { status: ActionCycleStatus.pursuing },
      });
    }

    return { success: true, personId: finalPersonId };
  }

  private async assertOwnedCommandRefs(
    userId: string,
    refs: { opportunityId?: string; companyId?: string; personId?: string },
  ) {
    const [opportunity, company, person] = await Promise.all([
      refs.opportunityId
        ? prisma.opportunity.findFirst({ where: { id: refs.opportunityId, userId }, select: { id: true } })
        : null,
      refs.companyId
        ? prisma.company.findFirst({ where: { id: refs.companyId, userId }, select: { id: true } })
        : null,
      refs.personId
        ? prisma.person.findFirst({ where: { id: refs.personId, userId }, select: { id: true } })
        : null,
    ]);

    if (refs.opportunityId && !opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    if (refs.companyId && !company) {
      throw new NotFoundException('Company not found');
    }
    if (refs.personId && !person) {
      throw new NotFoundException('Person not found');
    }
  }

  private async ensureSignalsFromNextActions(userId: string, nextActions: NextActionItem[]) {
    const existingSignals = await prisma.workspaceSignal.findMany({
      where: {
        userId,
        status: {
          in: [WorkspaceSignalStatus.new, WorkspaceSignalStatus.surfaced, WorkspaceSignalStatus.active],
        },
      },
      select: { sourceType: true, sourceId: true, title: true },
      take: 50,
    });
    const existingKeys = new Set(existingSignals.map((signal) => this.signalKey(signal.sourceType, signal.sourceId, signal.title)));

    for (const action of nextActions.slice(0, 10)) {
      const source = this.sourceFromNextAction(action);
      const key = this.signalKey(source.sourceType, source.sourceId, action.title);
      if (existingKeys.has(key)) {
        continue;
      }

      await prisma.workspaceSignal.create({
        data: {
          userId,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          title: action.title,
          summary: action.aiExplanation ?? action.reason,
          reason: action.reason,
          recommendedAction: action.recommendedAction,
          priorityScore: Math.round(action.priorityScore),
          importance: this.importanceFromScore(action.priorityScore),
          recommendedWorkspaceMode: this.workspaceModeFromRecommendation(action),
          evidenceJson: this.toJson({
            offeringRelevance: action.offeringRelevance,
            aiExplanation: action.aiExplanation,
          }),
          metadataJson: this.toJson(action),
        },
      });
      existingKeys.add(key);
    }
  }

  private findActiveOpportunityCycle(userId: string) {
    return prisma.opportunityCycle.findFirst({
      where: { userId, status: OpportunityCycleStatus.active },
      orderBy: [{ priorityScore: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  private findActiveCampaignActionCycle(userId: string) {
    return prisma.actionCycle.findFirst({
      where: {
        campaign: { userId },
        status: {
          in: [
            ActionCycleStatus.surfaced,
            ActionCycleStatus.pursuing,
            ActionCycleStatus.active,
            ActionCycleStatus.planned,
          ],
        },
      },
      include: {
        campaign: true,
        actionLane: true,
        actionItems: {
          where: {
            status: {
              in: ['suggested', 'ready', 'in_progress'],
            },
          },
          orderBy: [{ priorityScore: 'desc' }, { updatedAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [
        { priorityScore: 'desc' },
        { surfacedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  private findActiveCampaign(userId: string) {
    return prisma.campaign.findFirst({
      where: { userId, status: { in: ['PLANNING', 'ACTIVE'] } },
      orderBy: [{ priorityScore: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  private findSignals(userId: string) {
    return prisma.workspaceSignal.findMany({
      where: {
        userId,
        status: {
          in: [WorkspaceSignalStatus.new, WorkspaceSignalStatus.surfaced, WorkspaceSignalStatus.active],
        },
      },
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
  }

  private findActiveConversation(userId: string) {
    return prisma.aIConversation.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
  }

  private async getVelocity(userId: string) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      activeGoalCount,
      activeCampaignCount,
      activeOpportunityCount,
      openTaskCount,
      overdueTaskCount,
      outreachSentThisWeek,
      opportunitiesAdvancedThisWeek,
      pendingSignalCount,
      activeCycleCount,
    ] = await Promise.all([
      prisma.goal.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.campaign.count({ where: { userId, status: { in: ['PLANNING', 'ACTIVE'] } } }),
      prisma.opportunity.count({
        where: {
          userId,
          stage: { notIn: [OpportunityStage.closed_won, OpportunityStage.closed_lost] },
        },
      }),
      prisma.task.count({ where: { userId, status: TaskStatus.open } }),
      prisma.task.count({ where: { userId, status: TaskStatus.open, dueAt: { lt: new Date() } } }),
      prisma.activity.count({
        where: { userId, activityType: ActivityType.email, occurredAt: { gte: weekAgo } },
      }),
      prisma.activity.count({
        where: { userId, subject: 'Workspace advanced opportunity', occurredAt: { gte: weekAgo } },
      }),
      prisma.workspaceSignal.count({
        where: { userId, status: { in: [WorkspaceSignalStatus.new, WorkspaceSignalStatus.surfaced] } },
      }),
      prisma.opportunityCycle.count({ where: { userId, status: OpportunityCycleStatus.active } }),
    ]);

    return {
      activeGoalCount,
      activeCampaignCount,
      activeOpportunityCount,
      openTaskCount,
      overdueTaskCount,
      outreachSentThisWeek,
      opportunitiesAdvancedThisWeek,
      pendingSignalCount,
      activeCycleCount,
    };
  }

  private toSignalSummary(signal: any): WorkspaceSignalSummary {
    return {
      id: signal.id,
      title: signal.title,
      summary: signal.summary,
      importance: signal.importance,
      status: signal.status,
      priorityScore: signal.priorityScore,
      reason: signal.reason,
      recommendedAction: signal.recommendedAction,
      recommendedWorkspaceMode: signal.recommendedWorkspaceMode,
      sourceType: signal.sourceType,
      sourceId: signal.sourceId,
      createdAt: signal.createdAt,
    };
  }

  private toCycleSummary(cycle: any): WorkspaceCycleSummary {
    return {
      id: cycle.id,
      title: cycle.title,
      phase: cycle.phase,
      status: cycle.status,
      workspaceMode: cycle.workspaceMode,
      whyItMatters: cycle.whyItMatters,
      recommendedAction: cycle.recommendedAction,
      priorityScore: cycle.priorityScore,
      confidence: cycle.confidence,
      allowedActions: this.arrayFromJson(cycle.allowedActionsJson) ?? this.allowedActionsForMode(cycle.workspaceMode),
      refs: {
        signalId: cycle.workspaceSignalId ?? undefined,
        offeringId: cycle.offeringId ?? undefined,
        goalId: cycle.goalId ?? undefined,
        campaignId: cycle.campaignId ?? undefined,
        opportunityId: cycle.opportunityId ?? undefined,
        taskId: cycle.taskId ?? undefined,
        discoveredOpportunityId: cycle.discoveredOpportunityId ?? undefined,
        conversationId: cycle.aiConversationId ?? undefined,
      },
    };
  }

  private toCampaignActionCycleSummary(cycle: any): WorkspaceCycleSummary {
    const actionItem = cycle.actionItems?.[0] ?? null;
    const phase = cycle.status === ActionCycleStatus.pursuing ? 'pursuing' : 'surfaced';
    const whyItMatters =
      cycle.objective ??
      cycle.generatedReasoningJson?.rationale ??
      `This is the next staged action for ${cycle.campaign?.title ?? 'the active campaign'}.`;

    return {
      id: cycle.id,
      title: cycle.title ?? actionItem?.title ?? 'Campaign action cycle',
      phase,
      status: cycle.status,
      workspaceMode: WorkspaceMode.execution_confirm,
      whyItMatters,
      recommendedAction: actionItem?.instructions ?? cycle.objective ?? null,
      priorityScore: cycle.priorityScore,
      confidence: null,
      allowedActions: ['complete_cycle', 'create_task'],
      refs: {
        campaignId: cycle.campaignId ?? undefined,
        actionLaneId: cycle.actionLaneId ?? undefined,
        actionCycleId: cycle.id ?? undefined,
        actionItemId: actionItem?.id ?? undefined,
      },
    };
  }

  private buildSuggestedPrompts(
    cycle: WorkspaceCycleSummary | null,
    recommendation: NextActionItem | null,
    pendingOfferingProposal: any,
    activeOffering: any,
  ): string[] {
    if (pendingOfferingProposal) {
      return [
        `Refine the ${pendingOfferingProposal.title} offering.`,
        'What audience should this offering target first?',
        'What asset would strengthen this outreach?',
      ];
    }
    if (cycle) {
      return [
        `Why does "${cycle.title}" matter?`,
        'What should I do next?',
        'Summarize the current cycle.',
      ];
    }
    if (recommendation) {
      return [
        `Explain "${recommendation.title}"`,
        'What is the highest leverage next action?',
        'Show me what needs attention.',
      ];
    }
    if (activeOffering) {
      return [
        `Create a campaign for ${activeOffering.title}.`,
        'What asset should support this offering?',
        'Find the next opportunity for this offering.',
      ];
    }
    return ['What should I focus on next?', 'Show my current momentum.', 'Find the next opportunity cycle.'];
  }

  private buildActiveEntity(
    cycle: WorkspaceCycleSummary | null,
    recommendation: NextActionItem | null,
    pendingOfferingProposal: any,
    activeOffering: any,
  ) {
    if (cycle) {
      return { type: 'cycle', refs: cycle.refs };
    }
    if (pendingOfferingProposal) {
      return { type: 'offering_proposal', proposal: this.toOfferingProposalContext(pendingOfferingProposal) };
    }
    if (recommendation) {
      return { type: recommendation.type, recommendation };
    }
    if (activeOffering) {
      return { type: 'offering', offering: this.toOfferingContext(activeOffering) };
    }
    return null;
  }

  private buildCanvasState(
    cycle: WorkspaceCycleSummary | null,
    recommendation: NextActionItem | null,
    mode: WorkspaceMode,
    allowedActions: string[],
    pendingOfferingProposal: any,
    activeOffering: any,
    activeCampaign: any | null,
  ): CanvasState {
    const action = !cycle && pendingOfferingProposal ? 'confirm_offering' : this.canvasActionFromWorkspaceMode(mode, recommendation);
    const refs = cycle?.refs ?? this.refsFromOfferingProposal(pendingOfferingProposal) ?? this.refsFromRecommendation(recommendation) ?? {};
    
    if (activeCampaign && !refs.campaignId) {
      refs.campaignId = activeCampaign.id;
    }

    const canvasActions = this.canvasCommandsForAction(action, allowedActions, recommendation);
    const title = this.canvasTitleForAction(action, cycle, recommendation, pendingOfferingProposal);

    return {
      action,
      title,
      explanation: this.canvasExplanationForAction(action, cycle, recommendation, pendingOfferingProposal, activeOffering),
      phase: cycle?.phase ?? (pendingOfferingProposal ? 'proposed' : recommendation ? 'surfaced' : 'idle'),
      refs,
      allowedActions: canvasActions,
      primaryAction: canvasActions[0] ?? null,
      context: this.canvasContextForAction(action, cycle, recommendation, pendingOfferingProposal, activeOffering),
    };
  }

  private canvasActionFromWorkspaceMode(mode: WorkspaceMode, recommendation?: NextActionItem | null): CanvasAction {
    if (mode === 'empty') return 'idle';
    if (mode === 'goal_planning') return 'confirm_goal';
    if (mode === 'campaign_review') return 'confirm_campaign';
    if (mode === 'discovery_review') return 'review_discovery_targets';
    if (mode === 'discovery_scan') return 'run_discovery';
    if (mode === 'opportunity_review') return 'review_opportunity';
    if (mode === 'draft_edit') return 'draft_email';
    if (mode === 'asset_review') return 'review_asset';
    if (mode === 'execution_confirm') return recommendation?.type === 'task' ? 'complete_cycle' : 'confirm_send';
    if (mode === 'progress_summary') return 'complete_cycle';
    return 'review_opportunity';
  }

  private canvasCommandsForAction(
    action: CanvasAction,
    allowedWorkspaceActions: string[],
    recommendation: NextActionItem | null,
  ): CanvasCommand[] {
    const commands: CanvasCommand[] = [];
    if (action === 'idle') return [];
    if (action === 'confirm_offering') commands.push('confirm', 'adjust', 'skip');
    if (action === 'upload_asset') commands.push('upload_asset', 'skip');
    if (action === 'review_asset') commands.push('continue', 'create_task');
    if (action === 'confirm_goal' || action === 'confirm_campaign') commands.push('confirm', 'adjust');
    if (action === 'run_discovery') commands.push('start_discovery_scan');
    if (action === 'review_discovery_targets') commands.push('accept_discovery_target', 'reject_discovery_target', 'promote_discovery_targets');
    if (action === 'review_opportunity') commands.push('generate_draft');
    if (action === 'draft_email') commands.push('send_email');
    if (action === 'confirm_send') commands.push('send_email', 'complete_cycle');
    if (action === 'complete_cycle') commands.push('complete_cycle');

    if (allowedWorkspaceActions.includes('activate_signal')) commands.push('activate_signal');
    if (allowedWorkspaceActions.includes('dismiss_signal')) commands.push('dismiss_signal');
    if (allowedWorkspaceActions.includes('create_task')) commands.push('create_task');
    if (allowedWorkspaceActions.includes('advance_opportunity') || recommendation?.opportunityId) commands.push('advance_opportunity');
    if (allowedWorkspaceActions.includes('complete_cycle')) commands.push('complete_cycle');

    return Array.from(new Set(commands));
  }

  private canvasTitleForAction(
    action: CanvasAction,
    cycle: WorkspaceCycleSummary | null,
    recommendation: NextActionItem | null,
    pendingOfferingProposal?: any,
  ): string {
    if (action === 'idle') return 'Ready for the next guided action';
    if (action === 'confirm_offering') return pendingOfferingProposal?.title ?? 'Confirm the offering';
    if (action === 'upload_asset') return 'Upload supporting asset';
    if (action === 'review_asset') return 'Review asset leverage';
    if (action === 'confirm_goal') return 'Confirm the goal';
    if (action === 'confirm_campaign') return 'Confirm the campaign';
    if (action === 'run_discovery') return 'Run discovery scan';
    if (action === 'review_discovery_targets') return 'Review discovery targets';
    if (action === 'review_opportunity') return cycle?.title ?? recommendation?.title ?? 'Review opportunity';
    if (action === 'draft_email') return 'Draft email';
    if (action === 'confirm_send') return 'Confirm send';
    if (action === 'complete_cycle') return 'Complete cycle';
    return cycle?.title ?? recommendation?.title ?? 'Guided action';
  }

  private canvasExplanationForAction(
    action: CanvasAction,
    cycle: WorkspaceCycleSummary | null,
    recommendation: NextActionItem | null,
    pendingOfferingProposal?: any,
    activeOffering?: any,
  ): string {
    if (cycle?.whyItMatters) return cycle.whyItMatters;
    if (action === 'confirm_offering' && pendingOfferingProposal) {
      return 'The Conductor has inferred an offering from the conversation. Confirm or adjust the structured fields before using it for campaigns.';
    }
    if (recommendation?.aiExplanation) return recommendation.aiExplanation;
    if (recommendation?.reason) return recommendation.reason;

    if (action === 'idle') return 'The Conductor can define the next offering, goal, or opportunity cycle.';
    if (action === 'confirm_offering') return 'The Conductor has inferred an offering. Confirm or adjust the structured version.';
    if (action === 'upload_asset') return 'Add a file that can support positioning, credibility, or outreach.';
    if (action === 'review_asset') return 'Review how this asset can be used as leverage.';
    if (action === 'confirm_goal') return 'Confirm the strategic goal before the system creates campaign structure.';
    if (action === 'confirm_campaign') return 'Confirm the campaign angle and first motion.';
    if (action === 'run_discovery') return 'Start a focused scan for targets that match the current offering and campaign.';
    if (action === 'review_discovery_targets') return 'Review the discovered targets, accept the strongest prospects, and promote them into the campaign workflow.';
    if (action === 'review_opportunity') return 'Review this opportunity before taking the next execution step.';
    if (action === 'draft_email') return 'Review and edit the email before execution.';
    if (action === 'confirm_send') return 'Confirm the execution channel and send readiness.';
    if (activeOffering) return `The current offering context is ${activeOffering.title}.`;
    return 'Close the current cycle and move to the next best action.';
  }

  private canvasContextForAction(
    action: CanvasAction,
    cycle: WorkspaceCycleSummary | null,
    recommendation: NextActionItem | null,
    pendingOfferingProposal?: any,
    activeOffering?: any,
  ): Record<string, unknown> | null {
    return {
      action,
      recommendedAction: cycle?.recommendedAction ?? recommendation?.recommendedAction,
      recommendationType: recommendation?.type,
      priorityScore: cycle?.priorityScore ?? recommendation?.priorityScore,
      offeringRelevance: recommendation?.offeringRelevance,
      offeringProposal: pendingOfferingProposal ? this.toOfferingProposalContext(pendingOfferingProposal) : undefined,
      activeOffering: activeOffering ? this.toOfferingContext(activeOffering) : undefined,
    };
  }

  private refsFromRecommendation(recommendation: NextActionItem | null): CanvasState['refs'] {
    if (!recommendation) return {};
    return {
      opportunityId: recommendation.opportunityId,
      taskId: recommendation.taskId,
      discoveredOpportunityId: recommendation.discoveredOpportunityId ?? recommendation.contentOpportunityId,
    };
  }

  private offeringReasoningSummary(pendingOfferingProposal: any, activeOffering: any) {
    if (pendingOfferingProposal) {
      return `Confirm the inferred offering: ${pendingOfferingProposal.title}.`;
    }
    if (activeOffering) {
      return `Current offering context: ${activeOffering.title}.`;
    }
    return null;
  }

  private refsFromOfferingProposal(proposal: any): CanvasState['refs'] | null {
    if (!proposal) return null;
    return {
      offeringProposalId: proposal.id,
      conversationId: proposal.aiConversationId ?? undefined,
    };
  }

  private toOfferingProposalContext(proposal: any) {
    return {
      id: proposal.id,
      title: proposal.title,
      description: proposal.description,
      offeringType: proposal.offeringType,
      status: proposal.status,
      targetAudiences: this.arrayFromJson(proposal.targetAudiencesJson) ?? [],
      problemSolved: proposal.problemSolved,
      outcomeCreated: proposal.outcomeCreated,
      credibility: proposal.credibility,
      bestOutreachAngle: proposal.bestOutreachAngle,
      suggestedAssets: this.arrayFromJson(proposal.suggestedAssetsJson) ?? [],
      positioning: proposal.positioningJson ?? null,
      metadata: proposal.metadataJson ?? null,
    };
  }

  private toOfferingContext(offering: any) {
    return {
      id: offering.id,
      title: offering.title,
      description: offering.description,
      offeringType: offering.offeringType,
      status: offering.status,
      positionings: offering.positionings ?? [],
      assets: offering.assets ?? [],
    };
  }

  private sourceFromNextAction(action: NextActionItem) {
    if (action.taskId) return { sourceType: 'task', sourceId: action.taskId };
    if (action.opportunityId) return { sourceType: 'opportunity', sourceId: action.opportunityId };
    if (action.discoveredOpportunityId) return { sourceType: 'discovered_opportunity', sourceId: action.discoveredOpportunityId };
    if (action.contentOpportunityId) return { sourceType: 'content_opportunity', sourceId: action.contentOpportunityId };
    return { sourceType: action.type, sourceId: null };
  }

  private async refsFromSignal(userId: string, signal: any) {
    if (!signal.sourceId) return {};
    if (signal.sourceType === 'task') return this.refsFromTask(userId, signal.sourceId);
    if (signal.sourceType === 'opportunity') return this.refsFromOpportunity(userId, signal.sourceId);
    if (signal.sourceType === 'discovered_opportunity' || signal.sourceType === 'content_opportunity') {
      return { discoveredOpportunityId: signal.sourceId };
    }
    if (signal.sourceType === 'discovery_scan') {
      return { discoveryScanId: signal.sourceId };
    }
    return {};
  }

  private async refsFromTask(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: {
        id: true,
        opportunityId: true,
        opportunity: {
          select: {
            campaignId: true,
            campaign: {
              select: {
                goalId: true,
                offeringId: true,
                goal: { select: { offeringId: true } },
              },
            },
          },
        },
      },
    });

    if (!task) return { taskId };

    return {
      taskId: task.id,
      opportunityId: task.opportunityId ?? undefined,
      campaignId: task.opportunity?.campaignId ?? undefined,
      goalId: task.opportunity?.campaign?.goalId ?? undefined,
      offeringId: task.opportunity?.campaign?.offeringId ?? task.opportunity?.campaign?.goal?.offeringId ?? undefined,
    };
  }

  private async refsFromOpportunity(userId: string, opportunityId: string) {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, userId },
      select: {
        id: true,
        campaignId: true,
        campaign: {
          select: {
            goalId: true,
            offeringId: true,
            goal: { select: { offeringId: true } },
          },
        },
      },
    });

    if (!opportunity) return { opportunityId };

    return {
      opportunityId: opportunity.id,
      campaignId: opportunity.campaignId ?? undefined,
      goalId: opportunity.campaign?.goalId ?? undefined,
      offeringId: opportunity.campaign?.offeringId ?? opportunity.campaign?.goal?.offeringId ?? undefined,
    };
  }

  private workspaceModeFromRecommendation(action: NextActionItem | null): WorkspaceMode {
    if (!action) return 'empty';
    if (action.type === 'task') return 'execution_confirm';
    if (action.type === 'opportunity' || action.type === 'follow_up') return 'opportunity_review';
    if (action.type === 'discovery') return 'discovery_review';
    return 'signal_review';
  }

  private allowedActionsForMode(mode: WorkspaceMode, action?: NextActionItem | null): string[] {
    if (mode === 'empty') return [];
    const actions = ['dismiss_signal'];
    if (mode === 'signal_review') actions.push('activate_signal');
    if (mode === 'discovery_review') actions.push('activate_signal');
    if (mode === 'opportunity_review') actions.push('create_task', 'advance_opportunity', 'dismiss_cycle');
    if (mode === 'execution_confirm') actions.push('complete_cycle', 'create_task');
    if (mode === 'draft_edit') actions.push('complete_cycle');
    if (mode === 'progress_summary') actions.push('complete_cycle', 'create_task');
    if (action?.opportunityId) actions.push('advance_opportunity');
    if (action?.taskId) actions.push('complete_cycle');
    return Array.from(new Set(actions));
  }

  private importanceFromScore(score: number): WorkspaceSignalImportance {
    if (score >= 90) return WorkspaceSignalImportance.critical;
    if (score >= 75) return WorkspaceSignalImportance.high;
    if (score >= 50) return WorkspaceSignalImportance.medium;
    return WorkspaceSignalImportance.low;
  }

  private parseOpportunityStage(stage: unknown): OpportunityStage {
    if (typeof stage === 'string' && Object.values(OpportunityStage).includes(stage as OpportunityStage)) {
      return stage as OpportunityStage;
    }
    return OpportunityStage.outreach_sent;
  }

  private signalKey(sourceType: string, sourceId: string | null, title: string) {
    return `${sourceType}:${sourceId ?? title}`;
  }

  private arrayFromJson(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    return value.filter((item): item is string => typeof item === 'string');
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported workspace command: ${value}`);
}
