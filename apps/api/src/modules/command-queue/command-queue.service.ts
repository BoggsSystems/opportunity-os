import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { RewardsService } from "../rewards/rewards.service";
import {
  ActionItemStatus,
  CommandQueueItemStatus,
  DailyCommandQueueStatus,
  Prisma,
  prisma,
} from "@opportunity-os/db";
import { UpdateCommandQueueItemDto } from "./dto/command-queue.dto";

type QueueInput = {
  date?: string;
  refresh?: boolean;
  limit?: number;
};

const OPEN_ACTION_STATUSES = [
  ActionItemStatus.suggested,
  ActionItemStatus.ready,
  ActionItemStatus.in_progress,
  ActionItemStatus.responded,
];

const CANDIDATE_ACTION_INCLUDE = {
  campaign: {
    select: {
      id: true,
      title: true,
      status: true,
      offeringId: true,
      offering: {
        select: { id: true, title: true, offeringType: true },
      },
    },
  },
  actionLane: {
    select: { id: true, title: true, laneType: true, status: true },
  },
  actionCycle: {
    select: { id: true, title: true, cycleNumber: true, status: true },
  },
  targetPerson: true,
  targetCompany: true,
  conversationThreads: {
    orderBy: { updatedAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      channel: true,
      status: true,
      latestSummary: true,
      latestIntent: true,
      nextActionSummary: true,
      lastMessageAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ActionItemInclude;

type CandidateAction = Prisma.ActionItemGetPayload<{
  include: typeof CANDIDATE_ACTION_INCLUDE;
}>;

type ScoredCandidate = {
  action: CandidateAction;
  score: number;
};

const QUEUE_INCLUDE = {
  items: {
    orderBy: { position: "asc" as const },
    include: {
      offering: { select: { id: true, title: true, offeringType: true } },
      campaign: { select: { id: true, title: true, status: true } },
      actionLane: {
        select: { id: true, title: true, laneType: true, status: true },
      },
      actionCycle: {
        select: { id: true, title: true, cycleNumber: true, status: true },
      },
      actionItem: {
        include: CANDIDATE_ACTION_INCLUDE,
      },
    },
  },
} satisfies Prisma.DailyCommandQueueInclude;

@Injectable()
export class CommandQueueService {
  private readonly logger = new Logger(CommandQueueService.name);
  constructor(private readonly rewardsService: RewardsService) {}

  async getToday(userId: string, input: QueueInput = {}) {
    const queueDate = this.resolveQueueDate(input.date);
    const limit = this.resolveLimit(input.limit);

    if (input.refresh) {
      return this.rebuildQueue(userId, queueDate, limit);
    }

    const existing = await this.findQueue(userId, queueDate);
    if (existing) {
      return this.serializeQueue(existing);
    }

    return this.rebuildQueue(userId, queueDate, limit);
  }

  async updateItem(
    userId: string,
    itemId: string,
    data: UpdateCommandQueueItemDto,
  ) {
    const existing = await prisma.commandQueueItem.findFirst({
      where: { id: itemId, userId },
    });

    if (!existing) {
      throw new NotFoundException("Command queue item not found");
    }

    const status = this.resolveItemStatus(data.status);
    const now = new Date();
    const updateData: Prisma.CommandQueueItemUpdateInput = {};

    if (status) {
      updateData.status = status;
      this.applyStatusTimestamps(updateData, status, now, data.deferredUntil);
    }

    if (data.reason !== undefined) {
      updateData.reason = data.reason;
    }

    if (data.metadataJson !== undefined) {
      updateData.metadataJson = this.toJson(data.metadataJson);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const queueItem = await tx.commandQueueItem.update({
        where: { id: existing.id },
        data: updateData,
      });

      if (
        data.completeActionItem &&
        status === CommandQueueItemStatus.completed &&
        existing.actionItemId
      ) {
        await tx.actionItem.update({
          where: { id: existing.actionItemId },
          data: {
            status: await this.confirmedStatusForActionItem(
              tx,
              existing.actionItemId,
            ),
            completedAt: now,
          },
        });
      }

      const completedActionCount = await tx.commandQueueItem.count({
        where: {
          commandQueueId: existing.commandQueueId,
          status: CommandQueueItemStatus.completed,
        },
      });

      await tx.dailyCommandQueue.update({
        where: { id: existing.commandQueueId },
        data: {
          completedActionCount,
          status:
            completedActionCount > 0
              ? DailyCommandQueueStatus.active
              : DailyCommandQueueStatus.planned,
          startedAt: completedActionCount > 0 ? now : undefined,
        },
      });

      return queueItem;
    });

    const queue = await prisma.dailyCommandQueue.findUnique({
      where: { id: updated.commandQueueId },
      include: QUEUE_INCLUDE,
    });

    if (!queue) {
      throw new NotFoundException("Command queue not found");
    }

    const result = this.serializeQueue(queue);

    // 4. Trigger Rewards (Async)
    if (status === CommandQueueItemStatus.completed) {
      this.rewardsService.evaluateActionCompletion(userId, itemId).catch((err) => {
        this.logger.error(`Rewards Evaluation Error for user ${userId}: ${err.message}`);
      });
    }

    return result;
  }

  private async rebuildQueue(userId: string, queueDate: Date, limit: number) {
    const candidates = await this.findCandidateActions(userId, queueDate, limit);

    const queue = await prisma.$transaction(async (tx) => {
      await tx.dailyCommandQueue.deleteMany({
        where: { userId, queueDate },
      });

      const created = await tx.dailyCommandQueue.create({
        data: {
          userId,
          queueDate,
          status: DailyCommandQueueStatus.planned,
          title: "Today's Command Queue",
          summary:
            "A prioritized queue of action items for the Conductor to walk through today.",
          targetActionCount: candidates.length,
          completedActionCount: 0,
          generatedAt: new Date(),
          metadataJson: this.toJson({
            source: "open_action_items",
            openStatuses: OPEN_ACTION_STATUSES,
          }),
        },
      });

      if (candidates.length > 0) {
        await tx.commandQueueItem.createMany({
          data: candidates.map((candidate, index) =>
            this.toCommandQueueCreateInput(created.id, userId, candidate, index),
          ),
        });
      }

      return tx.dailyCommandQueue.findUniqueOrThrow({
        where: { id: created.id },
        include: QUEUE_INCLUDE,
      });
    });

    return this.serializeQueue(queue);
  }

  private async findCandidateActions(
    userId: string,
    queueDate: Date,
    limit: number,
  ) {
    const searchLimit = Math.min(limit * 5, 750);
    const actions = await prisma.actionItem.findMany({
      where: {
        userId,
        status: { in: OPEN_ACTION_STATUSES },
      },
      include: CANDIDATE_ACTION_INCLUDE,
      take: searchLimit,
      orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
    });

    return actions
      .map((action) => ({
        action,
        score: this.scoreAction(action, queueDate),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.action.createdAt.getTime() - b.action.createdAt.getTime();
      })
      .slice(0, limit);
  }

  private toCommandQueueCreateInput(
    commandQueueId: string,
    userId: string,
    candidate: ScoredCandidate,
    index: number,
  ): Prisma.CommandQueueItemCreateManyInput {
    const action = candidate.action;

    return {
      commandQueueId,
      userId,
      offeringId: action.campaign.offeringId,
      campaignId: action.campaignId,
      actionLaneId: action.actionLaneId,
      actionCycleId: action.actionCycleId,
      actionItemId: action.id,
      position: index + 1,
      priorityScore: candidate.score,
      status: CommandQueueItemStatus.queued,
      title: action.title,
      reason: this.reasonForAction(action, candidate.score),
      estimatedMinutes: this.estimatedMinutes(action.actionType),
      scheduledFor: action.dueAt,
      metadataJson: this.toJson({
        actionType: action.actionType,
        actionStatus: action.status,
        channel: action.actionLane.laneType,
        dueAt: action.dueAt,
        targetType: action.targetType,
        hasConversationThread: action.conversationThreads.length > 0,
      }),
    };
  }

  private scoreAction(
    action: {
      priorityScore: number;
      status: ActionItemStatus;
      dueAt: Date | null;
      actionType: string;
      conversationThreads: Array<{ lastMessageAt: Date | null }>;
    },
    queueDate: Date,
  ) {
    let score = action.priorityScore;
    const dayStart = queueDate.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    if (action.status === ActionItemStatus.responded) score += 35;
    if (action.status === ActionItemStatus.in_progress) score += 18;
    if (action.status === ActionItemStatus.ready) score += 12;

    if (action.dueAt) {
      const due = action.dueAt.getTime();
      if (due < dayStart) score += 30;
      if (due >= dayStart && due < dayEnd) score += 22;
      if (due >= dayEnd && due < dayEnd + 3 * 24 * 60 * 60 * 1000) {
        score += 10;
      }
    }

    if (action.conversationThreads.some((thread) => thread.lastMessageAt)) {
      score += 12;
    }

    if (action.actionType.includes("reply")) score += 8;
    if (action.actionType.includes("call")) score += 6;

    return score;
  }

  private reasonForAction(
    action: {
      status: ActionItemStatus;
      actionType: string;
      campaign: { title: string };
      actionLane: { title: string };
      dueAt: Date | null;
      conversationThreads: Array<{ lastMessageAt: Date | null }>;
    },
    score: number,
  ) {
    const parts = [
      `${action.campaign.title} / ${action.actionLane.title}`,
      `${action.actionType.replace(/_/g, " ")} is ${action.status.replace(/_/g, " ")}`,
    ];

    if (action.dueAt) {
      parts.push(`due ${action.dueAt.toISOString().slice(0, 10)}`);
    }

    if (action.conversationThreads.some((thread) => thread.lastMessageAt)) {
      parts.push("conversation has an inbound response");
    }

    parts.push(`queue score ${score}`);

    return parts.join("; ");
  }

  private estimatedMinutes(actionType: string) {
    if (actionType.includes("post") || actionType.includes("video")) return 20;
    if (actionType.includes("call")) return 15;
    if (actionType.includes("email") || actionType.includes("dm")) return 5;
    if (actionType.includes("comment") || actionType.includes("reply")) {
      return 4;
    }
    return 8;
  }

  private findQueue(userId: string, queueDate: Date) {
    return prisma.dailyCommandQueue.findUnique({
      where: { userId_queueDate: { userId, queueDate } },
      include: QUEUE_INCLUDE,
    });
  }

  private serializeQueue(
    queue: Prisma.DailyCommandQueueGetPayload<{ include: typeof QUEUE_INCLUDE }>,
  ) {
    return {
      ...queue,
      queueDate: queue.queueDate.toISOString().slice(0, 10),
      items: queue.items.map((item) => ({
        ...item,
        ancestry: {
          offering: item.offering || item.actionItem?.campaign.offering || null,
          campaign: item.campaign || item.actionItem?.campaign || null,
          actionLane: item.actionLane || item.actionItem?.actionLane || null,
          actionCycle: item.actionCycle || item.actionItem?.actionCycle || null,
        },
      })),
    };
  }

  private resolveQueueDate(date?: string) {
    if (!date) {
      const now = new Date();
      return new Date(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException("date must use YYYY-MM-DD");
    }

    return new Date(`${date}T00:00:00.000Z`);
  }

  private resolveLimit(limit?: number) {
    if (!limit) return 100;
    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException("limit must be a positive number");
    }
    return Math.min(Math.floor(limit), 250);
  }

  private resolveItemStatus(status?: CommandQueueItemStatus | string) {
    if (!status) return undefined;

    if (
      Object.values(CommandQueueItemStatus).includes(
        status as CommandQueueItemStatus,
      )
    ) {
      return status as CommandQueueItemStatus;
    }

    throw new BadRequestException(`Unsupported command queue status: ${status}`);
  }

  private applyStatusTimestamps(
    updateData: Prisma.CommandQueueItemUpdateInput,
    status: CommandQueueItemStatus,
    now: Date,
    deferredUntil?: string,
  ) {
    if (status === CommandQueueItemStatus.presented) {
      updateData.presentedAt = now;
    }

    if (status === CommandQueueItemStatus.in_progress) {
      updateData.startedAt = now;
    }

    if (status === CommandQueueItemStatus.completed) {
      updateData.completedAt = now;
    }

    if (status === CommandQueueItemStatus.skipped) {
      updateData.skippedAt = now;
    }

    if (status === CommandQueueItemStatus.deferred) {
      updateData.deferredUntil = deferredUntil
        ? new Date(deferredUntil)
        : new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private async confirmedStatusForActionItem(
    tx: Prisma.TransactionClient,
    actionItemId: string,
  ) {
    const actionItem = await tx.actionItem.findUniqueOrThrow({
      where: { id: actionItemId },
      select: { actionType: true },
    });

    return actionItem.actionType.includes("post") ||
      actionItem.actionType.includes("publish")
      ? ActionItemStatus.published_confirmed
      : ActionItemStatus.sent_confirmed;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }
}
