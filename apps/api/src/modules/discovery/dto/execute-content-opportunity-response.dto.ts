export class ExecutedTargetDto {
  personId: string;
  fullName: string;
  companyId: string;
  companyName: string;
  opportunityId: string;
  taskId: string;
  activityId: string;
  reasonForOutreach: string;
  suggestedAngle: string;
}

export class ExecuteContentOpportunityResponseDto {
  contentOpportunityId: string;
  discoveredItemId: string;
  offeringId?: string;
  executed: boolean;
  targetCount: number;
  targets: ExecutedTargetDto[];
}
