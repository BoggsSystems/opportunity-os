import { Injectable, Logger } from '@nestjs/common';
import { prisma, UserLifecycleStage } from '@opportunity-os/db';
import { AiService } from '../../ai/ai.service';
import { SystemDateService } from '../../../common/system-date.service';
import { NotificationOrchestrator } from '../../notifications/notification-orchestrator.service';
import { AdminLifecycleService } from '../../admin/admin-lifecycle.service';

@Injectable()
export class RetentionOrchestrator {
  private readonly logger = new Logger(RetentionOrchestrator.name);

  constructor(
    private readonly aiService: AiService,
    private readonly notificationOrchestrator: NotificationOrchestrator,
    private readonly systemDateService: SystemDateService,
    private readonly adminLifecycleService: AdminLifecycleService,
  ) {}

  /**
   * Main entry point for engagement scans.
   */
  async processAllRetentionQueues() {
    await this.processOnboardingRetention();
    await this.processChurnDeflection();
  }

  /**
   * Scans for users who have stalled in their onboarding.
   */
  async processOnboardingRetention() {
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
            sentAt: { gte: new Date(this.systemDateService.now().getTime() - 3 * 24 * 60 * 60 * 1000) }, // Frequency cap: 3 days
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

    // 🏆 New: Flag the user as 'stalled' in the lifecycle
    await this.adminLifecycleService.recordEvent({
      userId: user.id,
      stage: UserLifecycleStage.stalled,
      eventType: 'ghost_campaign_stalled',
      sourceType: 'retention_nudge',
      sourceId: campaign.id,
      metadata: { campaignId: campaign.id }
    });
  }

  /**
   * 🛡️ CHURN DEFLECTOR: Detects trials nearing expiration and offers incentives.
   */
  async processChurnDeflection() {
    this.logger.log('Scanning for churn deflection opportunities...');
    const now = this.systemDateService.now();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    const expiringTrials = await prisma.subscription.findMany({
      where: {
        status: 'trialing',
        currentPeriodEnd: {
          gte: threeDaysFromNow,
          lte: fourDaysFromNow,
        },
        user: {
          engagementLogs: {
            none: {
              nudgeType: 'churn_deflector_save_offer',
            }
          }
        }
      },
      include: {
        user: true,
        plan: true,
      },
    });

    this.logger.log(`Found ${expiringTrials.length} trials expiring in ~3 days.`);

    for (const sub of expiringTrials) {
      try {
        await this.nudgeExpiringTrial(sub);
      } catch (error) {
        this.logger.error(`Failed to nudge expiring trial for user ${sub.userId}:`, error);
      }
    }
  }

  private async nudgeExpiringTrial(sub: any) {
    const user = sub.user;
    const plan = sub.plan;

    const prompt = `
      A user named ${user.fullName || 'there'} is on a 14-day trial of our '${plan.name}' plan, which expires in 3 days.
      They haven't upgraded to a paid plan yet.
      Write a 2-sentence "Save" offer to prevent them from churning.
      The offer should include a simulated 50% discount for their first month if they upgrade in the next 48 hours.
      Tone: Urgent, generous, and value-driven.
    `.trim();

    const offerContent = await this.aiService.generateText(prompt, {
      temperature: 0.7,
      maxTokens: 150,
    }, user.id);

    this.logger.log(`Generated Churn Deflector offer for ${user.email}: "${offerContent}"`);

    await this.notificationOrchestrator.notify({
      userId: user.id,
      eventKey: 'billing.trial_expiring_offer',
      subject: `Exclusive offer: Stay with ${plan.name} for 50% off`,
      body: offerContent,
      metadata: { 
        planId: plan.id, 
        expirationDate: sub.currentPeriodEnd 
      }
    });

    await prisma.userEngagementLog.create({
      data: {
        userId: user.id,
        nudgeType: 'churn_deflector_save_offer',
        strategyVersion: 'v1-discount-offer',
        metadataJson: { 
          planId: plan.id,
          generatedContent: offerContent
        },
      },
    });
  }
}
