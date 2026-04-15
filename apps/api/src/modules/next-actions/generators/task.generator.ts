import { Injectable } from '@nestjs/common';
import { PrismaClient, TaskStatus, TaskPriority } from '@opportunity-os/db';
import { CandidateAction, ActionGenerator } from '../interfaces/next-action.interface';

const prisma = new PrismaClient();

@Injectable()
export class TaskGenerator implements ActionGenerator {
  async generateCandidateActions(userId: string): Promise<CandidateAction[]> {
    const actions: CandidateAction[] = [];

    // Get overdue tasks
    const overdueTasks = await prisma.task.findMany({
      where: {
        userId,
        status: TaskStatus.open,
        dueAt: { lt: new Date() },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    });

    overdueTasks.forEach(task => {
      actions.push({
        type: 'task',
        priorityScore: 100,
        title: `Overdue: ${task.title}`,
        reason: `Task was due ${this.getDaysOverdue(task.dueAt!)} days ago`,
        recommendedAction: 'Complete this task immediately',
        taskId: task.id,
        opportunityId: task.opportunityId || undefined,
      });
    });

    // Get tasks due soon (within 3 days)
    const dueSoonTasks = await prisma.task.findMany({
      where: {
        userId,
        status: TaskStatus.open,
        dueAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    });

    dueSoonTasks.forEach(task => {
      actions.push({
        type: 'task',
        priorityScore: 80,
        title: `Due Soon: ${task.title}`,
        reason: `Task is due in ${this.getDaysUntilDue(task.dueAt!)} days`,
        recommendedAction: 'Plan to complete this task soon',
        taskId: task.id,
        opportunityId: task.opportunityId || undefined,
      });
    });

    // Get high priority open tasks
    const highPriorityTasks = await prisma.task.findMany({
      where: {
        userId,
        status: TaskStatus.open,
        priority: TaskPriority.high,
        dueAt: { gt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    highPriorityTasks.forEach(task => {
      actions.push({
        type: 'task',
        priorityScore: 60,
        title: `High Priority: ${task.title}`,
        reason: 'High priority task that needs attention',
        recommendedAction: 'Schedule time to work on this high priority task',
        taskId: task.id,
        opportunityId: task.opportunityId || undefined,
        personId: task.personId || undefined,
      });
    });

    return actions;
  }

  private getDaysOverdue(dueDate: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dueDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
