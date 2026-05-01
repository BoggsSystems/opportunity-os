import { Module } from '@nestjs/common';
import { RetentionOrchestrator } from './services/retention-orchestrator.service';
import { AiModule } from '../ai/ai.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AiModule, AdminModule],
  providers: [RetentionOrchestrator],
  exports: [RetentionOrchestrator],
})
export class EngagementModule {}
