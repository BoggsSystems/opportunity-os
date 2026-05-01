import { Injectable, NotFoundException } from '@nestjs/common';
import { Activity, prisma } from '@opportunity-os/db';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CrmOrchestrator } from '../crm/services/crm-orchestrator.service';

@Injectable()
export class ActivitiesService {
  constructor(private readonly crmOrchestrator: CrmOrchestrator) {}

  async create(createActivityDto: CreateActivityDto, userId: string): Promise<Activity> {
    const activity = await prisma.activity.create({
      data: {
        ...createActivityDto,
        userId,
        occurredAt: new Date(createActivityDto.occurredAt),
      },
    });

    // Async sync to CRM
    this.crmOrchestrator.syncActivity(userId, activity).catch((err) => {
      console.error('CRM Sync Error (Activity):', err);
    });

    return activity;
  }

  async findAll(userId: string): Promise<Activity[]> {
    return prisma.activity.findMany({
      where: {
        userId,
      },
      orderBy: {
        occurredAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Activity> {
    const activity = await prisma.activity.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    return activity;
  }

  async update(id: string, updateActivityDto: UpdateActivityDto, userId: string): Promise<Activity> {
    await this.findOne(id, userId);

    const updateData: any = { ...updateActivityDto };
    if (updateActivityDto.occurredAt) {
      updateData.occurredAt = new Date(updateActivityDto.occurredAt);
    }

    return prisma.activity.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await prisma.activity.delete({
      where: { id },
    });
  }
}
