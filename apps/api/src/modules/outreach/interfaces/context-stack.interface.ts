export interface OfferingContext {
  id: string;
  title: string;
  description: string | null;
  valueProposition: string | null;
  metadata: any;
}

export interface CampaignContext {
  id: string;
  name: string;
  strategicAngle: string | null;
  metadata: any;
}

export interface ActionLaneContext {
  id: string;
  name: string;
  type: string | null;
  metadata: any;
}

export interface ActionContext {
  id: string;
  title: string;
  description: string | null;
  suggestedAction: string | null;
  metadata: any;
}

export interface ContextStack {
  offering?: OfferingContext;
  campaign?: CampaignContext;
  actionLane?: ActionLaneContext;
  action: ActionContext;
  
  // Flattened for easy consumption
  persona?: {
    name: string;
    instructions: string;
  };
}
