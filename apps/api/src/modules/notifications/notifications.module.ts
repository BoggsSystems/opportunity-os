import { Module, Global } from '@nestjs/common';
import { NotificationOrchestrator } from './notification-orchestrator.service';
import { EmailChannel } from './channels/email.channel';

@Global()
@Module({
  providers: [NotificationOrchestrator, EmailChannel],
  exports: [NotificationOrchestrator],
})
export class NotificationsModule {}
