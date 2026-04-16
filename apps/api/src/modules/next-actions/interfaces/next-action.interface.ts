export interface NextActionItem {
  type: 'task' | 'opportunity' | 'discovery' | 'follow_up';
  priorityScore: number;
  title: string;
  reason: string;
  recommendedAction: string;
  opportunityId?: string;
  companyId?: string;
  personId?: string;
  taskId?: string;
  discoveredOpportunityId?: string;
  aiExplanation?: string;
  offeringRelevance?: string;
}

export interface CandidateAction {
  type: NextActionItem['type'];
  priorityScore: number;
  title: string;
  reason: string;
  recommendedAction: string;
  opportunityId?: string;
  companyId?: string;
  personId?: string;
  taskId?: string;
  discoveredOpportunityId?: string;
  aiExplanation?: string;
  offeringRelevance?: string;
}

export interface ActionGenerator {
  generateCandidateActions(userId: string): Promise<CandidateAction[]>;
}
