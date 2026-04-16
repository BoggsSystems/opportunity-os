import { Injectable } from '@nestjs/common';
import { ContentOpportunity, DiscoveredOpportunity, PrismaClient } from '@opportunity-os/db';
import { CandidateAction, ActionGenerator } from '../interfaces/next-action.interface';

const prisma = new PrismaClient();

@Injectable()
export class DiscoveryGenerator implements ActionGenerator {
  async generateCandidateActions(userId: string): Promise<CandidateAction[]> {
    const actions: CandidateAction[] = [];

    // Get unreviewed discovered opportunities
    const discoveredOpportunities = await prisma.discoveredOpportunity.findMany({
      where: {
        discoveredItem: {
          userId,
        },
        promotedOpportunityId: null, // Only unpromoted discoveries
      },
      take: 10,
    });

    // For V1, just process all discovered opportunities (user filtering will be handled at query level)
    discoveredOpportunities.forEach(discovered => {
      const priorityScore = this.calculateDiscoveryPriority(discovered);
      
      actions.push({
        type: 'discovery',
        priorityScore,
        title: `New Discovery: ${discovered.companyName}`,
        reason: `Unreviewed opportunity: ${discovered.opportunityType}`,
        recommendedAction: 'Review and decide whether to promote to opportunity',
        discoveredOpportunityId: discovered.id,
      });
    });

    const contentOpportunities = await prisma.contentOpportunity.findMany({
      where: {
        createdTaskId: null,
        discoveredItem: {
          userId,
        },
      },
      include: {
        discoveredItem: true,
        offering: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });

    contentOpportunities.forEach((contentOpportunity) => {
      const priorityScore = this.calculateContentPriority(contentOpportunity);
      const offeringTitle = contentOpportunity.offering?.title;

      actions.push({
        type: 'discovery',
        priorityScore,
        title: `Leverage Content: ${contentOpportunity.discoveredItem.title}`,
        reason: offeringTitle
          ? `New content opportunity linked to ${offeringTitle}`
          : 'New content opportunity ready for positioning or outreach use',
        recommendedAction: offeringTitle
          ? `Review this content and decide how to use it in ${offeringTitle}`
          : 'Review this content and decide how to use it in positioning or outreach',
        contentOpportunityId: contentOpportunity.id,
      });
    });

    return actions;
  }

  private calculateDiscoveryPriority(discovered: DiscoveredOpportunity): number {
    let score = 50; // Base score for discoveries

    // For V1, use a simple scoring based on opportunity stage
    if (discovered.opportunityStage === 'discovered') {
      score += 20;
    }

    // Boost for recent opportunities
    if (discovered.createdAt) {
      const daysSinceCreation = this.getDaysSince(discovered.createdAt);
      if (daysSinceCreation <= 7) {
        score += 10;
      }
    }

    return Math.min(score, 100); // Cap at 100
  }

  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateContentPriority(contentOpportunity: ContentOpportunity): number {
    let score = 55;

    score += Math.min(contentOpportunity.urgencyLevel * 3, 20);

    if (contentOpportunity.offeringId) {
      score += 10;
    }

    if (contentOpportunity.createdAt) {
      const daysSinceCreation = this.getDaysSince(contentOpportunity.createdAt);
      if (daysSinceCreation <= 3) {
        score += 10;
      } else if (daysSinceCreation <= 7) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  }
}
