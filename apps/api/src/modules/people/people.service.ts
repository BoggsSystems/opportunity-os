import { Injectable, NotFoundException } from '@nestjs/common';
import { Person, prisma } from '@opportunity-os/db';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { CrmOrchestrator } from '../crm/services/crm-orchestrator.service';

@Injectable()
export class PeopleService {
  constructor(private readonly crmOrchestrator: CrmOrchestrator) {}

  async create(createPersonDto: CreatePersonDto, userId: string): Promise<Person> {
    const person = await prisma.person.create({
      data: {
        ...createPersonDto,
        userId,
      },
    });

    // Async sync to CRM
    this.crmOrchestrator.syncPerson(userId, person).catch((err) => {
      // We don't want to block the response if CRM sync fails
      console.error('CRM Sync Error (Person):', err);
    });

    return person;
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

    const updatedPerson = await prisma.person.update({
      where: { id },
      data: updatePersonDto,
    });

    this.crmOrchestrator.syncPerson(userId, updatedPerson).catch((err) => {
      console.error('CRM Sync Error (Person Update):', err);
    });

    return updatedPerson;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    await prisma.person.delete({
      where: { id },
    });
  }
}
