import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { ConnectionsModule } from '../connections/connections.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [ConnectionsModule, DiscoveryModule, AiModule],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
