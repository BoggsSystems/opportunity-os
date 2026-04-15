import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  Req
} from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  async create(@Body() createOpportunityDto: CreateOpportunityDto, @Req() req: any) {
    return this.opportunitiesService.create(createOpportunityDto, req.user.id);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.opportunitiesService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.opportunitiesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateOpportunityDto: UpdateOpportunityDto, @Req() req: any) {
    return this.opportunitiesService.update(id, updateOpportunityDto, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.opportunitiesService.remove(id, req.user.id);
  }
}
