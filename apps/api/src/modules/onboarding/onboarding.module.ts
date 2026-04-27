import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { ConnectionsModule } from '../connections/connections.module';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [ConnectionsModule, DiscoveryModule],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
