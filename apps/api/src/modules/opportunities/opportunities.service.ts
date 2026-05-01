import { Injectable, NotFoundException } from '@nestjs/common';
import { Opportunity, prisma } from '@opportunity-os/db';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { CrmOrchestrator } from '../crm/services/crm-orchestrator.service';

@Injectable()
export class OpportunitiesService {
  constructor(private readonly crmOrchestrator: CrmOrchestrator) {}

  async create(createOpportunityDto: CreateOpportunityDto, userId: string): Promise<Opportunity> {
    const opportunity = await prisma.opportunity.create({
      data: {
        ...createOpportunityDto,
        userId,
      },
    });

    // Async sync to CRM
    this.crmOrchestrator.syncOpportunity(userId, opportunity).catch((err) => {
      console.error('CRM Sync Error (Opportunity):', err);
    });

    return opportunity;
  }

  async findAll(userId: string): Promise<Opportunity[]> {
    const opportunities = await prisma.opportunity.findMany({
      where: {
        userId,
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return opportunities.map((opportunity) => ({
      ...opportunity,
      companyName: opportunity.company.name,
    })) as Opportunity[];
  }

  async findOne(id: string, userId: string): Promise<Opportunity> {
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }
    return {
      ...opportunity,
      companyName: opportunity.company.name,
    } as Opportunity;
  }

  async update(id: string, updateOpportunityDto: UpdateOpportunityDto, userId: string): Promise<Opportunity> {
    await this.findOne(id, userId);

    const updatedOpportunity = await prisma.opportunity.update({
      where: { id },
      data: updateOpportunityDto,
    });

    this.crmOrchestrator.syncOpportunity(userId, updatedOpportunity).catch((err) => {
      console.error('CRM Sync Error (Opportunity Update):', err);
    });

    return updatedOpportunity;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await prisma.opportunity.delete({
      where: { id },
    });
  }
}
