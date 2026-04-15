import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Company } from '@opportunity-os/db';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const prisma = new PrismaClient();

@Injectable()
export class CompaniesService {
  async create(createCompanyDto: CreateCompanyDto, userId: string): Promise<Company> {
    return prisma.company.create({
      data: {
        ...createCompanyDto,
        userId,
      },
    });
  }

  async findAll(userId: string): Promise<Company[]> {
    return prisma.company.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Company> {
    const company = await prisma.company.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto, userId: string): Promise<Company> {
    // Check if company exists and belongs to user
    await this.findOne(id, userId);

    return prisma.company.update({
      where: { id },
      data: updateCompanyDto,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    // Check if company exists and belongs to user
    await this.findOne(id, userId);

    await prisma.company.delete({
      where: { id },
    });
  }
}
