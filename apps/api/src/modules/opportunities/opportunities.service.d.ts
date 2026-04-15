import { Opportunity } from '@opportunity-os/db';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
export declare class OpportunitiesService {
    create(createOpportunityDto: CreateOpportunityDto, userId: string): Promise<Opportunity>;
    findAll(userId: string): Promise<Opportunity[]>;
    findOne(id: string, userId: string): Promise<Opportunity>;
    update(id: string, updateOpportunityDto: UpdateOpportunityDto, userId: string): Promise<Opportunity>;
    remove(id: string, userId: string): Promise<void>;
}
//# sourceMappingURL=opportunities.service.d.ts.map