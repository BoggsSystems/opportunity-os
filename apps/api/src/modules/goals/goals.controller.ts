import { Controller, Get, Param, Req, Logger } from '@nestjs/common';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  private readonly logger = new Logger(GoalsController.name);

  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.id;
    this.logger.log(`Fetching all goals for user=${userId}`);
    return this.goalsService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    this.logger.log(`Fetching goal=${id} for user=${userId}`);
    return this.goalsService.findOne(id, userId);
  }
}
