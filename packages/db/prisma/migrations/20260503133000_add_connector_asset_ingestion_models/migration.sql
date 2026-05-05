-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetIngestionBatchStatus') THEN
    CREATE TYPE "AssetIngestionBatchStatus" AS ENUM ('pending', 'running', 'completed', 'partial', 'failed', 'cancelled');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetIngestionItemStatus') THEN
    CREATE TYPE "AssetIngestionItemStatus" AS ENUM ('selected', 'queued', 'processing', 'imported', 'failed', 'skipped');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConceptCategory') THEN
    CREATE TYPE "ConceptCategory" AS ENUM ('framework', 'methodology', 'stance', 'proof_point', 'story', 'metric');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConceptSourceType') THEN
    CREATE TYPE "ConceptSourceType" AS ENUM ('knowledge_asset', 'conversation_thread', 'email_message', 'manual_entry', 'linkedin_post', 'connector_asset');
  END IF;
END $$;

-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ConceptSourceType'
      AND e.enumlabel = 'connector_asset'
  ) THEN
    ALTER TYPE "ConceptSourceType" ADD VALUE 'connector_asset';
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "concepts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ConceptCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "isPromoted" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "proof_points" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPromoted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proof_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "intelligence_sources" (
    "id" UUID NOT NULL,
    "conceptId" UUID,
    "proofPointId" UUID,
    "sourceType" "ConceptSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "concept_relationships" (
    "parentId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "relationshipType" TEXT,

    CONSTRAINT "concept_relationships_pkey" PRIMARY KEY ("parentId","childId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "concept_proof_links" (
    "conceptId" UUID NOT NULL,
    "proofPointId" UUID NOT NULL,

    CONSTRAINT "concept_proof_links_pkey" PRIMARY KEY ("conceptId","proofPointId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "intelligence_usage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conceptId" UUID,
    "proofPointId" UUID,
    "actionItemId" UUID,
    "sentiment" DOUBLE PRECISION,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "concept_refinements" (
    "id" UUID NOT NULL,
    "conceptId" UUID NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "refinementType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_refinements_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "intelligence_sources" ALTER COLUMN "sourceId" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "connector_assets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userConnectorId" UUID NOT NULL,
    "externalProvider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "webViewLink" TEXT,
    "versionToken" TEXT,
    "modifiedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_ingestion_batches" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userConnectorId" UUID,
    "sourceType" "ConceptSourceType" NOT NULL,
    "status" "AssetIngestionBatchStatus" NOT NULL DEFAULT 'pending',
    "providerName" TEXT,
    "requestedAssetCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_ingestion_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "asset_ingestion_items" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "connectorAssetId" UUID,
    "userAssetId" UUID,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "AssetIngestionItemStatus" NOT NULL DEFAULT 'selected',
    "errorMessage" TEXT,
    "conceptCount" INTEGER NOT NULL DEFAULT 0,
    "proofPointCount" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_ingestion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "connector_assets_userId_userConnectorId_idx" ON "connector_assets"("userId", "userConnectorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "connector_assets_userId_externalProvider_idx" ON "connector_assets"("userId", "externalProvider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "connector_assets_userId_discoveredAt_idx" ON "connector_assets"("userId", "discoveredAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "connector_assets_userConnectorId_externalId_key" ON "connector_assets"("userConnectorId", "externalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_batches_userId_createdAt_idx" ON "asset_ingestion_batches"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_batches_userConnectorId_idx" ON "asset_ingestion_batches"("userConnectorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_batches_status_createdAt_idx" ON "asset_ingestion_batches"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_items_batchId_idx" ON "asset_ingestion_items"("batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_items_userId_status_idx" ON "asset_ingestion_items"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_items_connectorAssetId_idx" ON "asset_ingestion_items"("connectorAssetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_items_userAssetId_idx" ON "asset_ingestion_items"("userAssetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "asset_ingestion_items_externalId_idx" ON "asset_ingestion_items"("externalId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concepts_userId_fkey') THEN
    ALTER TABLE "concepts" ADD CONSTRAINT "concepts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proof_points_userId_fkey') THEN
    ALTER TABLE "proof_points" ADD CONSTRAINT "proof_points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intelligence_sources_conceptId_fkey') THEN
    ALTER TABLE "intelligence_sources" ADD CONSTRAINT "intelligence_sources_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intelligence_sources_proofPointId_fkey') THEN
    ALTER TABLE "intelligence_sources" ADD CONSTRAINT "intelligence_sources_proofPointId_fkey" FOREIGN KEY ("proofPointId") REFERENCES "proof_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concept_relationships_parentId_fkey') THEN
    ALTER TABLE "concept_relationships" ADD CONSTRAINT "concept_relationships_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concept_relationships_childId_fkey') THEN
    ALTER TABLE "concept_relationships" ADD CONSTRAINT "concept_relationships_childId_fkey" FOREIGN KEY ("childId") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concept_proof_links_conceptId_fkey') THEN
    ALTER TABLE "concept_proof_links" ADD CONSTRAINT "concept_proof_links_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concept_proof_links_proofPointId_fkey') THEN
    ALTER TABLE "concept_proof_links" ADD CONSTRAINT "concept_proof_links_proofPointId_fkey" FOREIGN KEY ("proofPointId") REFERENCES "proof_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intelligence_usage_userId_fkey') THEN
    ALTER TABLE "intelligence_usage" ADD CONSTRAINT "intelligence_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intelligence_usage_conceptId_fkey') THEN
    ALTER TABLE "intelligence_usage" ADD CONSTRAINT "intelligence_usage_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intelligence_usage_proofPointId_fkey') THEN
    ALTER TABLE "intelligence_usage" ADD CONSTRAINT "intelligence_usage_proofPointId_fkey" FOREIGN KEY ("proofPointId") REFERENCES "proof_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intelligence_usage_actionItemId_fkey') THEN
    ALTER TABLE "intelligence_usage" ADD CONSTRAINT "intelligence_usage_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "action_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concept_refinements_conceptId_fkey') THEN
    ALTER TABLE "concept_refinements" ADD CONSTRAINT "concept_refinements_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connector_assets_userId_fkey') THEN
    ALTER TABLE "connector_assets" ADD CONSTRAINT "connector_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'connector_assets_userConnectorId_fkey') THEN
    ALTER TABLE "connector_assets" ADD CONSTRAINT "connector_assets_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_ingestion_batches_userId_fkey') THEN
    ALTER TABLE "asset_ingestion_batches" ADD CONSTRAINT "asset_ingestion_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_ingestion_batches_userConnectorId_fkey') THEN
    ALTER TABLE "asset_ingestion_batches" ADD CONSTRAINT "asset_ingestion_batches_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_ingestion_items_batchId_fkey') THEN
    ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "asset_ingestion_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_ingestion_items_userId_fkey') THEN
    ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_ingestion_items_connectorAssetId_fkey') THEN
    ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_connectorAssetId_fkey" FOREIGN KEY ("connectorAssetId") REFERENCES "connector_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_ingestion_items_userAssetId_fkey') THEN
    ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_userAssetId_fkey" FOREIGN KEY ("userAssetId") REFERENCES "user_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
