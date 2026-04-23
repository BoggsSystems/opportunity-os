import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { GmailEmailProvider } from './email/gmail-email.provider';
import { OutlookEmailProvider } from './email/outlook-email.provider';

@Module({
  controllers: [ConnectorsController],
  providers: [ConnectorsService, GmailEmailProvider, OutlookEmailProvider],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
