import { Module, Global } from '@nestjs/common';
import { SimAuthService } from './providers/sim-auth.service';
import { SimCalendarProvider } from './providers/sim-calendar.provider';
import { EngagementModule } from '../engagement/engagement.module';
import { CommercialModule } from '../commercial/commercial.module';

import { SimulationController } from './simulation.controller';

@Global()
@Module({
  imports: [EngagementModule, CommercialModule],
  controllers: [SimulationController],
  providers: [
    SimAuthService,
    SimCalendarProvider,
  ],
  exports: [
    SimAuthService,
    SimCalendarProvider,
  ],
})
export class SimProvidersModule {}
