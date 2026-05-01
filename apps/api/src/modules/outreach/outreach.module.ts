import { Module } from '@nestjs/common';
import { CommercialModule } from '../commercial/commercial.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';
import { ContextOrchestratorService } from './services/context-orchestrator.service';

import { AiModule } from '../ai/ai.module';

@Module({
  imports: [CommercialModule, ConnectorsModule, AiModule],
  controllers: [OutreachController],
  providers: [OutreachService, ContextOrchestratorService],
  exports: [OutreachService, ContextOrchestratorService],
})
export class OutreachModule {}
