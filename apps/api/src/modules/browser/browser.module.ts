import { Module } from '@nestjs/common';
import { BrowserSessionController } from './browser-session.controller.minimal';
import { BrowserSessionService } from './browser-session.service';
// import { BrowserStreamGateway } from './browser-stream.gateway'; // Temporarily removed
import { BrowserRuntimeProvider } from './providers/browser-runtime.provider.minimal';
// import { BrowserObservationService } from './services/browser-observation.service'; // Temporarily removed
// import { BrowserActionService } from './services/browser-action.service'; // Temporarily removed
// import { BrowserStreamService } from './services/browser-stream.service'; // Temporarily removed

// Prisma Models (will be replaced with actual imports when Prisma is integrated)

@Module({
  providers: [
    BrowserSessionController,
    BrowserSessionService,
    BrowserRuntimeProvider,
  ],
  exports: [
    BrowserSessionService,
    BrowserRuntimeProvider,
  ],
})
export class BrowserModule {}
