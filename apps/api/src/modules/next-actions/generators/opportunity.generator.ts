import { Injectable } from '@nestjs/common';
import { PrismaClient, OpportunityStage } from '@opportunity-os/db';
import { CandidateAction, ActionGenerator } from '../interfaces/next-action.interface';

const prisma = new PrismaClient();

@Injectable()
export class OpportunityGenerator implements ActionGenerator {
  async generateCandidateActions(userId: string): Promise<CandidateAction[]> {
    const actions: CandidateAction[] = [];

    // Get active opportunities with no recent activity (7+ days)
    const staleOpportunities = await prisma.opportunity.findMany({
      where: {
        userId,
        stage: {
          notIn: [OpportunityStage.closed_won, OpportunityStage.closed_lost],
        },
      },
      include: {
        activities: {
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 10,
    });

    staleOpportunities.forEach(opportunity => {
      if (opportunity.activities.length === 0) {
        actions.push({
          type: 'opportunity',
          priorityScore: 70,
          title: `No Recent Activity: ${opportunity.title}`,
          reason: 'Opportunity has no activity in the last 7 days',
          recommendedAction: 'Reach out to move this opportunity forward',
          opportunityId: opportunity.id,
          companyId: opportunity.companyId,
          personId: opportunity.primaryPersonId || undefined,
        });
      }
    });

    // Get active opportunities without open follow-up tasks
    const opportunitiesWithoutFollowUp = await prisma.opportunity.findMany({
      where: {
        userId,
        stage: {
          notIn: [OpportunityStage.closed_won, OpportunityStage.closed_lost],
        },
      },
      include: {
        tasks: {
          where: {
            status: 'open',
          },
        },
      },
      take: 10,
    });

    opportunitiesWithoutFollowUp.forEach(opportunity => {
      if (opportunity.tasks.length === 0) {
        actions.push({
          type: 'follow_up',
          priorityScore: 65,
          title: `Follow Up Needed: ${opportunity.title}`,
          reason: 'Active opportunity without a follow-up task',
          recommendedAction: 'Create a follow-up task for this opportunity',
          opportunityId: opportunity.id,
          companyId: opportunity.companyId,
          personId: opportunity.primaryPersonId || undefined,
        });
      }
    });

    // Get opportunities stuck in early stages for too long
    const stalledOpportunities = await prisma.opportunity.findMany({
      where: {
        userId,
        stage: {
          in: [OpportunityStage.new, OpportunityStage.targeted],
        },
        createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      take: 5,
    });

    stalledOpportunities.forEach(opportunity => {
      actions.push({
        type: 'opportunity',
        priorityScore: 55,
        title: `Stalled: ${opportunity.title}`,
        reason: `Opportunity has been in ${opportunity.stage} stage for over 14 days`,
        recommendedAction: 'Consider advancing or closing this opportunity',
        opportunityId: opportunity.id,
        companyId: opportunity.companyId,
        personId: opportunity.primaryPersonId || undefined,
      });
    });

    return actions;
  }
}
