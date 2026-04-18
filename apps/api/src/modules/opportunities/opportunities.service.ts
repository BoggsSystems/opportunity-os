import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Opportunity } from '@opportunity-os/db';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

const prisma = new PrismaClient();

@Injectable()
export class OpportunitiesService {
  async create(createOpportunityDto: CreateOpportunityDto, userId: string): Promise<Opportunity> {
    return prisma.opportunity.create({
      data: {
        ...createOpportunityDto,
        userId,
      },
    });
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

    return prisma.opportunity.update({
      where: { id },
      data: updateOpportunityDto,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await prisma.opportunity.delete({
      where: { id },
    });
  }
}
