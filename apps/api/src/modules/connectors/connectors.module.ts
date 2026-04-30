import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsService } from './connectors.service';
import { GmailEmailProvider } from './email/gmail-email.provider';
import { OutlookEmailProvider } from './email/outlook-email.provider';
import { GoogleDriveProvider } from './storage/google-drive.provider';
import { OneDriveProvider } from './storage/onedrive.provider';
import { DropboxProvider } from './storage/dropbox.provider';
import { GoogleCalendarProvider } from './calendar/google-calendar.provider';
import { OutlookCalendarProvider } from './calendar/outlook-calendar.provider';
import { ICloudCalendarProvider } from './calendar/icloud-calendar.provider';
import { GithubProvider } from './social/github.provider';

@Module({
  controllers: [ConnectorsController],
  providers: [
    ConnectorsService,
    GmailEmailProvider,
    OutlookEmailProvider,
    GoogleDriveProvider,
    OneDriveProvider,
    DropboxProvider,
    GoogleCalendarProvider,
    OutlookCalendarProvider,
    ICloudCalendarProvider,
    GithubProvider,
  ],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
