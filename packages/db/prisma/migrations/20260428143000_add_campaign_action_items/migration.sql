-- Extend lane taxonomy for human-in-the-loop campaign execution.
ALTER TYPE "ActionLaneType" ADD VALUE IF NOT EXISTS 'linkedin_dm';
ALTER TYPE "ActionLaneType" ADD VALUE IF NOT EXISTS 'linkedin_commenting';
ALTER TYPE "ActionLaneType" ADD VALUE IF NOT EXISTS 'warm_intro';
ALTER TYPE "ActionLaneType" ADD VALUE IF NOT EXISTS 'relationship_reactivation';
ALTER TYPE "ActionLaneType" ADD VALUE IF NOT EXISTS 'account_research';

-- Action cycles now represent execution windows; preserve existing target/action
-- columns as nullable legacy context while concrete work moves to action_items.
ALTER TYPE "ActionCycleStatus" ADD VALUE IF NOT EXISTS 'planned';
ALTER TYPE "ActionCycleStatus" ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE "ActionCycleStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "ActionCycleStatus" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "ActionCycleStatus" ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE "action_cycles"
  ADD COLUMN IF NOT EXISTS "cycleNumber" INTEGER,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "objective" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedReasoningJson" JSONB,
  ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

ALTER TABLE "action_cycles"
  ALTER COLUMN "targetType" DROP NOT NULL,
  ALTER COLUMN "targetId" DROP NOT NULL,
  ALTER COLUMN "actionType" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "action_cycles_cycleNumber_idx" ON "action_cycles"("cycleNumber");
CREATE INDEX IF NOT EXISTS "action_cycles_campaignId_actionLaneId_cycleNumber_idx" ON "action_cycles"("campaignId", "actionLaneId", "cycleNumber");
CREATE INDEX IF NOT EXISTS "action_cycles_startsAt_idx" ON "action_cycles"("startsAt");
CREATE INDEX IF NOT EXISTS "action_cycles_endsAt_idx" ON "action_cycles"("endsAt");

CREATE TYPE "ActionItemStatus" AS ENUM (
  'suggested',
  'ready',
  'in_progress',
  'sent_confirmed',
  'published_confirmed',
  'skipped',
  'failed',
  'responded',
  'converted'
);

CREATE TYPE "ActionItemConfirmationSource" AS ENUM (
  'user_confirmed',
  'provider_verified',
  'system'
);

CREATE TABLE "action_items" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "actionLaneId" UUID NOT NULL,
  "actionCycleId" UUID,
  "activityId" UUID,
  "workspaceCommandId" UUID,
  "targetType" TEXT,
  "targetId" UUID,
  "targetPersonId" UUID,
  "targetCompanyId" UUID,
  "actionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "draftContent" TEXT,
  "finalContent" TEXT,
  "externalUrl" TEXT,
  "externalProvider" TEXT,
  "status" "ActionItemStatus" NOT NULL DEFAULT 'suggested',
  "confirmationRequired" BOOLEAN NOT NULL DEFAULT true,
  "confirmationSource" "ActionItemConfirmationSource",
  "priorityScore" INTEGER NOT NULL DEFAULT 50,
  "dueAt" TIMESTAMP(3),
  "preparedAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "action_items_userId_idx" ON "action_items"("userId");
CREATE INDEX "action_items_campaignId_idx" ON "action_items"("campaignId");
CREATE INDEX "action_items_actionLaneId_idx" ON "action_items"("actionLaneId");
CREATE INDEX "action_items_actionCycleId_idx" ON "action_items"("actionCycleId");
CREATE INDEX "action_items_activityId_idx" ON "action_items"("activityId");
CREATE INDEX "action_items_workspaceCommandId_idx" ON "action_items"("workspaceCommandId");
CREATE INDEX "action_items_targetType_targetId_idx" ON "action_items"("targetType", "targetId");
CREATE INDEX "action_items_targetPersonId_idx" ON "action_items"("targetPersonId");
CREATE INDEX "action_items_targetCompanyId_idx" ON "action_items"("targetCompanyId");
CREATE INDEX "action_items_actionType_idx" ON "action_items"("actionType");
CREATE INDEX "action_items_status_idx" ON "action_items"("status");
CREATE INDEX "action_items_dueAt_idx" ON "action_items"("dueAt");
CREATE INDEX "action_items_completedAt_idx" ON "action_items"("completedAt");
CREATE INDEX "action_items_campaignId_status_priorityScore_idx" ON "action_items"("campaignId", "status", "priorityScore");
CREATE INDEX "action_items_actionLaneId_status_priorityScore_idx" ON "action_items"("actionLaneId", "status", "priorityScore");

ALTER TABLE "action_items" ADD CONSTRAINT "action_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_actionLaneId_fkey" FOREIGN KEY ("actionLaneId") REFERENCES "action_lanes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_actionCycleId_fkey" FOREIGN KEY ("actionCycleId") REFERENCES "action_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_workspaceCommandId_fkey" FOREIGN KEY ("workspaceCommandId") REFERENCES "workspace_commands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
