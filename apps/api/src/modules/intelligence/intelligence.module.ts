import { Module } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [IntelligenceService],
  controllers: [IntelligenceController],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}
