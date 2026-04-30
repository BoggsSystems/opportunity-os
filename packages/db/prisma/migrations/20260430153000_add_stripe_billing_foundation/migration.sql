ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'unpaid';

CREATE TYPE "BillingCustomerStatus" AS ENUM (
  'active',
  'archived'
);

CREATE TYPE "BillingEventStatus" AS ENUM (
  'received',
  'processed',
  'failed',
  'ignored'
);

CREATE TYPE "EntitlementOverrideStatus" AS ENUM (
  'active',
  'expired',
  'revoked'
);

ALTER TABLE "plans"
  ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeMonthlyPriceId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeAnnualPriceId" TEXT,
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;

CREATE TABLE "billing_customers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerCustomerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "BillingCustomerStatus" NOT NULL DEFAULT 'active',
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "billingCustomerId" UUID,
  ADD COLUMN IF NOT EXISTS "providerPriceId" TEXT,
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;

CREATE TABLE "billing_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "BillingEventStatus" NOT NULL DEFAULT 'received',
  "payloadJson" JSONB NOT NULL,
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "featureKey" TEXT NOT NULL,
  "metricCode" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT,
  "sourceType" TEXT,
  "sourceId" UUID,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "windowStart" DATE NOT NULL,
  "windowEnd" DATE NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entitlement_overrides" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "featureKey" TEXT NOT NULL,
  "accessLevel" "FeatureAccessLevel",
  "configJson" JSONB,
  "reason" TEXT,
  "status" "EntitlementOverrideStatus" NOT NULL DEFAULT 'active',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entitlement_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_customers_provider_providerCustomerId_key" ON "billing_customers"("provider", "providerCustomerId");
CREATE INDEX "billing_customers_userId_idx" ON "billing_customers"("userId");
CREATE INDEX "billing_customers_providerCustomerId_idx" ON "billing_customers"("providerCustomerId");
CREATE INDEX "billing_customers_status_idx" ON "billing_customers"("status");

CREATE INDEX "subscriptions_billingCustomerId_idx" ON "subscriptions"("billingCustomerId");
CREATE INDEX "subscriptions_providerCustomerId_idx" ON "subscriptions"("providerCustomerId");
CREATE INDEX "subscriptions_providerPriceId_idx" ON "subscriptions"("providerPriceId");

CREATE UNIQUE INDEX "billing_events_provider_providerEventId_key" ON "billing_events"("provider", "providerEventId");
CREATE INDEX "billing_events_userId_idx" ON "billing_events"("userId");
CREATE INDEX "billing_events_eventType_idx" ON "billing_events"("eventType");
CREATE INDEX "billing_events_status_idx" ON "billing_events"("status");
CREATE INDEX "billing_events_processedAt_idx" ON "billing_events"("processedAt");

CREATE UNIQUE INDEX "usage_records_idempotencyKey_key" ON "usage_records"("idempotencyKey");
CREATE INDEX "usage_records_userId_idx" ON "usage_records"("userId");
CREATE INDEX "usage_records_featureKey_idx" ON "usage_records"("featureKey");
CREATE INDEX "usage_records_metricCode_idx" ON "usage_records"("metricCode");
CREATE INDEX "usage_records_sourceType_sourceId_idx" ON "usage_records"("sourceType", "sourceId");
CREATE INDEX "usage_records_occurredAt_idx" ON "usage_records"("occurredAt");
CREATE INDEX "usage_records_userId_featureKey_windowStart_windowEnd_idx" ON "usage_records"("userId", "featureKey", "windowStart", "windowEnd");

CREATE INDEX "entitlement_overrides_userId_idx" ON "entitlement_overrides"("userId");
CREATE INDEX "entitlement_overrides_featureKey_idx" ON "entitlement_overrides"("featureKey");
CREATE INDEX "entitlement_overrides_status_idx" ON "entitlement_overrides"("status");
CREATE INDEX "entitlement_overrides_expiresAt_idx" ON "entitlement_overrides"("expiresAt");

ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billingCustomerId_fkey" FOREIGN KEY ("billingCustomerId") REFERENCES "billing_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
