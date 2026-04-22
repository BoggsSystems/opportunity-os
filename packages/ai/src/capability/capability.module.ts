import { Module } from '@nestjs/common';
import { CapabilityService } from './services/capability.service';
import { GmailProvider } from './providers/gmail.provider';
import { CapabilityController } from './controllers/capability.controller';
import { UserConnectorsController } from './controllers/user-connectors.controller';
import { ConnectorCredentialsController } from './controllers/connector-credentials.controller';
import { CapabilityExecutionController } from './controllers/capability-execution.controller';

@Module({
  controllers: [
    CapabilityController,
    UserConnectorsController,
    ConnectorCredentialsController,
    CapabilityExecutionController,
  ],
  providers: [
    CapabilityService,
    GmailProvider,
  ],
  exports: [
    CapabilityService,
  ],
})
export class CapabilityModule {}
