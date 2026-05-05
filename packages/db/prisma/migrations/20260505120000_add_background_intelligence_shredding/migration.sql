-- CreateEnum
CREATE TYPE "IngestionArtifactStatus" AS ENUM ('discovered', 'staged', 'queued', 'processing', 'processed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "IntelligenceJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'retrying', 'cancelled');

-- CreateEnum
CREATE TYPE "IntelligenceJobKind" AS ENUM ('fast_summary', 'profile_shred', 'connections_cluster', 'message_thread_memory', 'content_memory', 'comments_signal_memory', 'recommendations_proof', 'endorsements_proof', 'job_market_memory', 'invitations_outreach_history', 'vector_embedding', 'posture_synthesis');

-- CreateEnum
CREATE TYPE "IntelligenceChunkKind" AS ENUM ('profile_summary', 'connection_cluster', 'message_thread_summary', 'post_theme', 'comment_signal', 'recommendation_proof', 'endorsement_proof', 'job_market_signal', 'invitation_signal', 'document_section', 'strategic_thesis', 'proof_point');

-- CreateEnum
CREATE TYPE "IntelligenceEmbeddingStatus" AS ENUM ('pending', 'embedded', 'failed', 'stale');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConceptSourceType" ADD VALUE 'linkedin_archive';
ALTER TYPE "ConceptSourceType" ADD VALUE 'linkedin_message';
ALTER TYPE "ConceptSourceType" ADD VALUE 'linkedin_comment';
ALTER TYPE "ConceptSourceType" ADD VALUE 'linkedin_article';
ALTER TYPE "ConceptSourceType" ADD VALUE 'linkedin_recommendation';
ALTER TYPE "ConceptSourceType" ADD VALUE 'linkedin_job_application';
ALTER TYPE "ConceptSourceType" ADD VALUE 'intelligence_chunk';

-- AlterTable
ALTER TABLE "intelligence_sources" ADD COLUMN     "chunkId" UUID;

-- CreateTable
CREATE TABLE "ingestion_artifacts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assetIngestionBatchId" UUID,
    "assetIngestionItemId" UUID,
    "connectionImportBatchId" UUID,
    "userConnectorId" UUID,
    "connectorAssetId" UUID,
    "userAssetId" UUID,
    "providerName" TEXT,
    "sourceKind" VARCHAR(80) NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourcePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "checksum" TEXT,
    "recordCount" INTEGER,
    "status" "IngestionArtifactStatus" NOT NULL DEFAULT 'discovered',
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_jobs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ingestionArtifactId" UUID,
    "assetIngestionBatchId" UUID,
    "assetIngestionItemId" UUID,
    "kind" "IntelligenceJobKind" NOT NULL,
    "status" "IntelligenceJobStatus" NOT NULL DEFAULT 'queued',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_chunks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ingestionArtifactId" UUID,
    "intelligenceJobId" UUID,
    "chunkKind" "IntelligenceChunkKind" NOT NULL,
    "sourceType" VARCHAR(80),
    "sourceId" TEXT,
    "externalKey" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "tokenCount" INTEGER,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_embeddings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "providerName" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "dimensions" INTEGER,
    "vectorRef" TEXT,
    "status" "IntelligenceEmbeddingStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingestion_artifacts_userId_status_idx" ON "ingestion_artifacts"("userId", "status");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_userId_sourceKind_idx" ON "ingestion_artifacts"("userId", "sourceKind");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_assetIngestionBatchId_idx" ON "ingestion_artifacts"("assetIngestionBatchId");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_assetIngestionItemId_idx" ON "ingestion_artifacts"("assetIngestionItemId");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_connectionImportBatchId_idx" ON "ingestion_artifacts"("connectionImportBatchId");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_userConnectorId_idx" ON "ingestion_artifacts"("userConnectorId");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_connectorAssetId_idx" ON "ingestion_artifacts"("connectorAssetId");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_userAssetId_idx" ON "ingestion_artifacts"("userAssetId");

-- CreateIndex
CREATE INDEX "ingestion_artifacts_providerName_idx" ON "ingestion_artifacts"("providerName");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_artifacts_assetIngestionBatchId_sourcePath_key" ON "ingestion_artifacts"("assetIngestionBatchId", "sourcePath");

-- CreateIndex
CREATE INDEX "intelligence_jobs_userId_status_idx" ON "intelligence_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "intelligence_jobs_status_priority_scheduledAt_idx" ON "intelligence_jobs"("status", "priority", "scheduledAt");

-- CreateIndex
CREATE INDEX "intelligence_jobs_kind_status_idx" ON "intelligence_jobs"("kind", "status");

-- CreateIndex
CREATE INDEX "intelligence_jobs_ingestionArtifactId_idx" ON "intelligence_jobs"("ingestionArtifactId");

-- CreateIndex
CREATE INDEX "intelligence_jobs_assetIngestionBatchId_idx" ON "intelligence_jobs"("assetIngestionBatchId");

-- CreateIndex
CREATE INDEX "intelligence_jobs_assetIngestionItemId_idx" ON "intelligence_jobs"("assetIngestionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_jobs_idempotencyKey_key" ON "intelligence_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "intelligence_chunks_userId_chunkKind_idx" ON "intelligence_chunks"("userId", "chunkKind");

-- CreateIndex
CREATE INDEX "intelligence_chunks_userId_sourceType_sourceId_idx" ON "intelligence_chunks"("userId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "intelligence_chunks_ingestionArtifactId_idx" ON "intelligence_chunks"("ingestionArtifactId");

-- CreateIndex
CREATE INDEX "intelligence_chunks_intelligenceJobId_idx" ON "intelligence_chunks"("intelligenceJobId");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_chunks_ingestionArtifactId_externalKey_key" ON "intelligence_chunks"("ingestionArtifactId", "externalKey");

-- CreateIndex
CREATE INDEX "intelligence_embeddings_userId_status_idx" ON "intelligence_embeddings"("userId", "status");

-- CreateIndex
CREATE INDEX "intelligence_embeddings_vectorRef_idx" ON "intelligence_embeddings"("vectorRef");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_embeddings_chunkId_providerName_modelName_key" ON "intelligence_embeddings"("chunkId", "providerName", "modelName");

-- CreateIndex
CREATE INDEX "intelligence_sources_chunkId_idx" ON "intelligence_sources"("chunkId");

-- AddForeignKey
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_assetIngestionBatchId_fkey" FOREIGN KEY ("assetIngestionBatchId") REFERENCES "asset_ingestion_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_assetIngestionItemId_fkey" FOREIGN KEY ("assetIngestionItemId") REFERENCES "asset_ingestion_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_connectionImportBatchId_fkey" FOREIGN KEY ("connectionImportBatchId") REFERENCES "connection_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_connectorAssetId_fkey" FOREIGN KEY ("connectorAssetId") REFERENCES "connector_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_userAssetId_fkey" FOREIGN KEY ("userAssetId") REFERENCES "user_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_jobs" ADD CONSTRAINT "intelligence_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_jobs" ADD CONSTRAINT "intelligence_jobs_ingestionArtifactId_fkey" FOREIGN KEY ("ingestionArtifactId") REFERENCES "ingestion_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_jobs" ADD CONSTRAINT "intelligence_jobs_assetIngestionBatchId_fkey" FOREIGN KEY ("assetIngestionBatchId") REFERENCES "asset_ingestion_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_jobs" ADD CONSTRAINT "intelligence_jobs_assetIngestionItemId_fkey" FOREIGN KEY ("assetIngestionItemId") REFERENCES "asset_ingestion_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_chunks" ADD CONSTRAINT "intelligence_chunks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_chunks" ADD CONSTRAINT "intelligence_chunks_ingestionArtifactId_fkey" FOREIGN KEY ("ingestionArtifactId") REFERENCES "ingestion_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_chunks" ADD CONSTRAINT "intelligence_chunks_intelligenceJobId_fkey" FOREIGN KEY ("intelligenceJobId") REFERENCES "intelligence_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_embeddings" ADD CONSTRAINT "intelligence_embeddings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_embeddings" ADD CONSTRAINT "intelligence_embeddings_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "intelligence_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_sources" ADD CONSTRAINT "intelligence_sources_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "intelligence_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

