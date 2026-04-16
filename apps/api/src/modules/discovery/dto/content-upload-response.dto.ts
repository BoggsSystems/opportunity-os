export class ContentUploadResponseDto {
  discoveredItemId: string;
  contentOpportunityId?: string;
  title: string;
  source?: string;
  offeringId?: string;
  summary?: string;
  whyItMatters?: string;
  leverageInterpretation?: string;
  aiInterpretationSucceeded: boolean;
  processingStatus: 'pending' | 'classified' | 'promoted' | 'rejected';
}
