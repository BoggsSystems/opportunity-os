import { Module } from '@nestjs/common';
import { NextActionsController } from './next-actions.controller';
import { NextActionsService } from './next-actions.service';
import { TaskGenerator } from './generators/task.generator';
import { OpportunityGenerator } from './generators/opportunity.generator';
import { DiscoveryGenerator } from './generators/discovery.generator';
import { OfferingContextService } from './offerings/offering-context.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [NextActionsController],
  providers: [
    NextActionsService,
    TaskGenerator,
    OpportunityGenerator,
    DiscoveryGenerator,
    OfferingContextService,
  ],
})
export class NextActionsModule {}
