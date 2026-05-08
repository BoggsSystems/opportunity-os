DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignTargetStatus') THEN
    CREATE TYPE "CampaignTargetStatus" AS ENUM ('PROPOSED', 'SKIPPED', 'SELECTED', 'CONVERTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "campaign_target_queue_items" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "actionLaneId" UUID,
  "personId" UUID,
  "connectionRecordId" UUID,
  "score" INTEGER NOT NULL DEFAULT 0,
  "rationale" TEXT,
  "criteria" TEXT,
  "status" "CampaignTargetStatus" NOT NULL DEFAULT 'PROPOSED',
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campaign_target_queue_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_target_queue_items_userId_idx" ON "campaign_target_queue_items"("userId");
CREATE INDEX IF NOT EXISTS "campaign_target_queue_items_campaignId_idx" ON "campaign_target_queue_items"("campaignId");
CREATE INDEX IF NOT EXISTS "campaign_target_queue_items_actionLaneId_idx" ON "campaign_target_queue_items"("actionLaneId");
CREATE INDEX IF NOT EXISTS "campaign_target_queue_items_personId_idx" ON "campaign_target_queue_items"("personId");
CREATE INDEX IF NOT EXISTS "campaign_target_queue_items_connectionRecordId_idx" ON "campaign_target_queue_items"("connectionRecordId");
CREATE INDEX IF NOT EXISTS "campaign_target_queue_items_status_idx" ON "campaign_target_queue_items"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_target_queue_items_campaignId_personId_key" ON "campaign_target_queue_items"("campaignId", "personId");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_target_queue_items_campaignId_connectionRecordId_key" ON "campaign_target_queue_items"("campaignId", "connectionRecordId");

DO $$
BEGIN
  ALTER TABLE "campaign_target_queue_items"
    ADD CONSTRAINT "campaign_target_queue_items_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "campaign_target_queue_items"
    ADD CONSTRAINT "campaign_target_queue_items_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "campaign_target_queue_items"
    ADD CONSTRAINT "campaign_target_queue_items_actionLaneId_fkey"
    FOREIGN KEY ("actionLaneId") REFERENCES "action_lanes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "campaign_target_queue_items"
    ADD CONSTRAINT "campaign_target_queue_items_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "campaign_target_queue_items"
    ADD CONSTRAINT "campaign_target_queue_items_connectionRecordId_fkey"
    FOREIGN KEY ("connectionRecordId") REFERENCES "connection_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
