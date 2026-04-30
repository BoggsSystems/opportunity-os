CREATE TABLE "referral_visits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "referralLinkId" UUID,
  "referralAttributionId" UUID,
  "referrerUserId" UUID,
  "referredUserId" UUID,
  "referralCode" TEXT,
  "visitorId" TEXT,
  "guestSessionId" TEXT,
  "landingPath" TEXT,
  "landingUrl" TEXT,
  "referrerUrl" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmContent" TEXT,
  "utmTerm" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "country" TEXT,
  "region" TEXT,
  "city" TEXT,
  "deviceType" TEXT,
  "browser" TEXT,
  "convertedAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_visits_referralLinkId_idx" ON "referral_visits"("referralLinkId");
CREATE INDEX "referral_visits_referralAttributionId_idx" ON "referral_visits"("referralAttributionId");
CREATE INDEX "referral_visits_referrerUserId_idx" ON "referral_visits"("referrerUserId");
CREATE INDEX "referral_visits_referredUserId_idx" ON "referral_visits"("referredUserId");
CREATE INDEX "referral_visits_referralCode_idx" ON "referral_visits"("referralCode");
CREATE INDEX "referral_visits_visitorId_idx" ON "referral_visits"("visitorId");
CREATE INDEX "referral_visits_guestSessionId_idx" ON "referral_visits"("guestSessionId");
CREATE INDEX "referral_visits_utmSource_utmCampaign_idx" ON "referral_visits"("utmSource", "utmCampaign");
CREATE INDEX "referral_visits_createdAt_idx" ON "referral_visits"("createdAt");
CREATE INDEX "referral_visits_convertedAt_idx" ON "referral_visits"("convertedAt");

ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "referral_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_referralAttributionId_fkey" FOREIGN KEY ("referralAttributionId") REFERENCES "referral_attributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "referral_visits" ADD CONSTRAINT "referral_visits_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
