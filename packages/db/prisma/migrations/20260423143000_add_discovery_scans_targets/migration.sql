-- Add first-class discovery scans, explainable targets, and source evidence.
ALTER TYPE "WorkspaceMode" ADD VALUE IF NOT EXISTS 'discovery_review';

CREATE TYPE "DiscoveryScanType" AS ENUM ('companies', 'people', 'university_professors', 'content_signals', 'mixed');
CREATE TYPE "DiscoveryScanStatus" AS ENUM ('requested', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE "DiscoveryTargetType" AS ENUM ('company', 'person', 'university_professor', 'content_signal', 'opportunity');
CREATE TYPE "DiscoveryTargetStatus" AS ENUM ('proposed', 'accepted', 'rejected', 'promoted', 'duplicate', 'archived');
CREATE TYPE "DiscoveryEvidenceType" AS ENUM ('website', 'linkedin', 'publication', 'article', 'profile', 'directory', 'search_result', 'uploaded_content', 'other');

CREATE TABLE "discovery_scans" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "offeringId" UUID,
    "campaignId" UUID,
    "goalId" UUID,
    "scanType" "DiscoveryScanType" NOT NULL DEFAULT 'mixed',
    "status" "DiscoveryScanStatus" NOT NULL DEFAULT 'requested',
    "providerKey" TEXT NOT NULL DEFAULT 'local_mock',
    "query" TEXT NOT NULL,
    "targetSegment" TEXT,
    "maxTargets" INTEGER NOT NULL DEFAULT 10,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "promotedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "requestContextJson" JSONB,
    "providerResultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_scans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discovery_targets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "targetType" "DiscoveryTargetType" NOT NULL DEFAULT 'person',
    "status" "DiscoveryTargetStatus" NOT NULL DEFAULT 'proposed',
    "title" TEXT NOT NULL,
    "companyName" TEXT,
    "personName" TEXT,
    "roleTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "location" TEXT,
    "sourceUrl" TEXT,
    "dedupeKey" TEXT,
    "confidenceScore" INTEGER NOT NULL DEFAULT 50,
    "relevanceScore" INTEGER NOT NULL DEFAULT 50,
    "qualificationScore" INTEGER,
    "whyThisTarget" TEXT,
    "recommendedAction" TEXT,
    "rejectionReason" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "companyId" UUID,
    "personId" UUID,
    "opportunityId" UUID,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discovery_evidence" (
    "id" UUID NOT NULL,
    "discoveryTargetId" UUID NOT NULL,
    "evidenceType" "DiscoveryEvidenceType" NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "snippet" TEXT,
    "publishedAt" TIMESTAMP(3),
    "confidenceScore" INTEGER NOT NULL DEFAULT 50,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovery_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_scans_userId_idx" ON "discovery_scans"("userId");
CREATE INDEX "discovery_scans_offeringId_idx" ON "discovery_scans"("offeringId");
CREATE INDEX "discovery_scans_campaignId_idx" ON "discovery_scans"("campaignId");
CREATE INDEX "discovery_scans_goalId_idx" ON "discovery_scans"("goalId");
CREATE INDEX "discovery_scans_status_idx" ON "discovery_scans"("status");
CREATE INDEX "discovery_scans_scanType_idx" ON "discovery_scans"("scanType");
CREATE INDEX "discovery_scans_userId_status_createdAt_idx" ON "discovery_scans"("userId", "status", "createdAt");

CREATE INDEX "discovery_targets_userId_idx" ON "discovery_targets"("userId");
CREATE INDEX "discovery_targets_scanId_idx" ON "discovery_targets"("scanId");
CREATE INDEX "discovery_targets_status_idx" ON "discovery_targets"("status");
CREATE INDEX "discovery_targets_targetType_idx" ON "discovery_targets"("targetType");
CREATE INDEX "discovery_targets_companyId_idx" ON "discovery_targets"("companyId");
CREATE INDEX "discovery_targets_personId_idx" ON "discovery_targets"("personId");
CREATE INDEX "discovery_targets_opportunityId_idx" ON "discovery_targets"("opportunityId");
CREATE INDEX "discovery_targets_relevanceScore_idx" ON "discovery_targets"("relevanceScore");
CREATE INDEX "discovery_targets_confidenceScore_idx" ON "discovery_targets"("confidenceScore");
CREATE INDEX "discovery_targets_userId_status_relevanceScore_idx" ON "discovery_targets"("userId", "status", "relevanceScore");
CREATE INDEX "discovery_targets_dedupeKey_idx" ON "discovery_targets"("dedupeKey");

CREATE INDEX "discovery_evidence_discoveryTargetId_idx" ON "discovery_evidence"("discoveryTargetId");
CREATE INDEX "discovery_evidence_evidenceType_idx" ON "discovery_evidence"("evidenceType");
CREATE INDEX "discovery_evidence_sourceUrl_idx" ON "discovery_evidence"("sourceUrl");

ALTER TABLE "discovery_scans"
  ADD CONSTRAINT "discovery_scans_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discovery_scans"
  ADD CONSTRAINT "discovery_scans_offeringId_fkey"
  FOREIGN KEY ("offeringId") REFERENCES "offerings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "discovery_scans"
  ADD CONSTRAINT "discovery_scans_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "strategic_campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "discovery_scans"
  ADD CONSTRAINT "discovery_scans_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "goals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "discovery_targets"
  ADD CONSTRAINT "discovery_targets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discovery_targets"
  ADD CONSTRAINT "discovery_targets_scanId_fkey"
  FOREIGN KEY ("scanId") REFERENCES "discovery_scans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discovery_targets"
  ADD CONSTRAINT "discovery_targets_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "discovery_targets"
  ADD CONSTRAINT "discovery_targets_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "people"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "discovery_targets"
  ADD CONSTRAINT "discovery_targets_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "discovery_evidence"
  ADD CONSTRAINT "discovery_evidence_discoveryTargetId_fkey"
  FOREIGN KEY ("discoveryTargetId") REFERENCES "discovery_targets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
