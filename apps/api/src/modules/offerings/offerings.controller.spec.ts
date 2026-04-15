import { Test, TestingModule } from '@nestjs/testing';
import { OfferingsController } from './offerings.controller';
import { OfferingsService } from './offerings.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

describe('OfferingsController', () => {
  let controller: OfferingsController;
  let service: OfferingsService;

  const mockUser = { id: 'test-user-id' };
  const mockOffering = {
    id: 'test-offering-id',
    title: 'Test Offering',
    description: 'Test Description',
    offeringType: 'service',
    status: 'draft',
    userId: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OfferingsController],
      providers: [
        {
          provide: OfferingsService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockOffering),
            findAll: jest.fn().mockResolvedValue([mockOffering]),
            findOne: jest.fn().mockResolvedValue(mockOffering),
            update: jest.fn().mockResolvedValue(mockOffering),
            findPositionings: jest.fn().mockResolvedValue([]),
            findAssets: jest.fn().mockResolvedValue([]),
          } as any,
        },
      ],
    }).compile();

    controller = module.get<OfferingsController>(OfferingsController);
    service = module.get<OfferingsService>(OfferingsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /offerings', () => {
    it('should create an offering', async () => {
      const createDto: CreateOfferingDto = {
        title: 'Test Offering',
        description: 'Test Description',
        offeringType: 'service',
      };

      const result = await controller.create(createDto, mockUser as any);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.id);
      expect(result).toEqual(mockOffering);
    });
  });

  describe('GET /offerings', () => {
    it('should return all offerings for user', async () => {
      const result = await controller.findAll(mockUser as any);
      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockOffering]);
    });
  });

  describe('GET /offerings/:id', () => {
    it('should return offering by ID', async () => {
      const result = await controller.findOne('test-offering-id', mockUser as any);
      expect(service.findOne).toHaveBeenCalledWith('test-offering-id', mockUser.id);
      expect(result).toEqual(mockOffering);
    });
  });

  describe('PATCH /offerings/:id', () => {
    it('should update an offering', async () => {
      const updateDto: UpdateOfferingDto = {
        title: 'Updated Offering',
        status: 'active',
      };

      const result = await controller.update('test-offering-id', updateDto, mockUser as any);
      expect(service.update).toHaveBeenCalledWith('test-offering-id', updateDto, mockUser.id);
      expect(result).toEqual(mockOffering);
    });
  });

  describe('GET /offerings/:id/positioning', () => {
    it('should return positioning for offering', async () => {
      const result = await controller.findPositionings('test-offering-id', mockUser as any);
      expect(service.findPositionings).toHaveBeenCalledWith('test-offering-id', mockUser.id);
      expect(result).toEqual([]);
    });
  });

  describe('GET /offerings/:id/assets', () => {
    it('should return assets for offering', async () => {
      const result = await controller.findAssets('test-offering-id', mockUser as any);
      expect(service.findAssets).toHaveBeenCalledWith('test-offering-id', mockUser.id);
      expect(result).toEqual([]);
    });
  });
});
