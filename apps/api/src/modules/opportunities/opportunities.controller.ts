import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { OpportunitiesService } from './opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  async create(@Body() createOpportunityDto: CreateOpportunityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.opportunitiesService.create(createOpportunityDto, user.id);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.opportunitiesService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.opportunitiesService.findOne(id, user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateOpportunityDto: UpdateOpportunityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.opportunitiesService.update(id, updateOpportunityDto, user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.opportunitiesService.remove(id, user.id);
  }
}
