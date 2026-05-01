import { Injectable } from "@nestjs/common";
import {
  Prisma,
  prisma,
  UserLifecycleStage,
} from "@opportunity-os/db";

const STAGE_RANK: Record<UserLifecycleStage, number> = {
  visitor: 0,
  account_created: 1,
  onboarding_started: 2,
  profile_grounded: 3,
  offering_selected: 4,
  campaign_generated: 5,
  action_lanes_selected: 6,
  connector_ready: 7,
  first_action_primed: 8,
  first_action_completed: 9,
  activated: 10,
  retained: 11,
  paid: 12,
  stalled: 13,
  dormant: 14,
};

const STAGE_TIMESTAMP_FIELD: Partial<Record<UserLifecycleStage, string>> = {
  onboarding_started: "onboardingStartedAt",
  profile_grounded: "onboardingCompletedAt",
  offering_selected: "onboardingCompletedAt",
  campaign_generated: "firstCampaignGeneratedAt",
  action_lanes_selected: "actionLanesSelectedAt",
  connector_ready: "connectorReadyAt",
  first_action_primed: "firstActionPrimedAt",
  first_action_completed: "firstActionCompletedAt",
  activated: "activatedAt",
  retained: "retainedAt",
  paid: "paidAt",
  stalled: "stalledAt",
  dormant: "dormantAt",
};

@Injectable()
export class AdminLifecycleService {
  async recordEvent(input: {
    userId: string;
    stage: UserLifecycleStage;
    eventType: string;
    sourceType?: string;
    sourceId?: string;
    occurredAt?: Date;
    metadata?: Record<string, unknown>;
  }) {
    const occurredAt = input.occurredAt || new Date();

    const event = await prisma.userLifecycleEvent.create({
      data: {
        userId: input.userId,
        stage: input.stage,
        eventType: input.eventType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        occurredAt,
        metadataJson: this.json(input.metadata),
      },
    });

    await this.updateSnapshot(input.userId, input.stage, occurredAt, input.metadata);

    return event;
  }

  private async updateSnapshot(
    userId: string,
    stage: UserLifecycleStage,
    occurredAt: Date,
    metadata?: Record<string, unknown>,
  ) {
    const existing = await prisma.userLifecycleSnapshot.findUnique({
      where: { userId },
    });
    const furthestStage = this.furthestStage(existing?.furthestStage, stage);
    const timestampField = STAGE_TIMESTAMP_FIELD[stage];
    const timestampPatch = timestampField ? { [timestampField]: occurredAt } : {};

    if (!existing) {
      return prisma.userLifecycleSnapshot.create({
        data: {
          userId,
          currentStage: stage,
          furthestStage,
          lastActivityAt: occurredAt,
          metadataJson: this.json(metadata),
          ...timestampPatch,
        },
      });
    }

    return prisma.userLifecycleSnapshot.update({
      where: { userId },
      data: {
        currentStage: stage,
        furthestStage,
        lastActivityAt: occurredAt,
        metadataJson: metadata
          ? this.json({
              ...(this.objectMetadata(existing.metadataJson)),
              ...metadata,
            })
          : existing.metadataJson === null
            ? undefined
            : existing.metadataJson,
        ...timestampPatch,
      },
    });
  }

  private furthestStage(
    existing: UserLifecycleStage | undefined,
    candidate: UserLifecycleStage,
  ): UserLifecycleStage {
    if (!existing) return candidate;
    return STAGE_RANK[candidate] > STAGE_RANK[existing] ? candidate : existing;
  }

  private json(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | undefined {
    return value ? JSON.parse(JSON.stringify(value)) : undefined;
  }

  private objectMetadata(value: unknown): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== "object") return {};
    return value as Record<string, unknown>;
  }
}
