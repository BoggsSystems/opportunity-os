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
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  async create(@Body() createActivityDto: CreateActivityDto, @Req() req: any) {
    return this.activitiesService.create(createActivityDto, req.user.id);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.activitiesService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.activitiesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateActivityDto: UpdateActivityDto, @Req() req: any) {
    return this.activitiesService.update(id, updateActivityDto, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.activitiesService.remove(id, req.user.id);
  }
}
