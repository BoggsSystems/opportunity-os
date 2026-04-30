import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { GmailEmailProvider } from './email/gmail-email.provider';
import { OutlookEmailProvider } from './email/outlook-email.provider';
import { GoogleDriveProvider } from './storage/google-drive.provider';
import { GoogleCalendarProvider } from './calendar/google-calendar.provider';
import { OutlookCalendarProvider } from './calendar/outlook-calendar.provider';

@Module({
  controllers: [ConnectorsController],
  providers: [
    ConnectorsService,
    GmailEmailProvider,
    OutlookEmailProvider,
    GoogleDriveProvider,
    GoogleCalendarProvider,
    OutlookCalendarProvider,
  ],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
