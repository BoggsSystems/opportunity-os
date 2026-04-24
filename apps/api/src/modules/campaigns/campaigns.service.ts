import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  OpportunityCyclePhase,
  OpportunityCycleStatus,
  OpportunityStage,
  Prisma,
  TaskPriority,
  TaskStatus,
  WorkspaceMode,
  prisma,
} from '@opportunity-os/db';

@Injectable()
export class CampaignsService {
  async getCurrentCampaignWorkspace(userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { userId, status: { in: ['PLANNING', 'ACTIVE'] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!campaign) {
      return null;
    }
    return this.getCampaignWorkspace(userId, campaign.id);
  }

  async getCampaignWorkspace(userId: string, campaignId: string) {
    const campaign = await this.findCampaign(userId, campaignId);
    const opportunities = await prisma.opportunity.findMany({
      where: { userId, campaignId },
      include: {
        company: true,
        primaryPerson: true,
        activities: { orderBy: { occurredAt: 'desc' }, take: 5 },
        tasks: { where: { status: { in: [TaskStatus.open, TaskStatus.in_progress] } }, orderBy: { dueAt: 'asc' }, take: 5 },
      },
      orderBy: [{ fitScore: 'desc' }, { updatedAt: 'desc' }],
    });

    const prospects = opportunities.map((opportunity) => this.toProspectSummary(opportunity));
    const draftQueue = prospects.filter((prospect) => !prospect.lastEmailAt && prospect.stage !== OpportunityStage.closed_lost);
    const followUpQueue = prospects.filter((prospect) => prospect.lastEmailAt && !prospect.openFollowUpTask);

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        strategicAngle: campaign.strategicAngle,
        targetSegment: campaign.targetSegment,
        status: campaign.status,
        offeringId: campaign.offeringId,
        goalId: campaign.goalId,
        offering: campaign.offering,
        goal: campaign.goal,
      },
      prospects,
      queues: {
        draft: draftQueue,
        followUp: followUpQueue,
        tasks: prospects.filter((prospect) => prospect.openTaskCount > 0),
      },
      metrics: {
        prospectCount: prospects.length,
        draftQueueCount: draftQueue.length,
        followUpQueueCount: followUpQueue.length,
        contactedCount: prospects.filter((prospect) => Boolean(prospect.lastEmailAt)).length,
        advancedCount: prospects.filter((prospect) =>
          ['conversation_started', 'interviewing', 'awaiting_decision', 'closed_won'].includes(prospect.stage),
        ).length,
      },
      nextRecommendedOpportunity: prospects[0] ?? null,
      discovery: await this.getCampaignDiscoverySummary(userId, campaignId),
    };
  }

  async getOpportunityDetail(userId: string, campaignId: string, opportunityId: string) {
    await this.findCampaign(userId, campaignId);
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, userId, campaignId },
      include: {
        company: true,
        primaryPerson: true,
        opportunityPeople: { include: { person: true } },
        activities: { orderBy: { occurredAt: 'desc' }, take: 20 },
        tasks: { orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], take: 20 },
        campaign: { include: { offering: true, goal: true } },
      },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    return {
      opportunity: this.toProspectSummary(opportunity),
      company: opportunity.company,
      primaryPerson: opportunity.primaryPerson,
      people: opportunity.opportunityPeople.map((link) => link.person),
      activities: opportunity.activities,
      tasks: opportunity.tasks,
      campaign: opportunity.campaign,
      recommendedFollowUp: this.buildFollowUpRecommendation(opportunity),
    };
  }

  async createFollowUpTasks(userId: string, campaignId: string, opportunityIds?: string[]) {
    await this.findCampaign(userId, campaignId);
    const opportunities = await prisma.opportunity.findMany({
      where: {
        userId,
        campaignId,
        ...(opportunityIds?.length ? { id: { in: opportunityIds } } : {}),
      },
      include: {
        company: true,
        primaryPerson: true,
        activities: { where: { activityType: ActivityType.email }, orderBy: { occurredAt: 'desc' }, take: 1 },
      },
    });

    const tasks = [];
    for (const opportunity of opportunities) {
      if (opportunity.activities.length === 0) continue;
      const existing = await prisma.task.findFirst({
        where: {
          userId,
          opportunityId: opportunity.id,
          status: { in: [TaskStatus.open, TaskStatus.in_progress] },
          taskType: 'campaign_follow_up',
        },
      });
      if (existing) continue;

      tasks.push(await prisma.task.create({
        data: {
          userId,
          opportunityId: opportunity.id,
          companyId: opportunity.companyId,
          personId: opportunity.primaryPersonId,
          title: `Follow up with ${opportunity.primaryPerson?.fullName ?? opportunity.company.name}`,
          description: this.buildFollowUpRecommendation(opportunity),
          dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          status: TaskStatus.open,
          priority: TaskPriority.medium,
          taskType: 'campaign_follow_up',
        },
      }));
    }

    return { created: tasks.length, tasks };
  }

  async createNextCampaignCycle(userId: string, campaignId: string) {
    const workspace = await this.getCampaignWorkspace(userId, campaignId);
    const next = workspace.nextRecommendedOpportunity;
    if (!next) {
      throw new NotFoundException('No campaign opportunity available');
    }

    const existingCycle = await prisma.opportunityCycle.findFirst({
      where: {
        userId,
        campaignId,
        opportunityId: next.id,
        status: OpportunityCycleStatus.active,
      },
    });
    if (existingCycle) {
      return { cycle: existingCycle };
    }

    const cycle = await prisma.opportunityCycle.create({
      data: {
        userId,
        offeringId: workspace.campaign.offeringId,
        goalId: workspace.campaign.goalId,
        campaignId,
        opportunityId: next.id,
        phase: OpportunityCyclePhase.surfaced,
        status: OpportunityCycleStatus.active,
        workspaceMode: WorkspaceMode.opportunity_review,
        title: `Advance ${next.companyName}`,
        whyItMatters: next.summary ?? `This prospect is next in ${workspace.campaign.title}.`,
        recommendedAction: next.lastEmailAt ? 'Create a follow-up task or draft a follow-up email.' : 'Draft first-touch outreach.',
        priorityScore: next.fitScore ?? 75,
        allowedActionsJson: this.toJson(['create_task', 'advance_opportunity', 'complete_cycle']),
      },
    });

    return { cycle };
  }

  private async findCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        offering: { select: { id: true, title: true, description: true, offeringType: true } },
        goal: { select: { id: true, title: true, description: true } },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  private async getCampaignDiscoverySummary(userId: string, campaignId: string) {
    const scans = await prisma.discoveryScan.findMany({
      where: { userId, campaignId },
      include: { targets: { include: { evidence: true }, orderBy: [{ relevanceScore: 'desc' }, { confidenceScore: 'desc' }] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      scans: scans.map((scan) => ({
        id: scan.id,
        query: scan.query,
        status: scan.status,
        scanType: scan.scanType,
        targetCount: scan.targets.length,
        acceptedCount: scan.acceptedCount,
        rejectedCount: scan.rejectedCount,
        promotedCount: scan.promotedCount,
        createdAt: scan.createdAt,
        targets: scan.targets.slice(0, 10).map((target) => ({
          id: target.id,
          title: target.title,
          status: target.status,
          targetType: target.targetType,
          companyName: target.companyName,
          personName: target.personName,
          roleTitle: target.roleTitle,
          relevanceScore: target.relevanceScore,
          confidenceScore: target.confidenceScore,
          whyThisTarget: target.whyThisTarget,
          recommendedAction: target.recommendedAction,
          opportunityId: target.opportunityId,
          evidence: target.evidence,
        })),
      })),
    };
  }

  private toProspectSummary(opportunity: any) {
    const lastEmail = opportunity.activities?.find((activity: any) => activity.activityType === ActivityType.email);
    const lastActivity = opportunity.activities?.[0] ?? null;
    const openFollowUpTask = opportunity.tasks?.find((task: any) => task.taskType === 'campaign_follow_up');
    return {
      id: opportunity.id,
      title: opportunity.title,
      stage: opportunity.stage,
      status: opportunity.status,
      companyId: opportunity.companyId,
      companyName: opportunity.company?.name,
      primaryPersonId: opportunity.primaryPersonId,
      primaryPersonName: opportunity.primaryPerson?.fullName,
      primaryPersonTitle: opportunity.primaryPerson?.title,
      primaryPersonEmail: opportunity.primaryPerson?.email,
      fitScore: opportunity.fitScore,
      qualificationScore: opportunity.qualificationScore,
      summary: opportunity.summary,
      nextAction: opportunity.nextAction,
      nextActionDate: opportunity.nextActionDate,
      lastActivityAt: lastActivity?.occurredAt ?? null,
      lastEmailAt: lastEmail?.occurredAt ?? null,
      openTaskCount: opportunity.tasks?.length ?? 0,
      openFollowUpTask: openFollowUpTask ? { id: openFollowUpTask.id, title: openFollowUpTask.title, dueAt: openFollowUpTask.dueAt } : null,
    };
  }

  private buildFollowUpRecommendation(opportunity: any) {
    const contact = opportunity.primaryPerson?.fullName ?? `the team at ${opportunity.company.name}`;
    return `Follow up with ${contact} about ${opportunity.title}. Reference the original outreach and offer one concrete next step.`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
