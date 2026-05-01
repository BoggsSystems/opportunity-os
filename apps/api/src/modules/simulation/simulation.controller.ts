import { Controller, Post, Body } from '@nestjs/common';
import { prisma, CampaignStatus, ActionLaneStatus, ActionItemStatus } from '@opportunity-os/db';
import { SystemDateService } from '../../common/system-date.service';
import { RetentionOrchestrator } from '../engagement/services/retention-orchestrator.service';

@Controller('simulation')
export class SimulationController {
  constructor(
    private readonly systemDateService: SystemDateService,
    private readonly retentionOrchestrator: RetentionOrchestrator,
  ) {}

  @Post('trigger-retention-scan')
  async triggerRetentionScan() {
    await this.retentionOrchestrator.processRetentionQueue();
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

    return { success: true, campaignId: campaign.id, actionItemCount: actionItems.length };
  }
}
