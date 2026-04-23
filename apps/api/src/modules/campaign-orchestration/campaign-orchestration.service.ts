import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  CampaignStatus,
  ActionLaneType,
  ActionLaneStatus,
  ActionCycleStatus,
  Prisma,
  prisma,
} from '@opportunity-os/db';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateActionLaneDto,
  UpdateActionLaneDto,
  CreateActionCycleDto,
  UpdateActionCycleDto,
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
          orderBy: { priorityScore: 'desc' },
          include: {
            campaignMetrics: {
              where: { metricType: 'conversion_rate' },
              orderBy: { computedAt: 'desc' },
              take: 5,
            },
          },
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
      where.campaign = { userId };
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
          },
        },
      },
      orderBy: { priorityScore: 'desc' },
    });
  }

  async updateActionLane(userId: string, actionLaneId: string, data: UpdateActionLaneDto) {
    const actionLane = await this.getActionLane(userId, actionLaneId);
    
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
    // Verify campaign ownership through lane
    const actionLane = await this.getActionLane(data.actionLaneId);
    if (actionLane.campaign.userId !== userId) {
      throw new NotFoundException('Action lane not found');
    }

    return prisma.actionCycle.create({
      data: {
        campaignId: data.campaignId,
        actionLaneId: data.actionLaneId,
        targetType: data.targetType,
        targetId: data.targetId,
        actionType: data.actionType,
        priorityScore: data.priorityScore || 50,
        status: ActionCycleStatus.surfaced,
        surfacedAt: new Date(),
        executionDataJson: data.executionDataJson,
      },
      include: {
        campaign: true,
        actionLane: true,
      },
    });
  }

  async getActionCycle(userId: string, actionCycleId: string) {
    const actionCycle = await prisma.actionCycle.findFirst({
      where: { id: actionCycleId },
      include: {
        campaign: { select: { id: true, userId: true, title: true } },
        actionLane: true,
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
      const actionLane = await this.getActionLane(userId, actionLaneId);
      where.campaignId = actionLane.campaignId;
    } else {
      where.campaign = { userId };
    }
    
    if (status) {
      where.status = status;
    }

    return prisma.actionCycle.findMany({
      where,
      include: {
        campaign: { select: { id: true, title: true } },
        actionLane: { select: { id: true, title: true, laneType: true } },
      },
      orderBy: { priorityScore: 'desc' },
    });
  }

  async updateActionCycle(userId: string, actionCycleId: string, data: UpdateActionCycleDto) {
    const actionCycle = await this.getActionCycle(userId, actionCycleId);
    
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // Add timestamps based on status changes
    if (data.status) {
      switch (data.status) {
        case ActionCycleStatus.pursuing:
          updateData.pursuingAt = new Date();
          break;
        case ActionCycleStatus.executed:
          updateData.executedAt = new Date();
          break;
        case ActionCycleStatus.confirmed:
          updateData.confirmedAt = new Date();
          break;
        case ActionCycleStatus.completed:
          updateData.completedAt = new Date();
          break;
      }
    }

    return prisma.actionCycle.update({
      where: { id: actionCycleId },
      data: updateData,
      include: {
        campaign: true,
        actionLane: true,
      },
    });
  }

  async deleteActionCycle(userId: string, actionCycleId: string) {
    await this.getActionCycle(userId, actionCycleId);
    
    return prisma.actionCycle.delete({
      where: { id: actionCycleId },
    });
  }

  // AI DECISION SUPPORT
  async getNextBestAction(userId: string, campaignId: string) {
    const campaign = await this.getCampaign(userId, campaignId);
    
    // Get all active lanes with their cycles
    const lanesWithCycles = await prisma.actionLane.findMany({
      where: { 
        campaignId,
        status: ActionLaneStatus.ACTIVE 
      },
      include: {
        actionCycles: {
          where: { 
            status: { in: [ActionCycleStatus.surfaced, ActionCycleStatus.pursuing] }
          },
          orderBy: { priorityScore: 'desc' },
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
      const activeCycleCount = lane.actionCycles.length;
      const lanePriority = lane.priorityScore;
      
      // Score based on performance, capacity, and priority
      const performanceScore = recentConversionRate * 0.4;
      const capacityScore = activeCycleCount < 3 ? 0.3 : 0; // Prefer lanes with capacity
      const priorityScore = (lanePriority / 100) * 0.3;
      
      return {
        lane,
        totalScore: performanceScore + capacityScore + priorityScore,
        recommendation: this.generateLaneRecommendation(lane, activeCycleCount, recentConversionRate),
      };
    });

    // Sort by total score
    laneScores.sort((a, b) => b.totalScore - a.totalScore);
    
    const bestLane = laneScores[0];
    if (!bestLane) {
      return { recommendation: 'No active lanes available for action', nextAction: null };
    }

    const nextCycle = bestLane.lane.actionCycles[0];
    
    return {
      recommendation: bestLane.recommendation,
      nextAction: {
        campaign,
        actionLane: bestLane.lane,
        actionCycle: nextCycle,
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
    const actionLane = await this.getActionLane(userId, actionLaneId);
    
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

  private generateLaneRecommendation(lane: any, activeCycleCount: number, conversionRate: number): string {
    const laneType = lane.laneType.replace('_', ' ');
    
    if (activeCycleCount === 0) {
      return `${laneType} lane is idle - consider surfacing new targets or adjusting strategy`;
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
