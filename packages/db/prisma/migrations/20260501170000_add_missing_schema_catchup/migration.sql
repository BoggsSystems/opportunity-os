-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'push', 'in_app', 'sms');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed', 'simulated');

-- CreateEnum
CREATE TYPE "ConnectionImportStatus" AS ENUM ('uploading', 'parsing', 'processing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ConnectionStrength" AS ENUM ('very_weak', 'weak', 'moderate', 'strong', 'very_strong');

-- CreateEnum
CREATE TYPE "ConnectionSegmentType" AS ENUM ('by_company', 'by_title', 'by_industry', 'by_location', 'by_recency', 'by_strength', 'by_relevance');

-- CreateEnum
CREATE TYPE "BrowserSessionStatus" AS ENUM ('created', 'active', 'paused', 'completed', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "BrowserSessionMode" AS ENUM ('observe', 'guide', 'assist', 'automate_partial');

-- CreateEnum
CREATE TYPE "BrowserTargetType" AS ENUM ('linkedin_profile', 'job_application', 'website_form', 'company_portal', 'recruiting_portal', 'event_signup', 'generic_web', 'other');

-- CreateEnum
CREATE TYPE "BrowserActionType" AS ENUM ('navigate', 'click', 'type', 'select', 'upload', 'scroll', 'extract', 'screenshot', 'analyze', 'complete');

-- CreateEnum
CREATE TYPE "EngagementRewardTrigger" AS ENUM ('DAILY_QUOTA_MET', 'WEEKLY_QUOTA_MET', 'STREAK_HIT', 'CAMPAIGN_COMPLETED', 'ACTION_MILESTONE');

-- CreateEnum
CREATE TYPE "RewardRuleType" AS ENUM ('ACTION_THRESHOLD', 'CAMPAIGN_GOAL', 'TEMPORAL_STREAK');

-- CreateEnum
CREATE TYPE "WorkflowRole" AS ENUM ('IDENTITY', 'SIGNAL', 'STRATEGIC', 'DAILY_ACTION', 'EXECUTION', 'VERIFICATION', 'MOMENTUM');

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('UNDERSTAND_USER', 'SENSE_CONTEXT', 'GENERATE_STRATEGY', 'PRODUCE_ACTIONS', 'EXECUTE_ACTIONS', 'CONFIRM_OUTCOMES', 'MAINTAIN_MOMENTUM');

-- Required for strategic_theses.embedding.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'purchase';
ALTER TYPE "ActivityType" ADD VALUE 'abandoned_cart';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CapabilityType" ADD VALUE 'social';
ALTER TYPE "CapabilityType" ADD VALUE 'commerce';
ALTER TYPE "CapabilityType" ADD VALUE 'crm';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MomentumStateType" ADD VALUE 'streak';
ALTER TYPE "MomentumStateType" ADD VALUE 'velocity_pulse';

-- AlterTable
ALTER TABLE "admin_metric_snapshots" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "admin_operational_issues" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "billing_customers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "billing_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "capabilities" ADD COLUMN     "workflowRoles" "WorkflowRole"[];

-- AlterTable
ALTER TABLE "command_queue_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conversation_thread_insights" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conversation_thread_messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "conversation_threads" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "credentials" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT;

-- AlterTable
ALTER TABLE "daily_command_queues" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "entitlement_overrides" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "growth_credits" ADD COLUMN     "engagementRewardId" UUID;

-- AlterTable
ALTER TABLE "offerings" ADD COLUMN     "externalId" VARCHAR(255),
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "source" VARCHAR(50);

-- AlterTable
ALTER TABLE "referral_visits" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "usage_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_assets" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "userConnectorId" UUID,
ADD COLUMN     "versionToken" TEXT;

-- AlterTable
ALTER TABLE "user_connectors" ADD COLUMN     "enabledRoles" "WorkflowRole"[];

-- AlterTable
ALTER TABLE "user_lifecycle_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_lifecycle_snapshots" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "eventKey" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255),
    "body" TEXT NOT NULL,
    "metadataJson" JSONB,
    "providerName" VARCHAR(50),
    "providerMessageId" VARCHAR(255),
    "error" TEXT,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_engagement_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nudgeType" VARCHAR(100) NOT NULL,
    "strategyVersion" VARCHAR(50),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_engagement_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_mappings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localEntityType" TEXT NOT NULL,
    "localEntityId" UUID NOT NULL,
    "remoteProvider" TEXT NOT NULL,
    "remoteEntityId" TEXT NOT NULL,
    "remoteUrl" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opportunityId" UUID,
    "personId" UUID,
    "userConnectorId" UUID,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "location" TEXT,
    "meetingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "attendeesJson" JSONB,
    "syncMetadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_import_batches" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT,
    "source" TEXT,
    "filename" TEXT,
    "fileSize" INTEGER,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "createdPeopleCount" INTEGER NOT NULL DEFAULT 0,
    "updatedPeopleCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ConnectionImportStatus" NOT NULL DEFAULT 'parsing',
    "errorMessage" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_records" (
    "id" UUID NOT NULL,
    "importBatchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "personId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "title" TEXT,
    "linkedinUrl" TEXT,
    "connectedOn" DATE,
    "lastInteractionOn" DATE,
    "strength" "ConnectionStrength" NOT NULL DEFAULT 'moderate',
    "relevanceScore" DECIMAL(3,2),
    "isPotentialReferral" BOOLEAN NOT NULL DEFAULT false,
    "referralTargetNotes" TEXT,
    "campaignSuggestionsJson" JSONB,
    "importRowNumber" INTEGER NOT NULL,
    "importMetadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_segments" (
    "id" UUID NOT NULL,
    "importBatchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "segmentType" "ConnectionSegmentType" NOT NULL,
    "segmentKey" TEXT NOT NULL,
    "segmentName" TEXT NOT NULL,
    "description" TEXT,
    "connectionCount" INTEGER NOT NULL DEFAULT 0,
    "avgRelevanceScore" DECIMAL(3,2),
    "campaignSuggestion" TEXT,
    "priorityRank" INTEGER,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_segment_members" (
    "id" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "matchScore" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_segment_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opportunityId" UUID,
    "taskId" UUID,
    "status" "BrowserSessionStatus" NOT NULL DEFAULT 'created',
    "mode" "BrowserSessionMode" NOT NULL DEFAULT 'observe',
    "targetType" "BrowserTargetType" NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "currentUrl" TEXT,
    "currentPageTitle" TEXT,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "sessionConfigJson" JSONB,
    "aiAnalysisJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "browser_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_session_steps" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "actionType" "BrowserActionType" NOT NULL,
    "targetUrl" TEXT,
    "targetSelector" TEXT,
    "actionDataJson" JSONB,
    "resultStatus" TEXT,
    "resultDataJson" JSONB,
    "aiSuggestionJson" JSONB,
    "userAction" BOOLEAN NOT NULL DEFAULT false,
    "performedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "browser_session_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_session_artifacts" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "stepId" UUID,
    "artifactType" TEXT NOT NULL,
    "contentType" TEXT,
    "contentData" TEXT,
    "binaryData" BYTEA,
    "metadataJson" JSONB,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "browser_session_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_session_events" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL,
    "eventDataJson" JSONB,
    "ipAddress" INET,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "browser_session_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_theses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "relevanceTags" TEXT[],
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastRefined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategic_theses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_thesis_mappings" (
    "offeringId" UUID NOT NULL,
    "thesisId" UUID NOT NULL,

    CONSTRAINT "offering_thesis_mappings_pkey" PRIMARY KEY ("offeringId","thesisId")
);

-- CreateTable
CREATE TABLE "user_postures" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postureText" TEXT NOT NULL,
    "objectives" TEXT[],
    "preferredTone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_postures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_connectors" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "userConnectorId" UUID NOT NULL,
    "workflowStage" "WorkflowStage" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_rules" (
    "id" UUID NOT NULL,
    "ruleType" "RewardRuleType" NOT NULL,
    "triggerType" "EngagementRewardTrigger" NOT NULL,
    "criteriaJson" JSONB,
    "rewardType" "RewardType" NOT NULL,
    "rewardQuantity" INTEGER NOT NULL,
    "featureKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_rewards" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ruleId" UUID,
    "triggerType" "EngagementRewardTrigger" NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "featureKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'granted',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "providerName" VARCHAR(50) NOT NULL,
    "externalId" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255),
    "bio" TEXT,
    "languagesJson" JSONB,
    "contributionDensity" DECIMAL(5,2),
    "totalStars" INTEGER,
    "totalRepos" INTEGER,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_eventKey_idx" ON "notifications"("eventKey");

-- CreateIndex
CREATE INDEX "user_engagement_logs_userId_nudgeType_idx" ON "user_engagement_logs"("userId", "nudgeType");

-- CreateIndex
CREATE INDEX "user_engagement_logs_sentAt_idx" ON "user_engagement_logs"("sentAt");

-- CreateIndex
CREATE INDEX "external_mappings_localEntityType_localEntityId_idx" ON "external_mappings"("localEntityType", "localEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "external_mappings_userId_localEntityType_localEntityId_remo_key" ON "external_mappings"("userId", "localEntityType", "localEntityId", "remoteProvider");

-- CreateIndex
CREATE INDEX "calendar_events_userId_idx" ON "calendar_events"("userId");

-- CreateIndex
CREATE INDEX "calendar_events_opportunityId_idx" ON "calendar_events"("opportunityId");

-- CreateIndex
CREATE INDEX "calendar_events_startAt_idx" ON "calendar_events"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_userConnectorId_externalId_key" ON "calendar_events"("userConnectorId", "externalId");

-- CreateIndex
CREATE INDEX "connection_import_batches_userId_idx" ON "connection_import_batches"("userId");

-- CreateIndex
CREATE INDEX "connection_import_batches_status_idx" ON "connection_import_batches"("status");

-- CreateIndex
CREATE INDEX "connection_import_batches_createdAt_idx" ON "connection_import_batches"("createdAt");

-- CreateIndex
CREATE INDEX "connection_records_importBatchId_idx" ON "connection_records"("importBatchId");

-- CreateIndex
CREATE INDEX "connection_records_userId_idx" ON "connection_records"("userId");

-- CreateIndex
CREATE INDEX "connection_records_personId_idx" ON "connection_records"("personId");

-- CreateIndex
CREATE INDEX "connection_records_email_idx" ON "connection_records"("email");

-- CreateIndex
CREATE INDEX "connection_records_company_idx" ON "connection_records"("company");

-- CreateIndex
CREATE INDEX "connection_records_title_idx" ON "connection_records"("title");

-- CreateIndex
CREATE INDEX "connection_records_strength_idx" ON "connection_records"("strength");

-- CreateIndex
CREATE INDEX "connection_records_relevanceScore_idx" ON "connection_records"("relevanceScore");

-- CreateIndex
CREATE INDEX "connection_records_isPotentialReferral_idx" ON "connection_records"("isPotentialReferral");

-- CreateIndex
CREATE INDEX "connection_records_userId_company_idx" ON "connection_records"("userId", "company");

-- CreateIndex
CREATE INDEX "connection_records_userId_title_idx" ON "connection_records"("userId", "title");

-- CreateIndex
CREATE INDEX "connection_segments_importBatchId_idx" ON "connection_segments"("importBatchId");

-- CreateIndex
CREATE INDEX "connection_segments_userId_idx" ON "connection_segments"("userId");

-- CreateIndex
CREATE INDEX "connection_segments_segmentType_idx" ON "connection_segments"("segmentType");

-- CreateIndex
CREATE INDEX "connection_segments_priorityRank_idx" ON "connection_segments"("priorityRank");

-- CreateIndex
CREATE INDEX "connection_segments_userId_segmentType_priorityRank_idx" ON "connection_segments"("userId", "segmentType", "priorityRank");

-- CreateIndex
CREATE INDEX "connection_segment_members_segmentId_idx" ON "connection_segment_members"("segmentId");

-- CreateIndex
CREATE INDEX "connection_segment_members_connectionId_idx" ON "connection_segment_members"("connectionId");

-- CreateIndex
CREATE INDEX "connection_segment_members_segmentId_matchScore_idx" ON "connection_segment_members"("segmentId", "matchScore");

-- CreateIndex
CREATE INDEX "browser_sessions_userId_idx" ON "browser_sessions"("userId");

-- CreateIndex
CREATE INDEX "browser_sessions_opportunityId_idx" ON "browser_sessions"("opportunityId");

-- CreateIndex
CREATE INDEX "browser_sessions_taskId_idx" ON "browser_sessions"("taskId");

-- CreateIndex
CREATE INDEX "browser_sessions_status_idx" ON "browser_sessions"("status");

-- CreateIndex
CREATE INDEX "browser_sessions_targetType_idx" ON "browser_sessions"("targetType");

-- CreateIndex
CREATE INDEX "browser_sessions_userId_status_createdAt_idx" ON "browser_sessions"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "browser_session_steps_sessionId_idx" ON "browser_session_steps"("sessionId");

-- CreateIndex
CREATE INDEX "browser_session_steps_actionType_idx" ON "browser_session_steps"("actionType");

-- CreateIndex
CREATE INDEX "browser_session_steps_userAction_idx" ON "browser_session_steps"("userAction");

-- CreateIndex
CREATE INDEX "browser_session_steps_sessionId_stepNumber_idx" ON "browser_session_steps"("sessionId", "stepNumber");

-- CreateIndex
CREATE INDEX "browser_session_artifacts_sessionId_idx" ON "browser_session_artifacts"("sessionId");

-- CreateIndex
CREATE INDEX "browser_session_artifacts_stepId_idx" ON "browser_session_artifacts"("stepId");

-- CreateIndex
CREATE INDEX "browser_session_artifacts_artifactType_idx" ON "browser_session_artifacts"("artifactType");

-- CreateIndex
CREATE INDEX "browser_session_artifacts_createdAt_idx" ON "browser_session_artifacts"("createdAt");

-- CreateIndex
CREATE INDEX "browser_session_events_sessionId_idx" ON "browser_session_events"("sessionId");

-- CreateIndex
CREATE INDEX "browser_session_events_eventType_idx" ON "browser_session_events"("eventType");

-- CreateIndex
CREATE INDEX "browser_session_events_eventSource_idx" ON "browser_session_events"("eventSource");

-- CreateIndex
CREATE INDEX "browser_session_events_createdAt_idx" ON "browser_session_events"("createdAt");

-- CreateIndex
CREATE INDEX "browser_session_events_sessionId_createdAt_idx" ON "browser_session_events"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "strategic_theses_userId_idx" ON "strategic_theses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_postures_userId_key" ON "user_postures"("userId");

-- CreateIndex
CREATE INDEX "campaign_connectors_campaignId_idx" ON "campaign_connectors"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_connectors_userConnectorId_idx" ON "campaign_connectors"("userConnectorId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_connectors_campaignId_workflowStage_userConnectorI_key" ON "campaign_connectors"("campaignId", "workflowStage", "userConnectorId");

-- CreateIndex
CREATE INDEX "engagement_rewards_userId_idx" ON "engagement_rewards"("userId");

-- CreateIndex
CREATE INDEX "engagement_rewards_ruleId_idx" ON "engagement_rewards"("ruleId");

-- CreateIndex
CREATE INDEX "engagement_rewards_status_idx" ON "engagement_rewards"("status");

-- CreateIndex
CREATE INDEX "technical_profiles_userId_idx" ON "technical_profiles"("userId");

-- CreateIndex
CREATE INDEX "technical_profiles_externalId_idx" ON "technical_profiles"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "technical_profiles_userId_providerName_key" ON "technical_profiles"("userId", "providerName");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_engagement_logs" ADD CONSTRAINT "user_engagement_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_mappings" ADD CONSTRAINT "external_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_import_batches" ADD CONSTRAINT "connection_import_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_records" ADD CONSTRAINT "connection_records_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "connection_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_records" ADD CONSTRAINT "connection_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_records" ADD CONSTRAINT "connection_records_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_segments" ADD CONSTRAINT "connection_segments_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "connection_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_segments" ADD CONSTRAINT "connection_segments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_segment_members" ADD CONSTRAINT "connection_segment_members_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "connection_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_segment_members" ADD CONSTRAINT "connection_segment_members_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connection_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_session_steps" ADD CONSTRAINT "browser_session_steps_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "browser_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_session_artifacts" ADD CONSTRAINT "browser_session_artifacts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "browser_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_session_artifacts" ADD CONSTRAINT "browser_session_artifacts_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "browser_session_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_session_events" ADD CONSTRAINT "browser_session_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "browser_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategic_theses" ADD CONSTRAINT "strategic_theses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_thesis_mappings" ADD CONSTRAINT "offering_thesis_mappings_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_thesis_mappings" ADD CONSTRAINT "offering_thesis_mappings_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "strategic_theses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_postures" ADD CONSTRAINT "user_postures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_assets" ADD CONSTRAINT "user_assets_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_connectors" ADD CONSTRAINT "campaign_connectors_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_connectors" ADD CONSTRAINT "campaign_connectors_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_rewards" ADD CONSTRAINT "engagement_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_rewards" ADD CONSTRAINT "engagement_rewards_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "reward_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_credits" ADD CONSTRAINT "growth_credits_engagementRewardId_fkey" FOREIGN KEY ("engagementRewardId") REFERENCES "engagement_rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_profiles" ADD CONSTRAINT "technical_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
