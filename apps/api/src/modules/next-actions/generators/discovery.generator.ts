import { Injectable } from '@nestjs/common';
import { PrismaClient, DiscoveredOpportunity, DiscoveredOpportunityStatus } from '@opportunity-os/db';
import { CandidateAction, ActionGenerator } from '../interfaces/next-action.interface';

const prisma = new PrismaClient();

@Injectable()
export class DiscoveryGenerator implements ActionGenerator {
  async generateCandidateActions(userId: string): Promise<CandidateAction[]> {
    const actions: CandidateAction[] = [];

    // Get unreviewed discovered opportunities
    const discoveredOpportunities = await prisma.discoveredOpportunity.findMany({
      where: {
        lifecycleStatus: DiscoveredOpportunityStatus.new,
      },
      include: {
        searchRun: {
          include: {
            searchProfile: true,
          },
        },
      },
      take: 10,
    });

    // Filter by user in memory due to Prisma limitations
    const userDiscoveredOpportunities = discoveredOpportunities.filter(
      discovered => discovered.searchRun.searchProfile.userId === userId
    );

    userDiscoveredOpportunities.forEach(discovered => {
      const priorityScore = this.calculateDiscoveryPriority(discovered);
      
      actions.push({
        type: 'discovery',
        priorityScore,
        title: `New Discovery: ${discovered.title}`,
        reason: `Unreviewed opportunity from ${discovered.sourceType}`,
        recommendedAction: 'Review and decide whether to promote to opportunity',
        discoveredOpportunityId: discovered.id,
      });
    });

    return actions;
  }

  private calculateDiscoveryPriority(discovered: DiscoveredOpportunity): number {
    let score = 50; // Base score for discoveries

    // Boost for high fit score
    if (discovered.fitScore && discovered.fitScore > 80) {
      score += 20;
    }

    // Boost for high priority score
    if (discovered.priorityScore && discovered.priorityScore > 80) {
      score += 15;
    }

    // Boost for recent postings
    if (discovered.postedAt) {
      const daysSincePosting = this.getDaysSince(discovered.postedAt);
      if (daysSincePosting <= 7) {
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
}
