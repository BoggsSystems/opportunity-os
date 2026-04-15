import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Person } from '@opportunity-os/db';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

const prisma = new PrismaClient();

@Injectable()
export class PeopleService {
  async create(createPersonDto: CreatePersonDto, userId: string): Promise<Person> {
    return prisma.person.create({
      data: {
        ...createPersonDto,
        userId,
      },
    });
  }

  async findAll(userId: string): Promise<Person[]> {
    return prisma.person.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Person> {
    const person = await prisma.person.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person;
  }

  async update(id: string, updatePersonDto: UpdatePersonDto, userId: string): Promise<Person> {
    await this.findOne(id, userId);

    return prisma.person.update({
      where: { id },
      data: updatePersonDto,
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await prisma.person.delete({
      where: { id },
    });
  }
}
