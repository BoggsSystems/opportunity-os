import { Module } from '@nestjs/common';
import { RetentionOrchestrator } from './services/retention-orchestrator.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [RetentionOrchestrator],
  exports: [RetentionOrchestrator],
})
export class EngagementModule {}
