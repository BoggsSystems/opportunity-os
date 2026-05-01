CREATE TYPE "DailyCommandQueueStatus" AS ENUM (
  'planned',
  'active',
  'completed',
  'archived'
);

CREATE TYPE "CommandQueueItemStatus" AS ENUM (
  'queued',
  'presented',
  'in_progress',
  'completed',
  'skipped',
  'deferred',
  'blocked',
  'failed'
);

CREATE TABLE "daily_command_queues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "queueDate" DATE NOT NULL,
  "status" "DailyCommandQueueStatus" NOT NULL DEFAULT 'planned',
  "title" TEXT,
  "summary" TEXT,
  "targetActionCount" INTEGER,
  "completedActionCount" INTEGER NOT NULL DEFAULT 0,
  "metadataJson" JSONB,
  "generatedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_command_queues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "command_queue_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "commandQueueId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "offeringId" UUID,
  "campaignId" UUID,
  "actionLaneId" UUID,
  "actionCycleId" UUID,
  "actionItemId" UUID,
  "position" INTEGER NOT NULL,
  "priorityScore" INTEGER NOT NULL DEFAULT 50,
  "status" "CommandQueueItemStatus" NOT NULL DEFAULT 'queued',
  "title" TEXT NOT NULL,
  "reason" TEXT,
  "estimatedMinutes" INTEGER,
  "scheduledFor" TIMESTAMP(3),
  "presentedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "deferredUntil" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "command_queue_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_command_queues_userId_queueDate_key" ON "daily_command_queues"("userId", "queueDate");
CREATE INDEX "daily_command_queues_userId_idx" ON "daily_command_queues"("userId");
CREATE INDEX "daily_command_queues_queueDate_idx" ON "daily_command_queues"("queueDate");
CREATE INDEX "daily_command_queues_status_idx" ON "daily_command_queues"("status");
CREATE INDEX "daily_command_queues_userId_status_queueDate_idx" ON "daily_command_queues"("userId", "status", "queueDate");

CREATE UNIQUE INDEX "command_queue_items_commandQueueId_position_key" ON "command_queue_items"("commandQueueId", "position");
CREATE INDEX "command_queue_items_commandQueueId_idx" ON "command_queue_items"("commandQueueId");
CREATE INDEX "command_queue_items_userId_idx" ON "command_queue_items"("userId");
CREATE INDEX "command_queue_items_offeringId_idx" ON "command_queue_items"("offeringId");
CREATE INDEX "command_queue_items_campaignId_idx" ON "command_queue_items"("campaignId");
CREATE INDEX "command_queue_items_actionLaneId_idx" ON "command_queue_items"("actionLaneId");
CREATE INDEX "command_queue_items_actionCycleId_idx" ON "command_queue_items"("actionCycleId");
CREATE INDEX "command_queue_items_actionItemId_idx" ON "command_queue_items"("actionItemId");
CREATE INDEX "command_queue_items_status_idx" ON "command_queue_items"("status");
CREATE INDEX "command_queue_items_scheduledFor_idx" ON "command_queue_items"("scheduledFor");
CREATE INDEX "command_queue_items_priorityScore_idx" ON "command_queue_items"("priorityScore");
CREATE INDEX "command_queue_items_userId_status_priorityScore_idx" ON "command_queue_items"("userId", "status", "priorityScore");

ALTER TABLE "daily_command_queues"
  ADD CONSTRAINT "daily_command_queues_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "command_queue_items"
  ADD CONSTRAINT "command_queue_items_commandQueueId_fkey"
  FOREIGN KEY ("commandQueueId") REFERENCES "daily_command_queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "command_queue_items"
  ADD CONSTRAINT "command_queue_items_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "command_queue_items"
  ADD CONSTRAINT "command_queue_items_offeringId_fkey"
  FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "command_queue_items"
  ADD CONSTRAINT "command_queue_items_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "command_queue_items"
  ADD CONSTRAINT "command_queue_items_actionLaneId_fkey"
  FOREIGN KEY ("actionLaneId") REFERENCES "action_lanes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "command_queue_items"
  ADD CONSTRAINT "command_queue_items_actionCycleId_fkey"
  FOREIGN KEY ("actionCycleId") REFERENCES "action_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "command_queue_items"
  ADD CONSTRAINT "command_queue_items_actionItemId_fkey"
  FOREIGN KEY ("actionItemId") REFERENCES "action_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
