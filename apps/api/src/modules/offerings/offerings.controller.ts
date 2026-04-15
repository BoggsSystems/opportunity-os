import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Req
} from '@nestjs/common';
import { OfferingsService } from './offerings.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

@Controller('offerings')
export class OfferingsController {
  constructor(private readonly offeringsService: OfferingsService) {}

  @Post()
  async create(@Body() createOfferingDto: CreateOfferingDto, @Req() req: any) {
    return this.offeringsService.create(createOfferingDto, req.user.id);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.offeringsService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.offeringsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateOfferingDto: UpdateOfferingDto, @Req() req: any) {
    return this.offeringsService.update(id, updateOfferingDto, req.user.id);
  }

  @Get(':id/positioning')
  async findPositionings(@Param('id') id: string, @Req() req: any) {
    return this.offeringsService.findPositionings(id, req.user.id);
  }

  @Get(':id/assets')
  async findAssets(@Param('id') id: string, @Req() req: any) {
    return this.offeringsService.findAssets(id, req.user.id);
  }
}
