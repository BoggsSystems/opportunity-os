import { Module } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { UserPostureService } from './user-posture.service';
import { AiModule } from '../ai/ai.module';
import { ConnectorsModule } from '../connectors/connectors.module';

import { IntelligenceListener } from './intelligence.listener';

@Module({
  imports: [AiModule, ConnectorsModule],
  providers: [IntelligenceService, UserPostureService, IntelligenceListener],
  controllers: [IntelligenceController],
  exports: [IntelligenceService, UserPostureService],
})
export class IntelligenceModule {}
