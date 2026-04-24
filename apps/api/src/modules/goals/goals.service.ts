import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus, prisma } from '@opportunity-os/db';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalsService {
  async create(data: CreateGoalDto, userId: string) {
    return prisma.goal.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        offeringId: data.offeringId,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        status: data.status ?? GoalStatus.ACTIVE,
      },
      include: {
        offering: { select: { id: true, title: true, offeringType: true } },
        campaigns: true,
      },
    });
  }

  async findAll(userId: string) {
    return prisma.goal.findMany({
      where: { userId },
      include: {
        offering: {
          select: { id: true, title: true, offeringType: true },
        },
        campaigns: {
          include: {
            opportunities: {
              select: { id: true, title: true, stage: true }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string, userId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: {
        offering: {
          select: { id: true, title: true, offeringType: true },
        },
        campaigns: {
          include: {
            opportunities: true
          }
        },
      }
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    return goal;
  }

  async update(id: string, data: UpdateGoalDto, userId: string) {
    await this.findOne(id, userId);

    return prisma.goal.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        offeringId: data.offeringId,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        status: data.status,
      },
      include: {
        offering: { select: { id: true, title: true, offeringType: true } },
        campaigns: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return prisma.goal.delete({
      where: { id },
    });
  }
}
