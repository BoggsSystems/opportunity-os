-- CreateEnum
CREATE TYPE "OfferingType" AS ENUM ('product', 'service', 'consulting', 'job_profile', 'other');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "OfferingAssetType" AS ENUM ('portfolio', 'case_study', 'testimonial', 'document', 'image', 'video', 'other');

-- CreateEnum
CREATE TYPE "OfferingPositioningStatus" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "AIConversationPurpose" AS ENUM ('offering_strategy', 'opportunity_analysis', 'general', 'other');

-- CreateEnum
CREATE TYPE "AIConversationStatus" AS ENUM ('active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "AIConversationMessageType" AS ENUM ('user', 'assistant', 'system', 'function_call', 'function_result');

-- CreateEnum
CREATE TYPE "AIContextSummaryType" AS ENUM ('offering_summary', 'opportunity_insight', 'user_preference', 'conversation_highlights', 'entity_overview', 'other');

-- CreateEnum
CREATE TYPE "AIContextSummarySourceType" AS ENUM ('ai_conversation', 'offering', 'opportunity', 'user', 'other');

-- CreateEnum
CREATE TYPE "AITaskType" AS ENUM ('offering_analysis', 'opportunity_analysis', 'content_generation', 'other');

-- CreateEnum
CREATE TYPE "AITaskStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "offerings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "offeringType" "OfferingType" NOT NULL,
    "status" "OfferingStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_positionings" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OfferingPositioningStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_positionings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_assets" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "offeringPositioningId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetType" "OfferingAssetType" NOT NULL,
    "contentUrl" TEXT,
    "contentText" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" "OfferingStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" "AIConversationPurpose" NOT NULL,
    "offeringId" UUID,
    "opportunityId" UUID,
    "status" "AIConversationStatus" NOT NULL DEFAULT 'active',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageType" "AIConversationMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_context_summaries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summaryType" "AIContextSummaryType" NOT NULL,
    "content" TEXT NOT NULL,
    "sourceType" "AIContextSummarySourceType" NOT NULL,
    "sourceId" TEXT,
    "aiConversationId" UUID,
    "offeringId" UUID,
    "opportunityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_context_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskType" "AITaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "aiConversationId" UUID,
    "offeringId" UUID,
    "opportunityId" UUID,
    "inputDataJson" JSONB,
    "outputDataJson" JSONB,
    "status" "AITaskStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offerings_userId_idx" ON "offerings"("userId");

-- CreateIndex
CREATE INDEX "offerings_offeringType_status_idx" ON "offerings"("offeringType", "status");

-- CreateIndex
CREATE INDEX "offerings_createdAt_idx" ON "offerings"("createdAt");

-- CreateIndex
CREATE INDEX "offering_positionings_offeringId_idx" ON "offering_positionings"("offeringId");

-- CreateIndex
CREATE INDEX "offering_positionings_status_idx" ON "offering_positionings"("status");

-- CreateIndex
CREATE INDEX "offering_assets_offeringId_idx" ON "offering_assets"("offeringId");

-- CreateIndex
CREATE INDEX "offering_assets_offeringPositioningId_idx" ON "offering_assets"("offeringPositioningId");

-- CreateIndex
CREATE INDEX "offering_assets_assetType_idx" ON "offering_assets"("assetType");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_offeringId_idx" ON "ai_conversations"("offeringId");

-- CreateIndex
CREATE INDEX "ai_conversations_opportunityId_idx" ON "ai_conversations"("opportunityId");

-- CreateIndex
CREATE INDEX "ai_conversations_status_updatedAt_idx" ON "ai_conversations"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_conversations_lastMessageAt_idx" ON "ai_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_conversationId_idx" ON "ai_conversation_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_createdAt_idx" ON "ai_conversation_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ai_context_summaries_userId_idx" ON "ai_context_summaries"("userId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_sourceType_sourceId_idx" ON "ai_context_summaries"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_aiConversationId_idx" ON "ai_context_summaries"("aiConversationId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_offeringId_idx" ON "ai_context_summaries"("offeringId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_opportunityId_idx" ON "ai_context_summaries"("opportunityId");

-- CreateIndex
CREATE INDEX "ai_tasks_userId_idx" ON "ai_tasks"("userId");

-- CreateIndex
CREATE INDEX "ai_tasks_taskType_status_idx" ON "ai_tasks"("taskType", "status");

-- CreateIndex
CREATE INDEX "ai_tasks_aiConversationId_idx" ON "ai_tasks"("aiConversationId");

-- CreateIndex
CREATE INDEX "ai_tasks_offeringId_idx" ON "ai_tasks"("offeringId");

-- CreateIndex
CREATE INDEX "ai_tasks_opportunityId_idx" ON "ai_tasks"("opportunityId");

-- CreateIndex
CREATE INDEX "ai_tasks_completedAt_idx" ON "ai_tasks"("completedAt");

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_positionings" ADD CONSTRAINT "offering_positionings_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_assets" ADD CONSTRAINT "offering_assets_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_assets" ADD CONSTRAINT "offering_assets_offeringPositioningId_fkey" FOREIGN KEY ("offeringPositioningId") REFERENCES "offering_positionings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
