import { Module } from '@nestjs/common';
import { MappingEngine } from './services/mapping-engine.service';
import { CrmOrchestrator } from './services/crm-orchestrator.service';

@Module({
  providers: [MappingEngine, CrmOrchestrator],
  exports: [MappingEngine, CrmOrchestrator],
})
export class CrmModule {}
