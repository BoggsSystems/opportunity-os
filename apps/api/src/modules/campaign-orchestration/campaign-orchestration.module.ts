import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { CommercialModule } from "../commercial/commercial.module";
import { CampaignOrchestrationController } from "./campaign-orchestration.controller";
import { CampaignOrchestrationService } from "./campaign-orchestration.service";

@Module({
  imports: [AiModule, CommercialModule],
  controllers: [CampaignOrchestrationController],
  providers: [CampaignOrchestrationService],
  exports: [CampaignOrchestrationService],
})
export class CampaignOrchestrationModule {}
