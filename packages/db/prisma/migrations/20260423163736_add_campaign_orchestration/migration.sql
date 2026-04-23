-- CreateEnum
CREATE TYPE "ActionLaneType" AS ENUM ('email', 'linkedin_messaging', 'linkedin_content', 'call_outreach', 'referral_warm_intro', 'event_webinar_outreach', 'application_proposal', 'local_reactivation', 'client_retention', 'content_leverage', 'other');

-- CreateEnum
CREATE TYPE "ActionLaneStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActionCycleStatus" AS ENUM ('surfaced', 'pursuing', 'executed', 'confirmed', 'failed', 'dismissed');

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'ARCHIVED';

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "offeringId" UUID,
    "goalId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "successDefinition" TEXT,
    "timeframeStart" TIMESTAMP(3),
    "timeframeEnd" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'PLANNING',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "metricsJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_lanes" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "laneType" "ActionLaneType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT,
    "cadenceJson" JSONB,
    "targetCriteriaJson" JSONB,
    "status" "ActionLaneStatus" NOT NULL DEFAULT 'ACTIVE',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "metricsJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_lanes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_cycles" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "actionLaneId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" "ActionCycleStatus" NOT NULL DEFAULT 'surfaced',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "executionDataJson" JSONB,
    "outcomeDataJson" JSONB,
    "metadataJson" JSONB,
    "surfacedAt" TIMESTAMP(3),
    "pursuingAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_metrics" (
    "id" UUID NOT NULL,
    "campaignId" UUID,
    "actionLaneId" UUID,
    "userId" UUID NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricValue" DECIMAL(65,30) NOT NULL,
    "metricUnit" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "comparisonValue" DECIMAL(65,30),
    "trendDirection" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_userId_idx" ON "campaigns"("userId");

-- CreateIndex
CREATE INDEX "campaigns_offeringId_idx" ON "campaigns"("offeringId");

-- CreateIndex
CREATE INDEX "campaigns_goalId_idx" ON "campaigns"("goalId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_userId_status_priorityScore_idx" ON "campaigns"("userId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "campaigns_timeframeStart_idx" ON "campaigns"("timeframeStart");

-- CreateIndex
CREATE INDEX "campaigns_timeframeEnd_idx" ON "campaigns"("timeframeEnd");

-- CreateIndex
CREATE INDEX "action_lanes_campaignId_idx" ON "action_lanes"("campaignId");

-- CreateIndex
CREATE INDEX "action_lanes_laneType_idx" ON "action_lanes"("laneType");

-- CreateIndex
CREATE INDEX "action_lanes_status_idx" ON "action_lanes"("status");

-- CreateIndex
CREATE INDEX "action_lanes_campaignId_status_priorityScore_idx" ON "action_lanes"("campaignId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "action_lanes_createdAt_idx" ON "action_lanes"("createdAt");

-- CreateIndex
CREATE INDEX "action_cycles_campaignId_idx" ON "action_cycles"("campaignId");

-- CreateIndex
CREATE INDEX "action_cycles_actionLaneId_idx" ON "action_cycles"("actionLaneId");

-- CreateIndex
CREATE INDEX "action_cycles_targetType_targetId_idx" ON "action_cycles"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "action_cycles_status_idx" ON "action_cycles"("status");

-- CreateIndex
CREATE INDEX "action_cycles_campaignId_status_priorityScore_idx" ON "action_cycles"("campaignId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "action_cycles_surfacedAt_idx" ON "action_cycles"("surfacedAt");

-- CreateIndex
CREATE INDEX "action_cycles_executedAt_idx" ON "action_cycles"("executedAt");

-- CreateIndex
-- CreateIndex
CREATE INDEX "campaign_metrics_campaignId_idx" ON "campaign_metrics"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_metrics_actionLaneId_idx" ON "campaign_metrics"("actionLaneId");

-- CreateIndex
CREATE INDEX "campaign_metrics_userId_idx" ON "campaign_metrics"("userId");

-- CreateIndex
CREATE INDEX "campaign_metrics_metricType_idx" ON "campaign_metrics"("metricType");

-- CreateIndex
CREATE INDEX "campaign_metrics_campaignId_metricType_periodStart_idx" ON "campaign_metrics"("campaignId", "metricType", "periodStart");

-- CreateIndex
CREATE INDEX "campaign_metrics_actionLaneId_metricType_periodStart_idx" ON "campaign_metrics"("actionLaneId", "metricType", "periodStart");

-- CreateIndex
CREATE INDEX "campaign_metrics_computedAt_idx" ON "campaign_metrics"("computedAt");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_lanes" ADD CONSTRAINT "action_lanes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cycles" ADD CONSTRAINT "action_cycles_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_cycles" ADD CONSTRAINT "action_cycles_actionLaneId_fkey" FOREIGN KEY ("actionLaneId") REFERENCES "action_lanes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_actionLaneId_fkey" FOREIGN KEY ("actionLaneId") REFERENCES "action_lanes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
