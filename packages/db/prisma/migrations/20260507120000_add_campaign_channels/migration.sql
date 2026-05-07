-- Add canonical execution channels and campaign-specific channel selections.

CREATE TABLE IF NOT EXISTS "channels" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requiresConnector" BOOLEAN NOT NULL DEFAULT false,
    "defaultConnectorProvider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "channels_code_key" ON "channels"("code");

CREATE TABLE IF NOT EXISTS "campaign_channels" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "channelId" UUID,
    "channelCode" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "rationale" TEXT,
    "recommendedByAi" BOOLEAN NOT NULL DEFAULT false,
    "cadenceHint" TEXT,
    "successMetric" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_channels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_channels_campaignId_idx" ON "campaign_channels"("campaignId");
CREATE INDEX IF NOT EXISTS "campaign_channels_channelId_idx" ON "campaign_channels"("channelId");
CREATE INDEX IF NOT EXISTS "campaign_channels_channelCode_idx" ON "campaign_channels"("channelCode");

ALTER TABLE "action_lanes" ADD COLUMN IF NOT EXISTS "campaignChannelId" UUID;
ALTER TABLE "action_lanes" ADD COLUMN IF NOT EXISTS "channelId" UUID;

CREATE INDEX IF NOT EXISTS "action_lanes_campaignChannelId_idx" ON "action_lanes"("campaignChannelId");
CREATE INDEX IF NOT EXISTS "action_lanes_channelId_idx" ON "action_lanes"("channelId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaign_channels_campaignId_fkey'
    ) THEN
        ALTER TABLE "campaign_channels"
            ADD CONSTRAINT "campaign_channels_campaignId_fkey"
            FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'campaign_channels_channelId_fkey'
    ) THEN
        ALTER TABLE "campaign_channels"
            ADD CONSTRAINT "campaign_channels_channelId_fkey"
            FOREIGN KEY ("channelId") REFERENCES "channels"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'action_lanes_campaignChannelId_fkey'
    ) THEN
        ALTER TABLE "action_lanes"
            ADD CONSTRAINT "action_lanes_campaignChannelId_fkey"
            FOREIGN KEY ("campaignChannelId") REFERENCES "campaign_channels"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'action_lanes_channelId_fkey'
    ) THEN
        ALTER TABLE "action_lanes"
            ADD CONSTRAINT "action_lanes_channelId_fkey"
            FOREIGN KEY ("channelId") REFERENCES "channels"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
