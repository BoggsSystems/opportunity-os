import { Injectable } from '@nestjs/common';
import { TaskGenerator } from './generators/task.generator';
import { OpportunityGenerator } from './generators/opportunity.generator';
import { DiscoveryGenerator } from './generators/discovery.generator';
import { NextActionItem, CandidateAction } from './interfaces/next-action.interface';

@Injectable()
export class NextActionsService {
  constructor(
    private taskGenerator: TaskGenerator,
    private opportunityGenerator: OpportunityGenerator,
    private discoveryGenerator: DiscoveryGenerator,
  ) {}

  async getNextActions(userId: string): Promise<NextActionItem[]> {
    // Generate candidate actions from all generators
    const taskActions = await this.taskGenerator.generateCandidateActions(userId);
    const opportunityActions = await this.opportunityGenerator.generateCandidateActions(userId);
    const discoveryActions = await this.discoveryGenerator.generateCandidateActions(userId);

    // Combine all candidate actions
    const allCandidates: CandidateAction[] = [
      ...taskActions,
      ...opportunityActions,
      ...discoveryActions,
    ];

    // Rank and prioritize actions
    const rankedActions = this.rankActions(allCandidates);

    // Return top 10 actions
    return rankedActions.slice(0, 10);
  }

  private rankActions(candidates: CandidateAction[]): NextActionItem[] {
    // Sort by priority score (descending)
    const sorted = candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    // Apply additional ranking logic
    return sorted.map((action, index) => {
      // Apply position-based scoring (higher position gets slight boost)
      const positionBoost = Math.max(0, 10 - index) * 2;
      const finalScore = action.priorityScore + positionBoost;

      return {
        ...action,
        priorityScore: finalScore,
      };
    });
  }
}
