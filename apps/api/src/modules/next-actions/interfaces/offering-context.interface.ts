export interface OfferingContext {
  offering: {
    id: string;
    title: string;
    description: string;
    offeringType: string;
    status: string;
  };
  positionings: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
  }>;
  assets: Array<{
    id: string;
    title: string;
    description: string;
    assetType: string;
    contentUrl?: string;
    contentText?: string;
    isPublic: boolean;
    status: string;
    offeringPositioningId?: string;
  }>;
}

export interface OfferingInterpretation {
  targetAudience: string[];
  likelyOpportunityTypes: string[];
  likelyChannels: string[];
  supportingAssets: string[];
  nextStepPatterns: string[];
  strategicFocus: string[];
}
