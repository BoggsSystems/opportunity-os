import { Module, Global } from '@nestjs/common';
import { SimAuthService } from './providers/sim-auth.service';
import { SimCalendarProvider } from './providers/sim-calendar.provider';

import { SimulationController } from './simulation.controller';

@Global()
@Module({
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
