-- CreateEnum
CREATE TYPE "AssetIngestionBatchStatus" AS ENUM ('pending', 'running', 'completed', 'partial', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AssetIngestionItemStatus" AS ENUM ('selected', 'queued', 'processing', 'imported', 'failed', 'skipped');

-- AlterEnum
ALTER TYPE "ConceptSourceType" ADD VALUE 'connector_asset';

-- AlterTable
ALTER TABLE "intelligence_sources" ALTER COLUMN "sourceId" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "connector_assets" (
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
CREATE TABLE "asset_ingestion_batches" (
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
CREATE TABLE "asset_ingestion_items" (
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
CREATE INDEX "connector_assets_userId_userConnectorId_idx" ON "connector_assets"("userId", "userConnectorId");

-- CreateIndex
CREATE INDEX "connector_assets_userId_externalProvider_idx" ON "connector_assets"("userId", "externalProvider");

-- CreateIndex
CREATE INDEX "connector_assets_userId_discoveredAt_idx" ON "connector_assets"("userId", "discoveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "connector_assets_userConnectorId_externalId_key" ON "connector_assets"("userConnectorId", "externalId");

-- CreateIndex
CREATE INDEX "asset_ingestion_batches_userId_createdAt_idx" ON "asset_ingestion_batches"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "asset_ingestion_batches_userConnectorId_idx" ON "asset_ingestion_batches"("userConnectorId");

-- CreateIndex
CREATE INDEX "asset_ingestion_batches_status_createdAt_idx" ON "asset_ingestion_batches"("status", "createdAt");

-- CreateIndex
CREATE INDEX "asset_ingestion_items_batchId_idx" ON "asset_ingestion_items"("batchId");

-- CreateIndex
CREATE INDEX "asset_ingestion_items_userId_status_idx" ON "asset_ingestion_items"("userId", "status");

-- CreateIndex
CREATE INDEX "asset_ingestion_items_connectorAssetId_idx" ON "asset_ingestion_items"("connectorAssetId");

-- CreateIndex
CREATE INDEX "asset_ingestion_items_userAssetId_idx" ON "asset_ingestion_items"("userAssetId");

-- CreateIndex
CREATE INDEX "asset_ingestion_items_externalId_idx" ON "asset_ingestion_items"("externalId");

-- AddForeignKey
ALTER TABLE "connector_assets" ADD CONSTRAINT "connector_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_assets" ADD CONSTRAINT "connector_assets_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ingestion_batches" ADD CONSTRAINT "asset_ingestion_batches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ingestion_batches" ADD CONSTRAINT "asset_ingestion_batches_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "asset_ingestion_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_connectorAssetId_fkey" FOREIGN KEY ("connectorAssetId") REFERENCES "connector_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_ingestion_items" ADD CONSTRAINT "asset_ingestion_items_userAssetId_fkey" FOREIGN KEY ("userAssetId") REFERENCES "user_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
