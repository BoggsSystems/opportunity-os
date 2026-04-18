import { Injectable } from '@nestjs/common';
import { DiscoveredOpportunity, prisma } from '@opportunity-os/db';
import { CandidateAction, ActionGenerator } from '../interfaces/next-action.interface';

@Injectable()
export class DiscoveryGenerator implements ActionGenerator {
  async generateCandidateActions(userId: string): Promise<CandidateAction[]> {
    const actions: CandidateAction[] = [];

    const discoveredOpportunities = await prisma.discoveredOpportunity.findMany({
      where: {
        searchRun: {
          searchProfile: {
            userId,
          },
        },
        lifecycleStatus: 'new',
      },
      orderBy: [
        { priorityScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 10,
    });

    discoveredOpportunities.forEach((discovered) => {
      const priorityScore = this.calculateDiscoveryPriority(discovered);
      const isContentUpload = discovered.sourceType === 'content_upload';

      actions.push({
        type: 'discovery',
        priorityScore,
        title: isContentUpload
          ? `Leverage Content: ${discovered.title}`
          : `New Discovery: ${discovered.companyNameRaw || discovered.title}`,
        reason: isContentUpload
          ? 'Uploaded content is ready to review and operationalize'
          : `Unreviewed discovered opportunity from ${discovered.sourceType}`,
        recommendedAction: isContentUpload
          ? 'Review this uploaded content and decide whether to generate outreach targets'
          : 'Review and decide whether to promote to an opportunity',
        discoveredOpportunityId: discovered.id,
        contentOpportunityId: isContentUpload ? discovered.id : undefined,
      });
    });

    return actions;
  }

  private calculateDiscoveryPriority(discovered: DiscoveredOpportunity): number {
    let score = discovered.priorityScore ?? 50;

    if (discovered.sourceType === 'content_upload') {
      score += 10;
    }

    if (discovered.fitScore) {
      score += Math.min(discovered.fitScore, 20);
    }

    if (discovered.createdAt) {
      const daysSinceCreation = this.getDaysSince(discovered.createdAt);
      if (daysSinceCreation <= 3) {
        score += 10;
      } else if (daysSinceCreation <= 7) {
        score += 5;
      }
    }

    return Math.min(score, 100);
  }

  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
