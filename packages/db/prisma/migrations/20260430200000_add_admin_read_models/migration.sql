CREATE TYPE "UserLifecycleStage" AS ENUM (
  'visitor',
  'account_created',
  'onboarding_started',
  'profile_grounded',
  'offering_selected',
  'campaign_generated',
  'action_lanes_selected',
  'connector_ready',
  'first_action_primed',
  'first_action_completed',
  'activated',
  'retained',
  'paid',
  'stalled',
  'dormant'
);

CREATE TYPE "AdminOperationalIssueSeverity" AS ENUM (
  'info',
  'warning',
  'error',
  'critical'
);

CREATE TYPE "AdminOperationalIssueStatus" AS ENUM (
  'open',
  'investigating',
  'resolved',
  'ignored'
);

CREATE TYPE "AdminOperationalIssueSource" AS ENUM (
  'onboarding',
  'connector',
  'billing',
  'referral',
  'campaign',
  'action_cycle',
  'action_item',
  'ai',
  'webhook',
  'background_job',
  'system'
);

CREATE TYPE "AdminMetricSnapshotScope" AS ENUM (
  'overview',
  'funnel',
  'user_lifecycle',
  'campaign_actions',
  'connectors',
  'billing_referrals',
  'operations'
);

CREATE TABLE "user_lifecycle_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "stage" "UserLifecycleStage" NOT NULL,
  "eventType" VARCHAR(120) NOT NULL,
  "sourceType" VARCHAR(80),
  "sourceId" UUID,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_lifecycle_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "currentStage" "UserLifecycleStage" NOT NULL DEFAULT 'account_created',
  "furthestStage" "UserLifecycleStage" NOT NULL DEFAULT 'account_created',
  "onboardingStartedAt" TIMESTAMP(3),
  "onboardingCompletedAt" TIMESTAMP(3),
  "firstCampaignGeneratedAt" TIMESTAMP(3),
  "actionLanesSelectedAt" TIMESTAMP(3),
  "connectorReadyAt" TIMESTAMP(3),
  "firstActionPrimedAt" TIMESTAMP(3),
  "firstActionCompletedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "retainedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "stalledAt" TIMESTAMP(3),
  "dormantAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_lifecycle_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_metric_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" "AdminMetricSnapshotScope" NOT NULL,
  "metricKey" VARCHAR(120) NOT NULL,
  "metricValue" DECIMAL(18,4) NOT NULL,
  "metricUnit" VARCHAR(40),
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "dimensionsJson" JSONB,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_metric_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_operational_issues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "source" "AdminOperationalIssueSource" NOT NULL,
  "sourceId" UUID,
  "providerName" VARCHAR(80),
  "severity" "AdminOperationalIssueSeverity" NOT NULL DEFAULT 'warning',
  "status" "AdminOperationalIssueStatus" NOT NULL DEFAULT 'open',
  "title" VARCHAR(200) NOT NULL,
  "details" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_operational_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_lifecycle_snapshots_userId_key" ON "user_lifecycle_snapshots"("userId");

CREATE INDEX "user_lifecycle_events_userId_idx" ON "user_lifecycle_events"("userId");
CREATE INDEX "user_lifecycle_events_stage_idx" ON "user_lifecycle_events"("stage");
CREATE INDEX "user_lifecycle_events_eventType_idx" ON "user_lifecycle_events"("eventType");
CREATE INDEX "user_lifecycle_events_occurredAt_idx" ON "user_lifecycle_events"("occurredAt");
CREATE INDEX "user_lifecycle_events_userId_stage_occurredAt_idx" ON "user_lifecycle_events"("userId", "stage", "occurredAt");

CREATE INDEX "user_lifecycle_snapshots_currentStage_idx" ON "user_lifecycle_snapshots"("currentStage");
CREATE INDEX "user_lifecycle_snapshots_furthestStage_idx" ON "user_lifecycle_snapshots"("furthestStage");
CREATE INDEX "user_lifecycle_snapshots_activatedAt_idx" ON "user_lifecycle_snapshots"("activatedAt");
CREATE INDEX "user_lifecycle_snapshots_paidAt_idx" ON "user_lifecycle_snapshots"("paidAt");
CREATE INDEX "user_lifecycle_snapshots_lastActivityAt_idx" ON "user_lifecycle_snapshots"("lastActivityAt");

CREATE INDEX "admin_metric_snapshots_scope_idx" ON "admin_metric_snapshots"("scope");
CREATE INDEX "admin_metric_snapshots_metricKey_idx" ON "admin_metric_snapshots"("metricKey");
CREATE INDEX "admin_metric_snapshots_scope_metricKey_computedAt_idx" ON "admin_metric_snapshots"("scope", "metricKey", "computedAt");
CREATE INDEX "admin_metric_snapshots_periodStart_periodEnd_idx" ON "admin_metric_snapshots"("periodStart", "periodEnd");

CREATE INDEX "admin_operational_issues_userId_idx" ON "admin_operational_issues"("userId");
CREATE INDEX "admin_operational_issues_source_idx" ON "admin_operational_issues"("source");
CREATE INDEX "admin_operational_issues_status_idx" ON "admin_operational_issues"("status");
CREATE INDEX "admin_operational_issues_severity_idx" ON "admin_operational_issues"("severity");
CREATE INDEX "admin_operational_issues_detectedAt_idx" ON "admin_operational_issues"("detectedAt");
CREATE INDEX "admin_operational_issues_source_status_detectedAt_idx" ON "admin_operational_issues"("source", "status", "detectedAt");

ALTER TABLE "user_lifecycle_events" ADD CONSTRAINT "user_lifecycle_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_lifecycle_snapshots" ADD CONSTRAINT "user_lifecycle_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_operational_issues" ADD CONSTRAINT "admin_operational_issues_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
