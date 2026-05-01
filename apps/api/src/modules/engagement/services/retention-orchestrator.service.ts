import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@opportunity-os/db';
import { AiService } from '../../ai/ai.service';
import { NotificationOrchestrator } from '../../notifications/notification-orchestrator.service';

@Injectable()
export class RetentionOrchestrator {
  private readonly logger = new Logger(RetentionOrchestrator.name);

  constructor(
    private readonly aiService: AiService,
    private readonly notificationOrchestrator: NotificationOrchestrator,
  ) {}

  /**
   * Scans the database for users who have stalled in their onboarding
   * and generates personalized nudges for them.
   */
  async processRetentionQueue() {
    this.logger.log('Scanning for retention opportunities...');

    // 1. Trigger: Campaign created but no CRM/Email connected (Stalled)
    const stalledUsers = await prisma.user.findMany({
      where: {
        lifecycleSnapshot: {
          firstCampaignGeneratedAt: { not: null },
          connectorReadyAt: null,
          // We can add more specific 'stalled' logic here
        },
        engagementLogs: {
          none: {
            nudgeType: 'ghost_campaign',
            sentAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }, // Frequency cap: 3 days
          },
        },
      },
      include: {
        campaigns: { take: 1, orderBy: { createdAt: 'desc' } },
        lifecycleSnapshot: true,
      },
    });

    this.logger.log(`Found ${stalledUsers.length} stalled users for 'ghost_campaign' nudge.`);

    for (const user of stalledUsers) {
      try {
        await this.nudgeStalledUser(user);
      } catch (error) {
        this.logger.error(`Failed to nudge user ${user.id}:`, error);
      }
    }
  }

  /**
   * Generates and "sends" a nudge for a stalled user.
   */
  private async nudgeStalledUser(user: any) {
    const campaign = user.campaigns[0];
    if (!campaign) return;

    const prompt = `
      A user named ${user.fullName || 'there'} started a campaign for '${campaign.title}' in Opportunity OS but hasn't connected their CRM or email yet. 
      Write a 2-sentence re-engagement nudge for them. 
      The nudge should be encouraging and mention that the platform is ready to start finding leads for '${campaign.title}' as soon as they connect their tools.
      Tone: Professional, high-energy, and helpful.
    `.trim();

    const nudgeContent = await this.aiService.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 150,
    }, user.id);

    this.logger.log(`Generated nudge for ${user.email}: "${nudgeContent}"`);

    // 🏆 New: Trigger Nudge Notification
    await this.notificationOrchestrator.notify({
      userId: user.id,
      eventKey: 'engagement.stalled_nudge',
      subject: `Quick update on your '${campaign.title}' campaign`,
      body: nudgeContent,
      metadata: { campaignId: campaign.id }
    });

    // Log the engagement so we don't double-send
    await prisma.userEngagementLog.create({
      data: {
        userId: user.id,
        nudgeType: 'ghost_campaign',
        strategyVersion: 'v1-ai-personalized',
        metadataJson: { 
          campaignId: campaign.id,
          generatedContent: nudgeContent
        },
      },
    });
  }
}
