import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  OpportunityCyclePhase,
  OpportunityCycleStatus,
  OpportunityStage,
  Prisma,
  prisma,
  TaskPriority,
  TaskStatus,
  WorkspaceCommandStatus,
  WorkspaceMode as PrismaWorkspaceMode,
  WorkspaceSignalImportance,
  WorkspaceSignalStatus,
} from '@opportunity-os/db';
import { NextActionItem } from '../next-actions/interfaces/next-action.interface';
import { NextActionsService } from '../next-actions/next-actions.service';
import { WorkspaceCommandDto } from './dto/workspace-command.dto';
import {
  WorkspaceCycleSummary,
  WorkspaceMode,
  WorkspaceSignalSummary,
  WorkspaceState,
} from './workspace.types';

@Injectable()
export class WorkspaceService {
  constructor(private readonly nextActionsService: NextActionsService) {}

  async getWorkspaceState(userId: string): Promise<WorkspaceState> {
    const nextActions = await this.nextActionsService.getNextActions(userId);
    await this.ensureSignalsFromNextActions(userId, nextActions);

    const [activeCycle, signals, activeConversation, velocity] = await Promise.all([
      this.findActiveCycle(userId),
      this.findSignals(userId),
      this.findActiveConversation(userId),
      this.getVelocity(userId),
    ]);

    const recommendation = nextActions[0] ?? null;
    const activeCycleSummary = activeCycle ? this.toCycleSummary(activeCycle) : null;
    const mode = activeCycleSummary?.workspaceMode ?? this.workspaceModeFromRecommendation(recommendation);
    const allowedActions = activeCycleSummary?.allowedActions ?? this.allowedActionsForMode(mode, recommendation);

    return {
      conductor: {
        activeConversationId: activeConversation?.id ?? null,
        suggestedPrompts: this.buildSuggestedPrompts(activeCycleSummary, recommendation),
        currentReasoningSummary: activeCycleSummary?.whyItMatters ?? recommendation?.reason ?? null,
      },
      activeCycle: activeCycleSummary,
      activeWorkspace: {
        mode,
        allowedActions,
        entity: this.buildActiveEntity(activeCycleSummary, recommendation),
      },
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
    switch (dto.type) {
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
      default:
        return assertNever(dto.type);
    }
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

    const cycle =
      existingCycle ??
      (await this.createCycleFromSignal(userId, signal));

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
          workspaceMode: PrismaWorkspaceMode.progress_summary,
          allowedActionsJson: this.toJson(this.allowedActionsForMode('progress_summary')),
          lastAdvancedAt: new Date(),
        },
      });
    }

    return { opportunity };
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

  private findActiveCycle(userId: string) {
    return prisma.opportunityCycle.findFirst({
      where: { userId, status: OpportunityCycleStatus.active },
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
      prisma.strategicCampaign.count({ where: { userId, status: { in: ['PLANNING', 'ACTIVE'] } } }),
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
        campaignId: cycle.strategicCampaignId ?? undefined,
        opportunityId: cycle.opportunityId ?? undefined,
        taskId: cycle.taskId ?? undefined,
        discoveredOpportunityId: cycle.discoveredOpportunityId ?? undefined,
        conversationId: cycle.aiConversationId ?? undefined,
      },
    };
  }

  private buildSuggestedPrompts(cycle: WorkspaceCycleSummary | null, recommendation: NextActionItem | null): string[] {
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
    return ['What should I focus on next?', 'Show my current momentum.', 'Find the next opportunity cycle.'];
  }

  private buildActiveEntity(cycle: WorkspaceCycleSummary | null, recommendation: NextActionItem | null) {
    if (cycle) {
      return { type: 'cycle', refs: cycle.refs };
    }
    if (recommendation) {
      return { type: recommendation.type, recommendation };
    }
    return null;
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
      strategicCampaignId: task.opportunity?.campaignId ?? undefined,
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
      strategicCampaignId: opportunity.campaignId ?? undefined,
      goalId: opportunity.campaign?.goalId ?? undefined,
      offeringId: opportunity.campaign?.offeringId ?? opportunity.campaign?.goal?.offeringId ?? undefined,
    };
  }

  private workspaceModeFromRecommendation(action: NextActionItem | null): WorkspaceMode {
    if (!action) return 'empty';
    if (action.type === 'task') return 'execution_confirm';
    if (action.type === 'opportunity' || action.type === 'follow_up') return 'opportunity_review';
    if (action.type === 'discovery') return 'signal_review';
    return 'signal_review';
  }

  private allowedActionsForMode(mode: WorkspaceMode, action?: NextActionItem | null): string[] {
    if (mode === 'empty') return [];
    const actions = ['dismiss_signal'];
    if (mode === 'signal_review') actions.push('activate_signal');
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
