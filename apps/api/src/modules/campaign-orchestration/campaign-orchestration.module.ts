import { Module } from '@nestjs/common';
import { CampaignOrchestrationController } from './campaign-orchestration.controller';
import { CampaignOrchestrationService } from './campaign-orchestration.service';

@Module({
  controllers: [CampaignOrchestrationController],
  providers: [CampaignOrchestrationService],
  exports: [CampaignOrchestrationService],
})
export class CampaignOrchestrationModule {}
