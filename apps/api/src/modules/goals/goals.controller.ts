import { Body, Controller, Delete, Get, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  async create(@Body() createGoalDto: CreateGoalDto, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.goalsService.create(createGoalDto, user.id);
  }

  @Get()
  async findAll(@CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.goalsService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.goalsService.findOne(id, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateGoalDto: UpdateGoalDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.goalsService.update(id, updateGoalDto, user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    if (!user?.id) throw new UnauthorizedException('No authenticated user found');
    return this.goalsService.remove(id, user.id);
  }
}
