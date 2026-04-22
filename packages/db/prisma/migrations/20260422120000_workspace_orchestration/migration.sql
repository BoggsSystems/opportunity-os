-- CreateEnum
CREATE TYPE "OpportunityCyclePhase" AS ENUM ('surfaced', 'interpreted', 'proposed', 'drafting', 'awaiting_confirmation', 'executed', 'confirmed', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "OpportunityCycleStatus" AS ENUM ('active', 'paused', 'completed', 'dismissed', 'archived');

-- CreateEnum
CREATE TYPE "WorkspaceMode" AS ENUM ('empty', 'signal_review', 'goal_planning', 'campaign_review', 'opportunity_review', 'draft_edit', 'asset_review', 'execution_confirm', 'progress_summary');

-- CreateEnum
CREATE TYPE "WorkspaceSignalStatus" AS ENUM ('new', 'surfaced', 'active', 'consumed', 'dismissed', 'archived');

-- CreateEnum
CREATE TYPE "WorkspaceSignalImportance" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "WorkspaceCommandStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "workspace_signals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "importance" "WorkspaceSignalImportance" NOT NULL DEFAULT 'medium',
    "status" "WorkspaceSignalStatus" NOT NULL DEFAULT 'new',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "reason" TEXT,
    "recommendedAction" TEXT,
    "recommendedWorkspaceMode" "WorkspaceMode" NOT NULL DEFAULT 'signal_review',
    "evidenceJson" JSONB,
    "metadataJson" JSONB,
    "surfacedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_cycles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workspaceSignalId" UUID,
    "goalId" UUID,
    "strategicCampaignId" UUID,
    "opportunityId" UUID,
    "taskId" UUID,
    "discoveredOpportunityId" UUID,
    "aiConversationId" UUID,
    "phase" "OpportunityCyclePhase" NOT NULL DEFAULT 'surfaced',
    "status" "OpportunityCycleStatus" NOT NULL DEFAULT 'active',
    "workspaceMode" "WorkspaceMode" NOT NULL DEFAULT 'signal_review',
    "title" TEXT NOT NULL,
    "whyItMatters" TEXT,
    "recommendedAction" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "confidence" INTEGER,
    "allowedActionsJson" JSONB,
    "stateJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAdvancedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_commands" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opportunityCycleId" UUID,
    "aiConversationId" UUID,
    "commandType" TEXT NOT NULL,
    "status" "WorkspaceCommandStatus" NOT NULL DEFAULT 'pending',
    "inputJson" JSONB,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_signals_userId_idx" ON "workspace_signals"("userId");

-- CreateIndex
CREATE INDEX "workspace_signals_sourceType_sourceId_idx" ON "workspace_signals"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "workspace_signals_status_idx" ON "workspace_signals"("status");

-- CreateIndex
CREATE INDEX "workspace_signals_importance_idx" ON "workspace_signals"("importance");

-- CreateIndex
CREATE INDEX "workspace_signals_priorityScore_idx" ON "workspace_signals"("priorityScore");

-- CreateIndex
CREATE INDEX "workspace_signals_userId_status_priorityScore_idx" ON "workspace_signals"("userId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "opportunity_cycles_userId_idx" ON "opportunity_cycles"("userId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_workspaceSignalId_idx" ON "opportunity_cycles"("workspaceSignalId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_goalId_idx" ON "opportunity_cycles"("goalId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_strategicCampaignId_idx" ON "opportunity_cycles"("strategicCampaignId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_opportunityId_idx" ON "opportunity_cycles"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_taskId_idx" ON "opportunity_cycles"("taskId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_discoveredOpportunityId_idx" ON "opportunity_cycles"("discoveredOpportunityId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_aiConversationId_idx" ON "opportunity_cycles"("aiConversationId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_phase_idx" ON "opportunity_cycles"("phase");

-- CreateIndex
CREATE INDEX "opportunity_cycles_status_idx" ON "opportunity_cycles"("status");

-- CreateIndex
CREATE INDEX "opportunity_cycles_userId_status_priorityScore_idx" ON "opportunity_cycles"("userId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "opportunity_cycles_userId_status_updatedAt_idx" ON "opportunity_cycles"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "workspace_commands_userId_idx" ON "workspace_commands"("userId");

-- CreateIndex
CREATE INDEX "workspace_commands_opportunityCycleId_idx" ON "workspace_commands"("opportunityCycleId");

-- CreateIndex
CREATE INDEX "workspace_commands_aiConversationId_idx" ON "workspace_commands"("aiConversationId");

-- CreateIndex
CREATE INDEX "workspace_commands_commandType_idx" ON "workspace_commands"("commandType");

-- CreateIndex
CREATE INDEX "workspace_commands_status_idx" ON "workspace_commands"("status");

-- CreateIndex
CREATE INDEX "workspace_commands_createdAt_idx" ON "workspace_commands"("createdAt");

-- CreateIndex
CREATE INDEX "workspace_commands_userId_status_createdAt_idx" ON "workspace_commands"("userId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "workspace_signals" ADD CONSTRAINT "workspace_signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_workspaceSignalId_fkey" FOREIGN KEY ("workspaceSignalId") REFERENCES "workspace_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_strategicCampaignId_fkey" FOREIGN KEY ("strategicCampaignId") REFERENCES "strategic_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_discoveredOpportunityId_fkey" FOREIGN KEY ("discoveredOpportunityId") REFERENCES "discovered_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_commands" ADD CONSTRAINT "workspace_commands_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_commands" ADD CONSTRAINT "workspace_commands_opportunityCycleId_fkey" FOREIGN KEY ("opportunityCycleId") REFERENCES "opportunity_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_commands" ADD CONSTRAINT "workspace_commands_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
