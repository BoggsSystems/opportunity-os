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
import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Post()
  async create(@Body() createPersonDto: CreatePersonDto, @Req() req: any) {
    return this.peopleService.create(createPersonDto, req.user.id);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.peopleService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.peopleService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updatePersonDto: UpdatePersonDto, @Req() req: any) {
    return this.peopleService.update(id, updatePersonDto, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.peopleService.remove(id, req.user.id);
  }
}
