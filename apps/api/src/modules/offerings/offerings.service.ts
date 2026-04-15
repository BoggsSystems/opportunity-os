import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Offering, OfferingPositioning, OfferingAsset } from '@opportunity-os/db';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

const prisma = new PrismaClient();

@Injectable()
export class OfferingsService {
  async create(createOfferingDto: CreateOfferingDto, userId: string): Promise<Offering> {
    return prisma.offering.create({
      data: {
        ...createOfferingDto,
        userId,
      },
    });
  }

  async findAll(userId: string): Promise<Offering[]> {
    return prisma.offering.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<Offering> {
    const offering = await prisma.offering.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!offering) {
      throw new NotFoundException('Offering not found');
    }

    return offering;
  }

  async update(id: string, updateOfferingDto: UpdateOfferingDto, userId: string): Promise<Offering> {
    // First check if offering exists and belongs to user
    await this.findOne(id, userId);

    return prisma.offering.update({
      where: { id },
      data: updateOfferingDto,
    });
  }

  async findPositionings(offeringId: string, userId: string): Promise<OfferingPositioning[]> {
    // Verify offering belongs to user
    await this.findOne(offeringId, userId);

    return prisma.offeringPositioning.findMany({
      where: {
        offeringId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findAssets(offeringId: string, userId: string): Promise<OfferingAsset[]> {
    // Verify offering belongs to user
    await this.findOne(offeringId, userId);

    return prisma.offeringAsset.findMany({
      where: {
        offeringId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
