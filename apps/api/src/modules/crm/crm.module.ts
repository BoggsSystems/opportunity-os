import { Module } from '@nestjs/common';
import { MappingEngine } from './services/mapping-engine.service';
import { CrmOrchestrator } from './services/crm-orchestrator.service';
import { HubspotProvider } from './providers/hubspot.provider';
import { SalesforceProvider } from './providers/salesforce.provider';

@Module({
  providers: [
    MappingEngine,
    CrmOrchestrator,
    HubspotProvider,
    SalesforceProvider,
  ],
  exports: [MappingEngine, CrmOrchestrator],
})
export class CrmModule {}
