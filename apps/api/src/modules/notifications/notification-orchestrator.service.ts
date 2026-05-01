import { Injectable, Logger } from '@nestjs/common';
import { prisma, NotificationChannel, NotificationStatus } from '@opportunity-os/db';
import { SystemDateService } from '../../common/system-date.service';
import { EmailChannel } from './channels/email.channel';

export interface NotificationPayload {
  userId: string;
  eventKey: string;
  subject?: string;
  body: string;
  metadata?: any;
}

@Injectable()
export class NotificationOrchestrator {
  private readonly logger = new Logger(NotificationOrchestrator.name);

  constructor(
    private readonly systemDateService: SystemDateService,
    private readonly emailChannel: EmailChannel,
  ) {}

  async notify(payload: NotificationPayload) {
    const isSim = this.systemDateService.isSimulation();
    
    this.logger.log(`Processing notification [${payload.eventKey}] for user ${payload.userId} (Sim: ${isSim})`);

    // 1. Create the Notification record (Logical Model)
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        eventKey: payload.eventKey,
        channel: NotificationChannel.email, // Defaulting to email for now
        status: isSim ? NotificationStatus.simulated : NotificationStatus.pending,
        subject: payload.subject,
        body: payload.body,
        metadataJson: payload.metadata,
        createdAt: this.systemDateService.now(),
      }
    });

    // 2. Dispatch if not simulated
    if (isSim) {
      this.logger.log(`Notification ${notification.id} marked as simulated (Time Warp active).`);
      return { success: true, simulated: true, notificationId: notification.id };
    }

    try {
      const result = await this.emailChannel.send(notification);
      
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.sent,
          sentAt: new Date(),
          providerName: result.providerName,
          providerMessageId: result.messageId,
        }
      });

      return { success: true, notificationId: notification.id };
    } catch (error: any) {
      this.logger.error(`Failed to send notification ${notification.id}:`, error);
      
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.failed,
          error: error.message,
        }
      });

      return { success: false, error: error.message };
    }
  }
}
