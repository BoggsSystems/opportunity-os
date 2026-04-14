import { BaseEntity } from '../common/types';
import { OpportunityStage, ActivityType, TaskStatus, Priority } from '../common/enums';
export interface Company extends BaseEntity {
    name: string;
    domain?: string;
    description?: string;
    website?: string;
    size?: string;
    industry?: string;
    foundedYear?: number;
    location?: string;
    logoUrl?: string;
    userId: string;
}
export interface Person extends BaseEntity {
    firstName: string;
    lastName: string;
    email?: string;
    title?: string;
    seniority?: string;
    department?: string;
    linkedinUrl?: string;
    avatarUrl?: string;
    companyId: string;
}
export interface Opportunity extends BaseEntity {
    title: string;
    description?: string;
    stage: OpportunityStage;
    priority?: Priority;
    value?: number;
    closeDate?: Date;
    source?: string;
    tags: string[];
    userId: string;
    companyId?: string;
}
export interface Activity extends BaseEntity {
    type: ActivityType;
    title: string;
    description?: string;
    metadata?: any;
    userId: string;
    opportunityId?: string;
}
export interface Task extends BaseEntity {
    title: string;
    description?: string;
    status: TaskStatus;
    priority?: Priority;
    dueDate?: Date;
    completedAt?: Date;
    userId: string;
    opportunityId?: string;
}
//# sourceMappingURL=types.d.ts.map