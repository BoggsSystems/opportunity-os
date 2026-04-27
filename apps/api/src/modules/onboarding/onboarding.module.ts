import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { ConnectionsModule } from '../connections/connections.module';

@Module({
  imports: [ConnectionsModule],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
