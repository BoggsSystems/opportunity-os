import { Injectable } from '@nestjs/common';
import { Notification } from '@opportunity-os/db';

@Injectable()
export class EmailChannel {
  async send(_notification: Notification) {
    // In a real implementation, this would use Postmark/SendGrid/Resend
    // For now, we'll use a placeholder logic that logs the send.
    
    // Example: const response = await postmarkClient.sendEmail(...)
    
    return {
      success: true,
      providerName: 'mock_provider',
      messageId: `msg_${Math.random().toString(36).substring(7)}`,
    };
  }
}
