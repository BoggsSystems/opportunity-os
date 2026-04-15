import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Task } from '@opportunity-os/db';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const prisma = new PrismaClient();

@Injectable()
export class TasksService {
  async create(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    const data: any = {
      ...createTaskDto,
      userId,
    };

    if (createTaskDto.dueAt) {
      data.dueAt = new Date(createTaskDto.dueAt);
    }

    return prisma.task.create({
      data,
    });
  }

  async findAll(userId: string): Promise<Task[]> {
    return prisma.task.findMany({
      where: {
        userId,
      },
      orderBy: [
        { status: 'asc' },
        { dueAt: 'asc' },
      ],
    });
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await prisma.task.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<Task> {
    await this.findOne(id, userId);

    const updateData: any = { ...updateTaskDto };
    if (updateTaskDto.dueAt) {
      updateData.dueAt = new Date(updateTaskDto.dueAt);
    }

    return prisma.task.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await prisma.task.delete({
      where: { id },
    });
  }
}
