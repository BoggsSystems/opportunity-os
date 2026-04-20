import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@opportunity-os/db';

@Injectable()
export class GoalsService {
  async findAll(userId: string) {
    return prisma.goal.findMany({
      where: { userId },
      include: {
        campaigns: {
          include: {
            opportunities: {
              select: { id: true, title: true, stage: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string, userId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: {
        campaigns: {
          include: {
            opportunities: true
          }
        }
      }
    });

    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    return goal;
  }
}
