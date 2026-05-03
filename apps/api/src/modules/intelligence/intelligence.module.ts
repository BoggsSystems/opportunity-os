import { Module } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { UserPostureService } from './user-posture.service';
import { AiModule } from '../ai/ai.module';
import { ConnectorsModule } from '../connectors/connectors.module';

@Module({
  imports: [AiModule, ConnectorsModule],
  providers: [IntelligenceService, UserPostureService],
  controllers: [IntelligenceController],
  exports: [IntelligenceService, UserPostureService],
})
export class IntelligenceModule {}
