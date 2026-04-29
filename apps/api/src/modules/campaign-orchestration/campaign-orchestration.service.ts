import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionItemConfirmationSource,
  ActionItemStatus,
  CampaignStatus,
  ActionLaneStatus,
  ActionCycleStatus,
  ActivityType,
  prisma,
} from '@opportunity-os/db';
import {
  ConfirmActionItemDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateActionLaneDto,
  UpdateActionLaneDto,
  CreateActionCycleDto,
  UpdateActionCycleDto,
  CreateActionItemDto,
  UpdateActionItemDto,
} from './dto/campaign.dto';

@Injectable()
export class CampaignOrchestrationService {
  // CAMPAIGN OPERATIONS
  async createCampaign(userId: string, data: CreateCampaignDto) {
    return prisma.campaign.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        objective: data.objective,
        successDefinition: data.successDefinition,
        strategicAngle: data.strategicAngle,
        targetSegment: data.targetSegment,
        timeframeStart: data.timeframeStart,
        timeframeEnd: data.timeframeEnd,
        offeringId: data.offeringId,
        goalId: data.goalId,
        priorityScore: data.priorityScore || 50,
        status: CampaignStatus.PLANNING,
      },
      include: {
        offering: true,
        goal: true,
        actionLanes: true,
      },
    });
  }

  async getCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        offering: true,
        goal: true,
        actionLanes: {
          include: {
            actionCycles: {
              include: {
                actionItems: {
                  orderBy: { priorityScore: 'desc' },
                  take: 10,
                },
              },
              orderBy: [{ cycleNumber: 'desc' }, { priorityScore: 'desc' }],
              take: 10,
            },
            actionItems: {
              where: {
                status: { in: [ActionItemStatus.suggested, ActionItemStatus.ready, ActionItemStatus.in_progress] },
              },
              orderBy: { priorityScore: 'desc' },
              take: 10,
            },
          },
          orderBy: { priorityScore: 'desc' },
        },
        campaignMetrics: {
          orderBy: { computedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async listCampaigns(userId: string, status?: CampaignStatus) {
    return prisma.campaign.findMany({
      where: { 
        userId,
        ...(status && { status })
      },
      include: {
        offering: { select: { id: true, title: true, offeringType: true } },
        goal: { select: { id: true, title: true } },
        _count: {
          select: {
            actionLanes: true,
            actionCycles: true,
            actionItems: true,
          },
        },
      },
      orderBy: { priorityScore: 'desc' },
    });
  }

  async updateCampaign(userId: string, campaignId: string, data: UpdateCampaignDto) {
    await this.findCampaign(userId, campaignId);
    
    return prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        offering: true,
        goal: true,
        actionLanes: true,
      },
    });
  }

  async deleteCampaign(userId: string, campaignId: string) {
    await this.findCampaign(userId, campaignId);
    
    return prisma.campaign.delete({
      where: { id: campaignId },
    });
  }

  // ACTION LANE OPERATIONS
  async createActionLane(userId: string, data: CreateActionLaneDto) {
    // Verify campaign ownership
    await this.findCampaign(userId, data.campaignId);
    
    return prisma.actionLane.create({
      data: {
        campaignId: data.campaignId,
        laneType: data.laneType,
        title: data.title,
        description: data.description,
        strategy: data.strategy,
        cadenceJson: data.cadenceJson,
        targetCriteriaJson: data.targetCriteriaJson,
        priorityScore: data.priorityScore || 50,
        status: ActionLaneStatus.ACTIVE,
      },
      include: {
        campaign: true,
      },
    });
  }

  async getActionLane(userId: string, actionLaneId: string) {
    const actionLane = await prisma.actionLane.findFirst({
      where: { id: actionLaneId },
      include: {
        campaign: { select: { id: true, userId: true, title: true } },
        actionCycles: {
          include: {
            actionItems: {
              orderBy: { priorityScore: 'desc' },
              take: 10,
            },
          },
          orderBy: [{ cycleNumber: 'desc' }, { priorityScore: 'desc' }],
        },
        actionItems: {
          where: {
            status: { in: [ActionItemStatus.suggested, ActionItemStatus.ready, ActionItemStatus.in_progress] },
          },
          orderBy: { priorityScore: 'desc' },
          take: 20,
        },
        campaignMetrics: {
          orderBy: { computedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!actionLane || actionLane.campaign.userId !== userId) {
      throw new NotFoundException('Action lane not found');
    }

    return actionLane;
  }

  async listActionLanes(userId: string, campaignId?: string, status?: ActionLaneStatus) {
    const where: any = {};
    
    if (campaignId) {
      where.campaignId = campaignId;
      // Verify campaign ownership
      await this.findCampaign(userId, campaignId);
    } else {
      where.campaign = { is: { userId } };
    }
    
    if (status) {
      where.status = status;
    }

    return prisma.actionLane.findMany({
      where,
      include: {
        campaign: { select: { id: true, title: true, status: true } },
        _count: {
          select: {
            actionCycles: true,
            actionItems: true,
          },
        },
      },
      orderBy: { priorityScore: 'desc' },
    });
  }

  async updateActionLane(userId: string, actionLaneId: string, data: UpdateActionLaneDto) {
    await this.getActionLane(userId, actionLaneId);
    
    return prisma.actionLane.update({
      where: { id: actionLaneId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        campaign: true,
      },
    });
  }

  async deleteActionLane(userId: string, actionLaneId: string) {
    await this.getActionLane(userId, actionLaneId);
    
    return prisma.actionLane.delete({
      where: { id: actionLaneId },
    });
  }

  // ACTION CYCLE OPERATIONS
  async createActionCycle(userId: string, data: CreateActionCycleDto) {
    const actionLane = await this.verifyActionLaneOwnership(userId, data.actionLaneId);

    return prisma.actionCycle.create({
      data: {
        campaignId: actionLane.campaignId,
        actionLaneId: data.actionLaneId,
        cycleNumber: data.cycleNumber,
        title: data.title,
        objective: data.objective,
        targetType: data.targetType,
        targetId: data.targetId,
        actionType: data.actionType,
        priorityScore: data.priorityScore || 50,
        status: data.status || ActionCycleStatus.planned,
        surfacedAt: data.status === ActionCycleStatus.surfaced ? new Date() : undefined,
        executionDataJson: data.executionDataJson,
        generatedReasoningJson: data.generatedReasoningJson,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      },
      include: {
        campaign: true,
        actionLane: true,
        actionItems: true,
      },
    });
  }

  async getActionCycle(userId: string, actionCycleId: string) {
    const actionCycle = await prisma.actionCycle.findFirst({
      where: { id: actionCycleId },
      include: {
        campaign: { select: { id: true, userId: true, title: true } },
        actionLane: true,
        actionItems: {
          include: {
            targetPerson: true,
            targetCompany: true,
          },
          orderBy: { priorityScore: 'desc' },
        },
      },
    });

    if (!actionCycle || actionCycle.campaign.userId !== userId) {
      throw new NotFoundException('Action cycle not found');
    }

    return actionCycle;
  }

  async listActionCycles(userId: string, campaignId?: string, actionLaneId?: string, status?: ActionCycleStatus) {
    const where: any = {};
    
    if (campaignId) {
      where.campaignId = campaignId;
      // Verify campaign ownership
      await this.findCampaign(userId, campaignId);
    } else if (actionLaneId) {
      where.actionLaneId = actionLaneId;
      // Verify lane ownership
      const actionLane = await this.verifyActionLaneOwnership(userId, actionLaneId);
      where.campaignId = actionLane.campaignId;
    } else {
      where.campaign = { is: { userId } };
    }
    
    if (status) {
      where.status = status;
    }

    return prisma.actionCycle.findMany({
      where,
      include: {
        campaign: { select: { id: true, title: true } },
        actionLane: { select: { id: true, title: true, laneType: true } },
        _count: {
          select: {
            actionItems: true,
          },
        },
      },
      orderBy: [{ cycleNumber: 'desc' }, { priorityScore: 'desc' }],
    });
  }

  async updateActionCycle(userId: string, actionCycleId: string, data: UpdateActionCycleDto) {
    await this.getActionCycle(userId, actionCycleId);
    
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // Add timestamps based on status changes
    if (data.status) {
      switch (data.status) {
        case ActionCycleStatus.pursuing:
        case ActionCycleStatus.active:
          updateData.pursuingAt = new Date();
          break;
        case ActionCycleStatus.executed:
          updateData.executedAt = new Date();
          break;
        case ActionCycleStatus.confirmed:
        case ActionCycleStatus.completed:
          updateData.confirmedAt = new Date();
          break;
      }
    }

    return prisma.actionCycle.update({
      where: { id: actionCycleId },
      data: updateData,
      include: {
        campaign: true,
        actionLane: true,
        actionItems: true,
      },
    });
  }

  async deleteActionCycle(userId: string, actionCycleId: string) {
    await this.getActionCycle(userId, actionCycleId);
    
    return prisma.actionCycle.delete({
      where: { id: actionCycleId },
    });
  }

  // ACTION ITEM OPERATIONS
  async createActionItem(userId: string, data: CreateActionItemDto) {
    const actionLane = await this.verifyActionLaneOwnership(userId, data.actionLaneId);

    if (data.actionCycleId) {
      await this.verifyActionCycleBelongsToLane(userId, data.actionCycleId, actionLane.id);
    }

    await this.verifyOptionalTargets(userId, data.targetPersonId, data.targetCompanyId);

    return prisma.actionItem.create({
      data: {
        userId,
        campaignId: actionLane.campaignId,
        actionLaneId: actionLane.id,
        actionCycleId: data.actionCycleId,
        targetType: data.targetType,
        targetId: data.targetId,
        targetPersonId: data.targetPersonId,
        targetCompanyId: data.targetCompanyId,
        actionType: data.actionType,
        title: data.title,
        instructions: data.instructions,
        draftContent: data.draftContent,
        finalContent: data.finalContent,
        externalUrl: data.externalUrl,
        externalProvider: data.externalProvider,
        status: data.status || ActionItemStatus.suggested,
        confirmationRequired: data.confirmationRequired ?? true,
        priorityScore: data.priorityScore || 50,
        dueAt: data.dueAt,
        metadataJson: data.metadataJson,
        preparedAt: data.status === ActionItemStatus.ready ? new Date() : undefined,
      },
      include: this.actionItemInclude(),
    });
  }

  async getActionItem(userId: string, actionItemId: string) {
    const actionItem = await prisma.actionItem.findFirst({
      where: { id: actionItemId, userId },
      include: this.actionItemInclude(),
    });

    if (!actionItem) {
      throw new NotFoundException('Action item not found');
    }

    return actionItem;
  }

  async listActionItems(
    userId: string,
    filters: {
      campaignId?: string;
      actionLaneId?: string;
      actionCycleId?: string;
      status?: ActionItemStatus;
    },
  ) {
    const where: any = { userId };

    if (filters.campaignId) {
      await this.findCampaign(userId, filters.campaignId);
      where.campaignId = filters.campaignId;
    }

    if (filters.actionLaneId) {
      const actionLane = await this.verifyActionLaneOwnership(userId, filters.actionLaneId);
      where.actionLaneId = actionLane.id;
    }

    if (filters.actionCycleId) {
      const actionCycle = await this.getActionCycle(userId, filters.actionCycleId);
      where.actionCycleId = actionCycle.id;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return prisma.actionItem.findMany({
      where,
      include: this.actionItemInclude(),
      orderBy: [{ dueAt: 'asc' }, { priorityScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateActionItem(userId: string, actionItemId: string, data: UpdateActionItemDto) {
    await this.getActionItem(userId, actionItemId);

    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    this.applyActionItemStatusTimestamps(updateData, data.status);

    return prisma.actionItem.update({
      where: { id: actionItemId },
      data: updateData,
      include: this.actionItemInclude(),
    });
  }

  async confirmActionItem(userId: string, actionItemId: string, data: ConfirmActionItemDto) {
    const actionItem = await this.getActionItem(userId, actionItemId);
    const occurredAt = data.occurredAt || new Date();
    const confirmationSource = data.confirmationSource || ActionItemConfirmationSource.user_confirmed;
    const confirmedStatus = this.confirmedStatusForAction(actionItem.actionType);
    const finalContent = data.finalContent ?? actionItem.finalContent ?? actionItem.draftContent;

    return prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          userId,
          personId: actionItem.targetPersonId,
          companyId: actionItem.targetCompanyId,
          activityType: this.activityTypeForAction(actionItem.actionType),
          channel: actionItem.externalProvider || this.channelForLane(actionItem.actionLane.laneType),
          direction: 'outbound',
          subject: actionItem.title,
          bodySummary: finalContent,
          occurredAt,
          outcome: data.outcome || 'confirmed',
          metadataJson: {
            actionItemId: actionItem.id,
            campaignId: actionItem.campaignId,
            actionLaneId: actionItem.actionLaneId,
            actionCycleId: actionItem.actionCycleId,
            confirmationSource,
            actionType: actionItem.actionType,
          },
        },
      });

      return tx.actionItem.update({
        where: { id: actionItem.id },
        data: {
          status: confirmedStatus,
          confirmationSource,
          finalContent,
          activityId: activity.id,
          completedAt: occurredAt,
          updatedAt: new Date(),
        },
        include: this.actionItemInclude(),
      });
    });
  }

  async deleteActionItem(userId: string, actionItemId: string) {
    await this.getActionItem(userId, actionItemId);

    return prisma.actionItem.delete({
      where: { id: actionItemId },
    });
  }

  // AI DECISION SUPPORT
  async getNextBestAction(userId: string, campaignId: string) {
    const campaign = await this.getCampaign(userId, campaignId);
    
    // Get all active lanes with their execution records
    const lanesWithCycles = await prisma.actionLane.findMany({
      where: { 
        campaignId,
        status: ActionLaneStatus.ACTIVE 
      },
      include: {
        actionCycles: {
          where: { 
            status: { in: [ActionCycleStatus.planned, ActionCycleStatus.active, ActionCycleStatus.surfaced, ActionCycleStatus.pursuing] }
          },
          include: {
            actionItems: {
              where: {
                status: { in: [ActionItemStatus.suggested, ActionItemStatus.ready, ActionItemStatus.in_progress] },
              },
              orderBy: { priorityScore: 'desc' },
            },
          },
          orderBy: { priorityScore: 'desc' },
        },
        actionItems: {
          where: {
            status: { in: [ActionItemStatus.suggested, ActionItemStatus.ready, ActionItemStatus.in_progress] },
          },
          orderBy: { priorityScore: 'desc' },
          take: 5,
        },
        campaignMetrics: {
          where: { metricType: 'conversion_rate' },
          orderBy: { computedAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { priorityScore: 'desc' },
    });

    // AI decision logic for lane prioritization
    const laneScores = lanesWithCycles.map(lane => {
      const recentConversionRate = lane.campaignMetrics[0]?.metricValue.toNumber() || 0;
      const activeExecutionCount = lane.actionCycles.length;
      const lanePriority = lane.priorityScore;
      
      // Score based on performance, capacity, and priority
      const performanceScore = recentConversionRate * 0.4;
      const capacityScore = activeExecutionCount < 3 ? 0.3 : 0; // Prefer lanes with capacity
      const priorityScore = (lanePriority / 100) * 0.3;
      
      return {
        lane,
        totalScore: performanceScore + capacityScore + priorityScore,
        recommendation: this.generateLaneRecommendation(lane, activeExecutionCount, recentConversionRate),
      };
    });

    // Sort by total score
    laneScores.sort((a, b) => b.totalScore - a.totalScore);
    
    const bestLane = laneScores[0];
    if (!bestLane) {
      return { recommendation: 'No active lanes available for action', nextAction: null };
    }

    const nextExecution = bestLane.lane.actionCycles[0];
    const nextItem = bestLane.lane.actionItems[0] || nextExecution?.actionItems?.[0];
    
    return {
      recommendation: bestLane.recommendation,
      nextAction: {
        campaign,
        actionLane: bestLane.lane,
        actionCycle: nextExecution,
        actionItem: nextItem || null,
        confidence: bestLane.totalScore,
        alternativeLanes: laneScores.slice(1, 3).map(ls => ({
          lane: ls.lane,
          score: ls.totalScore,
          recommendation: ls.recommendation,
        })),
      },
    };
  }

  // CAMPAIGN METRICS
  async updateCampaignMetrics(userId: string, campaignId: string, metricType: string, value: number) {
    await this.findCampaign(userId, campaignId);
    
    return prisma.campaignMetric.create({
      data: {
        campaignId,
        userId,
        metricType,
        metricValue: value,
        computedAt: new Date(),
      },
    });
  }

  async updateLaneMetrics(userId: string, actionLaneId: string, metricType: string, value: number) {
    await this.getActionLane(userId, actionLaneId);
    
    return prisma.campaignMetric.create({
      data: {
        actionLaneId,
        userId,
        metricType,
        metricValue: value,
        computedAt: new Date(),
      },
    });
  }

  async getCampaignMetrics(userId: string, campaignId: string, metricType?: string) {
    await this.findCampaign(userId, campaignId);
    
    const where: any = { campaignId };
    if (metricType) {
      where.metricType = metricType;
    }

    return prisma.campaignMetric.findMany({
      where,
      orderBy: { computedAt: 'desc' },
      take: 50,
    });
  }

  // PRIVATE HELPER METHODS
  private async findCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });
    
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    
    return campaign;
  }

  private async verifyActionLaneOwnership(userId: string, actionLaneId: string) {
    const actionLane = await prisma.actionLane.findFirst({
      where: { id: actionLaneId },
      include: {
        campaign: { select: { id: true, userId: true } },
      },
    });

    if (!actionLane || actionLane.campaign.userId !== userId) {
      throw new NotFoundException('Action lane not found');
    }

    return actionLane;
  }

  private async verifyActionCycleBelongsToLane(userId: string, actionCycleId: string, actionLaneId: string) {
    const actionCycle = await this.getActionCycle(userId, actionCycleId);

    if (actionCycle.actionLaneId !== actionLaneId) {
      throw new BadRequestException('Action cycle does not belong to the provided action lane');
    }

    return actionCycle;
  }

  private async verifyOptionalTargets(userId: string, targetPersonId?: string, targetCompanyId?: string) {
    if (targetPersonId) {
      const person = await prisma.person.findFirst({ where: { id: targetPersonId, userId } });
      if (!person) throw new NotFoundException('Target person not found');
    }

    if (targetCompanyId) {
      const company = await prisma.company.findFirst({ where: { id: targetCompanyId, userId } });
      if (!company) throw new NotFoundException('Target company not found');
    }
  }

  private actionItemInclude() {
    return {
      campaign: { select: { id: true, title: true, status: true } },
      actionLane: { select: { id: true, title: true, laneType: true, status: true } },
      actionCycle: { select: { id: true, title: true, cycleNumber: true, status: true } },
      targetPerson: true,
      targetCompany: true,
      activity: true,
      workspaceCommand: { select: { id: true, commandType: true, status: true } },
    };
  }

  private applyActionItemStatusTimestamps(updateData: any, status?: ActionItemStatus) {
    if (!status) return;

    const now = new Date();
    switch (status) {
      case ActionItemStatus.ready:
        updateData.preparedAt = now;
        break;
      case ActionItemStatus.in_progress:
        updateData.openedAt = now;
        break;
      case ActionItemStatus.sent_confirmed:
      case ActionItemStatus.published_confirmed:
      case ActionItemStatus.converted:
        updateData.completedAt = now;
        break;
      case ActionItemStatus.skipped:
      case ActionItemStatus.failed:
        updateData.skippedAt = now;
        break;
      case ActionItemStatus.responded:
        updateData.respondedAt = now;
        break;
    }
  }

  private confirmedStatusForAction(actionType: string): ActionItemStatus {
    return actionType.includes('post') || actionType.includes('publish')
      ? ActionItemStatus.published_confirmed
      : ActionItemStatus.sent_confirmed;
  }

  private activityTypeForAction(actionType: string): ActivityType {
    if (actionType.includes('linkedin')) return ActivityType.linkedin_message;
    if (actionType.includes('email')) return ActivityType.email;
    if (actionType.includes('call')) return ActivityType.call;
    if (actionType.includes('follow')) return ActivityType.follow_up;
    return ActivityType.note_event;
  }

  private channelForLane(laneType: string): string {
    if (laneType.includes('linkedin')) return 'linkedin';
    if (laneType.includes('email')) return 'email';
    if (laneType.includes('call')) return 'phone';
    return laneType;
  }

  private generateLaneRecommendation(lane: any, activeExecutionCount: number, conversionRate: number): string {
    const laneType = lane.laneType.replace('_', ' ');
    
    if (activeExecutionCount === 0) {
      return `${laneType} lane is idle - consider surfacing new targets or refining strategy`;
    }
    
    if (conversionRate > 0.3) {
      return `${laneType} lane is performing well - consider increasing capacity or expanding target criteria`;
    }
    
    if (conversionRate < 0.1) {
      return `${laneType} lane needs attention - review strategy, target criteria, or messaging`;
    }
    
    return `${laneType} lane is steady - continue current approach and monitor performance`;
  }
}
