ALTER TABLE "discovery_scans"
ADD COLUMN "provider_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "discovery_provider_runs" (
  "id" UUID NOT NULL,
  "discovery_scan_id" UUID NOT NULL,
  "provider_key" TEXT NOT NULL,
  "status" "DiscoveryScanStatus" NOT NULL DEFAULT 'requested',
  "query" TEXT NOT NULL,
  "request_json" JSONB,
  "result_json" JSONB,
  "raw_target_count" INTEGER NOT NULL DEFAULT 0,
  "normalized_target_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discovery_provider_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_provider_runs_discovery_scan_id_idx"
ON "discovery_provider_runs"("discovery_scan_id");

CREATE INDEX "discovery_provider_runs_provider_key_idx"
ON "discovery_provider_runs"("provider_key");

CREATE INDEX "discovery_provider_runs_status_idx"
ON "discovery_provider_runs"("status");

CREATE INDEX "discovery_provider_runs_discovery_scan_id_provider_key_idx"
ON "discovery_provider_runs"("discovery_scan_id", "provider_key");

CREATE INDEX "discovery_provider_runs_provider_key_status_created_at_idx"
ON "discovery_provider_runs"("provider_key", "status", "created_at");

ALTER TABLE "discovery_provider_runs"
ADD CONSTRAINT "discovery_provider_runs_discovery_scan_id_fkey"
FOREIGN KEY ("discovery_scan_id") REFERENCES "discovery_scans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
