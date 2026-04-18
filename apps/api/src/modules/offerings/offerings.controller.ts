import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { OfferingsService } from './offerings.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

@Controller('offerings')
export class OfferingsController {
  constructor(private readonly offeringsService: OfferingsService) {}

  @Post()
  async create(@Body() createOfferingDto: CreateOfferingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.create(createOfferingDto, user.id);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findOne(id, user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateOfferingDto: UpdateOfferingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.update(id, updateOfferingDto, user.id);
  }

  @Get(':id/positioning')
  async findPositionings(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findPositionings(id, user.id);
  }

  @Get(':id/assets')
  async findAssets(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offeringsService.findAssets(id, user.id);
  }
}
