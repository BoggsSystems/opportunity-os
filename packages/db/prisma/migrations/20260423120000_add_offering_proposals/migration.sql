-- Add first-class pre-confirmation offering proposals inferred from AI conversation.
CREATE TYPE "OfferingProposalStatus" AS ENUM ('proposed', 'confirmed', 'rejected', 'superseded');

CREATE TABLE "offering_proposals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "aiConversationId" UUID,
    "confirmedOfferingId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "offeringType" "OfferingType" NOT NULL,
    "status" "OfferingProposalStatus" NOT NULL DEFAULT 'proposed',
    "targetAudiencesJson" JSONB,
    "problemSolved" TEXT,
    "outcomeCreated" TEXT,
    "credibility" TEXT,
    "bestOutreachAngle" TEXT,
    "suggestedAssetsJson" JSONB,
    "positioningJson" JSONB,
    "metadataJson" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "offering_proposals_userId_idx" ON "offering_proposals"("userId");
CREATE INDEX "offering_proposals_aiConversationId_idx" ON "offering_proposals"("aiConversationId");
CREATE INDEX "offering_proposals_confirmedOfferingId_idx" ON "offering_proposals"("confirmedOfferingId");
CREATE INDEX "offering_proposals_status_updatedAt_idx" ON "offering_proposals"("status", "updatedAt");

ALTER TABLE "offering_proposals"
  ADD CONSTRAINT "offering_proposals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "offering_proposals"
  ADD CONSTRAINT "offering_proposals_aiConversationId_fkey"
  FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "offering_proposals"
  ADD CONSTRAINT "offering_proposals_confirmedOfferingId_fkey"
  FOREIGN KEY ("confirmedOfferingId") REFERENCES "offerings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
