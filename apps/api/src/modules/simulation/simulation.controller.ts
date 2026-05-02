import { Controller, Post, Body, Request } from '@nestjs/common';
import { prisma, CampaignStatus, ActionLaneStatus, ActionItemStatus } from '@opportunity-os/db';
import { SystemDateService } from '../../common/system-date.service';
import { RetentionOrchestrator } from '../engagement/services/retention-orchestrator.service';
import { CommercialService } from '../commercial/commercial.service';

@Controller('simulation')
export class SimulationController {
  constructor(
    private readonly systemDateService: SystemDateService,
    private readonly retentionOrchestrator: RetentionOrchestrator,
    private readonly commercialService: CommercialService,
  ) {}

  @Post('trigger-retention-scan')
  async triggerRetentionScan() {
    await this.retentionOrchestrator.processAllRetentionQueues();
    return { success: true };
  }

  @Post('record-referral-milestone')
  async recordReferralMilestone(@Body() body: { userId: string, milestoneType: string }) {
    await this.commercialService.recordReferralMilestone(
      body.userId,
      body.milestoneType as any,
    );
    return { success: true };
  }

  @Post('increment-usage-batch')
  async incrementUsageBatch(
    @Body() body: { userId?: string, featureKey: string, quantity: number },
    @Request() req: any
  ) {
    const userId = body.userId || req.user?.id;
    if (!userId) throw new Error('No userId provided for usage increment');
    
    await this.commercialService.incrementUsage(userId, body.featureKey, body.quantity);
    return { success: true };
  }

  @Post('force-upgrade')
  async forceUpgrade(@Body() body: { userId: string, planCode: string }) {
    const plan = await prisma.plan.findUnique({ where: { code: body.planCode } });
    if (!plan) throw new Error('Plan not found');

    await prisma.subscription.updateMany({
      where: { userId: body.userId, status: 'active' },
      data: { status: 'canceled' },
    });

    await prisma.subscription.create({
      data: {
        userId: body.userId,
        planId: plan.id,
        status: 'active',
        startedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        provider: 'simulation_forced',
        billingInterval: 'monthly'
      }
    });

    return { success: true };
  }

  @Post('seed-user-data')
  async seedUserData(@Body() body: { userId: string }) {
    const { userId } = body;
    const now = this.systemDateService.now();

    // 1. Create a Campaign
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        title: 'Simulation Growth Campaign',
        objective: 'Drive revenue via direct outreach',
        strategicAngle: 'High-value executive targeting',
        status: CampaignStatus.ACTIVE,
        createdAt: now,
      }
    });

    // 2. Create an Action Lane
    const lane = await prisma.actionLane.create({
      data: {
        campaignId: campaign.id,
        laneType: 'linkedin_dm',
        title: 'CEO Outreach Lane',
        status: ActionLaneStatus.ACTIVE,
        priorityScore: 90,
        createdAt: now,
      }
    });

    // 3. Create 10 Action Items
    const actionItems = [];
    for (let i = 0; i < 10; i++) {
      actionItems.push(await prisma.actionItem.create({
        data: {
          userId,
          campaignId: campaign.id,
          actionLaneId: lane.id,
          actionType: 'outreach',
          title: `Action Item #${i + 1}`,
          status: ActionItemStatus.ready,
          priorityScore: 80 - i,
          dueAt: now,
          createdAt: now,
        }
      }));
    }

    // 4. Create Referral Link
    await this.commercialService.getOrCreateReferralLink(userId);

    return { success: true, campaignId: campaign.id, actionItemCount: actionItems.length };
  }
}
