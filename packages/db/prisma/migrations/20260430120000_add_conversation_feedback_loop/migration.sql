CREATE TYPE "ConversationThreadStatus" AS ENUM (
  'active',
  'waiting_for_reply',
  'needs_response',
  'closed',
  'archived'
);

CREATE TYPE "ConversationMessageDirection" AS ENUM (
  'outbound',
  'inbound',
  'internal'
);

CREATE TYPE "ConversationMessageSource" AS ENUM (
  'manual_paste',
  'screenshot',
  'upload',
  'provider_sync',
  'system'
);

CREATE TYPE "ConversationInsightSentiment" AS ENUM (
  'positive',
  'neutral',
  'negative',
  'mixed',
  'unknown'
);

CREATE TABLE "conversation_threads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "campaignId" UUID,
  "actionLaneId" UUID,
  "actionCycleId" UUID,
  "actionItemId" UUID,
  "targetPersonId" UUID,
  "targetCompanyId" UUID,
  "channel" TEXT NOT NULL,
  "externalProvider" TEXT,
  "externalThreadUrl" TEXT,
  "status" "ConversationThreadStatus" NOT NULL DEFAULT 'active',
  "latestSummary" TEXT,
  "latestSentiment" "ConversationInsightSentiment" NOT NULL DEFAULT 'unknown',
  "latestIntent" TEXT,
  "nextActionSummary" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversation_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_thread_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "threadId" UUID NOT NULL,
  "direction" "ConversationMessageDirection" NOT NULL,
  "source" "ConversationMessageSource" NOT NULL DEFAULT 'manual_paste',
  "bodyText" TEXT,
  "attachmentUrls" TEXT[] NOT NULL,
  "attachmentMimeTypes" TEXT[] NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversation_thread_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_thread_insights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "threadId" UUID NOT NULL,
  "summary" TEXT NOT NULL,
  "sentiment" "ConversationInsightSentiment" NOT NULL DEFAULT 'unknown',
  "intent" TEXT,
  "objections" TEXT[] NOT NULL,
  "buyingSignals" TEXT[] NOT NULL,
  "recommendedNextAction" TEXT,
  "suggestedActionType" TEXT,
  "suggestedActionItemId" UUID,
  "evidenceMessageIds" TEXT[] NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversation_thread_insights_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_actionLaneId_fkey" FOREIGN KEY ("actionLaneId") REFERENCES "action_lanes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_actionCycleId_fkey" FOREIGN KEY ("actionCycleId") REFERENCES "action_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "action_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversation_thread_messages" ADD CONSTRAINT "conversation_thread_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_thread_messages" ADD CONSTRAINT "conversation_thread_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "conversation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_thread_insights" ADD CONSTRAINT "conversation_thread_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_thread_insights" ADD CONSTRAINT "conversation_thread_insights_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "conversation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "conversation_threads_userId_idx" ON "conversation_threads"("userId");
CREATE INDEX "conversation_threads_campaignId_idx" ON "conversation_threads"("campaignId");
CREATE INDEX "conversation_threads_actionLaneId_idx" ON "conversation_threads"("actionLaneId");
CREATE INDEX "conversation_threads_actionCycleId_idx" ON "conversation_threads"("actionCycleId");
CREATE INDEX "conversation_threads_actionItemId_idx" ON "conversation_threads"("actionItemId");
CREATE INDEX "conversation_threads_targetPersonId_idx" ON "conversation_threads"("targetPersonId");
CREATE INDEX "conversation_threads_targetCompanyId_idx" ON "conversation_threads"("targetCompanyId");
CREATE INDEX "conversation_threads_channel_idx" ON "conversation_threads"("channel");
CREATE INDEX "conversation_threads_status_idx" ON "conversation_threads"("status");
CREATE INDEX "conversation_threads_lastMessageAt_idx" ON "conversation_threads"("lastMessageAt");

CREATE INDEX "conversation_thread_messages_userId_idx" ON "conversation_thread_messages"("userId");
CREATE INDEX "conversation_thread_messages_threadId_idx" ON "conversation_thread_messages"("threadId");
CREATE INDEX "conversation_thread_messages_direction_idx" ON "conversation_thread_messages"("direction");
CREATE INDEX "conversation_thread_messages_source_idx" ON "conversation_thread_messages"("source");
CREATE INDEX "conversation_thread_messages_occurredAt_idx" ON "conversation_thread_messages"("occurredAt");

CREATE INDEX "conversation_thread_insights_userId_idx" ON "conversation_thread_insights"("userId");
CREATE INDEX "conversation_thread_insights_threadId_idx" ON "conversation_thread_insights"("threadId");
CREATE INDEX "conversation_thread_insights_sentiment_idx" ON "conversation_thread_insights"("sentiment");
CREATE INDEX "conversation_thread_insights_suggestedActionType_idx" ON "conversation_thread_insights"("suggestedActionType");
CREATE INDEX "conversation_thread_insights_suggestedActionItemId_idx" ON "conversation_thread_insights"("suggestedActionItemId");
