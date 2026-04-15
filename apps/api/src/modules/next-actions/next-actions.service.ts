import { Injectable } from '@nestjs/common';
import { TaskGenerator } from './generators/task.generator';
import { OpportunityGenerator } from './generators/opportunity.generator';
import { DiscoveryGenerator } from './generators/discovery.generator';
import { OfferingContextService } from './offerings/offering-context.service';
import { NextActionItem, CandidateAction } from './interfaces/next-action.interface';
import { OfferingContext, OfferingInterpretation } from './interfaces/offering-context.interface';

@Injectable()
export class NextActionsService {
  constructor(
    private taskGenerator: TaskGenerator,
    private opportunityGenerator: OpportunityGenerator,
    private discoveryGenerator: DiscoveryGenerator,
    private offeringContextService: OfferingContextService,
  ) {}

  async getNextActions(userId: string): Promise<NextActionItem[]> {
    // Phase 1: Offering Context Resolution
    const offeringContext = await this.offeringContextService.getActiveOfferingContext(userId);
    
    let offeringInterpretation: OfferingInterpretation | null = null;
    if (offeringContext) {
      offeringInterpretation = await this.offeringContextService.interpretOffering(offeringContext);
    }

    // Phase 2: Generate candidate actions from all generators
    const taskActions = await this.taskGenerator.generateCandidateActions(userId);
    const opportunityActions = await this.opportunityGenerator.generateCandidateActions(userId);
    const discoveryActions = await this.discoveryGenerator.generateCandidateActions(userId);

    // Combine all candidate actions
    const allCandidates: CandidateAction[] = [
      ...taskActions,
      ...opportunityActions,
      ...discoveryActions,
    ];

    // Phase 3: Apply offering-aware scoring
    const rankedActions = this.rankActions(allCandidates, offeringContext, offeringInterpretation);

    // Return top 10 actions
    return rankedActions.slice(0, 10);
  }

  private rankActions(
    candidates: CandidateAction[], 
    offeringContext: OfferingContext | null, 
    offeringInterpretation: OfferingInterpretation | null
  ): NextActionItem[] {
    // Sort by base priority score (descending)
    const sorted = candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    // Apply offering-aware ranking logic
    return sorted.map((action, index) => {
      let finalScore = action.priorityScore;
      
      // Apply position-based scoring (higher position gets slight boost)
      const positionBoost = Math.max(0, 10 - index) * 2;
      finalScore += positionBoost;

      // Apply offering relevance boost if context is available
      if (offeringContext && offeringInterpretation) {
        const offeringBoost = this.calculateOfferingRelevanceBoost(action, offeringContext, offeringInterpretation);
        finalScore += offeringBoost;
      }

      return {
        ...action,
        priorityScore: finalScore,
      };
    });
  }

  private calculateOfferingRelevanceBoost(
    action: CandidateAction, 
    context: OfferingContext, 
    interpretation: OfferingInterpretation
  ): number {
    let boost = 0;

    // Boost actions that align with target audience
    if (action.type === 'opportunity' && interpretation.targetAudience.length > 0) {
      boost += 5; // Opportunity-focused actions get boost when we have clear target audience
    }

    // Additional context-based boost for consulting offerings
    if (context.offering.offeringType === 'consulting' && action.type === 'opportunity') {
      boost += 3;
    }

    // Boost actions that align with strategic focus
    if (interpretation.strategicFocus.includes('AI Integration') && 
        (action.title.includes('AI') || action.reason.includes('AI'))) {
      boost += 8;
    }

    if (interpretation.strategicFocus.includes('Delivery Optimization') && 
        (action.title.includes('delivery') || action.reason.includes('workflow'))) {
      boost += 8;
    }

    // Boost actions that utilize supporting assets
    if (interpretation.supportingAssets.length > 0 && 
        (action.recommendedAction.includes('share') || action.recommendedAction.includes('present'))) {
      boost += 3;
    }

    // Boost actions that align with likely channels
    if (interpretation.likelyChannels.includes('Executive Meetings') && 
        (action.title.includes('meeting') || action.title.includes('call'))) {
      boost += 5;
    }

    // Cap the boost to maintain balance
    return Math.min(boost, 15);
  }
}
