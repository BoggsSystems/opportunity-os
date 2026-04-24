ALTER TABLE "campaigns"
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "guestSessionId" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "strategicAngle" TEXT,
  ADD COLUMN IF NOT EXISTS "targetSegment" TEXT;

CREATE INDEX IF NOT EXISTS "campaigns_guestSessionId_idx" ON "campaigns"("guestSessionId");

INSERT INTO "campaigns" (
  "id",
  "userId",
  "guestSessionId",
  "offeringId",
  "goalId",
  "title",
  "description",
  "objective",
  "successDefinition",
  "strategicAngle",
  "targetSegment",
  "status",
  "priorityScore",
  "metricsJson",
  "metadataJson",
  "createdAt",
  "updatedAt"
)
SELECT
  sc."id",
  sc."userId",
  sc."guestSessionId",
  sc."offeringId",
  sc."goalId",
  sc."title",
  NULL,
  NULL,
  NULL,
  sc."strategicAngle",
  sc."targetSegment",
  sc."status"::"CampaignStatus",
  50,
  NULL,
  jsonb_build_object('migratedFrom', 'strategic_campaigns'),
  sc."createdAt",
  sc."updatedAt"
FROM "strategic_campaigns" sc
WHERE NOT EXISTS (
  SELECT 1
  FROM "campaigns" c
  WHERE c."id" = sc."id"
);

ALTER TABLE "opportunities" DROP CONSTRAINT IF EXISTS "opportunities_campaignId_fkey";
ALTER TABLE "asset_interactions" DROP CONSTRAINT IF EXISTS "asset_interactions_campaignId_fkey";
ALTER TABLE "campaign_assets" DROP CONSTRAINT IF EXISTS "campaign_assets_campaignId_fkey";
ALTER TABLE "discovery_scans" DROP CONSTRAINT IF EXISTS "discovery_scans_campaignId_fkey";
ALTER TABLE "opportunity_cycles" DROP CONSTRAINT IF EXISTS "opportunity_cycles_strategicCampaignId_fkey";
ALTER TABLE "momentum_states" DROP CONSTRAINT IF EXISTS "momentum_states_strategicCampaignId_fkey";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'opportunity_cycles'
      AND column_name = 'strategicCampaignId'
  ) THEN
    ALTER TABLE "opportunity_cycles" RENAME COLUMN "strategicCampaignId" TO "campaignId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'momentum_states'
      AND column_name = 'strategicCampaignId'
  ) THEN
    ALTER TABLE "momentum_states" RENAME COLUMN "strategicCampaignId" TO "campaignId";
  END IF;
END $$;

ALTER INDEX IF EXISTS "opportunity_cycles_strategicCampaignId_idx" RENAME TO "opportunity_cycles_campaignId_idx";
ALTER INDEX IF EXISTS "momentum_states_strategicCampaignId_idx" RENAME TO "momentum_states_campaignId_idx";

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_interactions"
  ADD CONSTRAINT "asset_interactions_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "campaign_assets"
  ADD CONSTRAINT "campaign_assets_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discovery_scans"
  ADD CONSTRAINT "discovery_scans_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "opportunity_cycles"
  ADD CONSTRAINT "opportunity_cycles_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "momentum_states"
  ADD CONSTRAINT "momentum_states_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "strategic_campaigns";
