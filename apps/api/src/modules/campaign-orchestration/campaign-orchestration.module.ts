import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CampaignOrchestrationController } from './campaign-orchestration.controller';
import { CampaignOrchestrationService } from './campaign-orchestration.service';

@Module({
  imports: [AiModule],
  controllers: [CampaignOrchestrationController],
  providers: [CampaignOrchestrationService],
  exports: [CampaignOrchestrationService],
})
export class CampaignOrchestrationModule {}
