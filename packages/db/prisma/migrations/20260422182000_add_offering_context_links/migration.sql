-- Add nullable offering context links to the orchestration spine.
ALTER TABLE "goals" ADD COLUMN "offeringId" UUID;
ALTER TABLE "strategic_campaigns" ADD COLUMN "offeringId" UUID;
ALTER TABLE "opportunity_cycles" ADD COLUMN "offeringId" UUID;

CREATE INDEX "goals_offeringId_idx" ON "goals"("offeringId");
CREATE INDEX "strategic_campaigns_offeringId_idx" ON "strategic_campaigns"("offeringId");
CREATE INDEX "opportunity_cycles_offeringId_idx" ON "opportunity_cycles"("offeringId");

ALTER TABLE "goals"
  ADD CONSTRAINT "goals_offeringId_fkey"
  FOREIGN KEY ("offeringId") REFERENCES "offerings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "strategic_campaigns"
  ADD CONSTRAINT "strategic_campaigns_offeringId_fkey"
  FOREIGN KEY ("offeringId") REFERENCES "offerings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "opportunity_cycles"
  ADD CONSTRAINT "opportunity_cycles_offeringId_fkey"
  FOREIGN KEY ("offeringId") REFERENCES "offerings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
