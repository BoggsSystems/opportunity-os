import { OpportunityStage, OpportunityType } from '@opportunity-os/db';
export declare class UpdateOpportunityDto {
    title?: string;
    companyId?: string;
    primaryPersonId?: string;
    opportunityType?: OpportunityType;
    stage?: OpportunityStage;
    status?: string;
    source?: string;
    priority?: string;
    fitScore?: number;
    qualificationScore?: number;
    summary?: string;
    nextAction?: string;
    nextActionDate?: Date;
    estimatedValueCents?: number;
    closeProbability?: number;
}
//# sourceMappingURL=update-opportunity.dto.d.ts.map