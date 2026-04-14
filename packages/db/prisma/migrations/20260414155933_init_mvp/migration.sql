-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "FeatureAccessLevel" AS ENUM ('disabled', 'enabled', 'limited', 'premium');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('new', 'targeted', 'outreach_sent', 'applied', 'conversation_started', 'interviewing', 'awaiting_decision', 'closed_won', 'closed_lost');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('linkedin_message', 'email', 'call', 'interview', 'application_submitted', 'meeting', 'follow_up', 'note_event', 'other');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'done', 'canceled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('employer', 'prospect', 'recruiter_agency', 'startup', 'consulting_target', 'other');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('job', 'contract', 'consulting', 'networking', 'other');

-- CreateEnum
CREATE TYPE "DiscoveredOpportunityStatus" AS ENUM ('new', 'reviewed', 'shortlisted', 'promoted', 'dismissed', 'watchlisted');

-- CreateEnum
CREATE TYPE "SearchProfileType" AS ENUM ('jobs', 'companies', 'people', 'mixed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "timezone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "annualPriceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "featureKey" TEXT NOT NULL,
    "accessLevel" "FeatureAccessLevel" NOT NULL,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "provider" TEXT,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL,
    "billingInterval" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "featureKey" TEXT NOT NULL,
    "usagePeriodStart" DATE NOT NULL,
    "usagePeriodEnd" DATE NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_access_policies" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "featureKey" TEXT NOT NULL,
    "modelTier" TEXT NOT NULL,
    "maxTokensPerRequest" INTEGER,
    "maxRequestsPerPeriod" INTEGER,
    "fallbackModelTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "industry" TEXT,
    "sizeBand" TEXT,
    "geography" TEXT,
    "companyType" "CompanyType" NOT NULL DEFAULT 'prospect',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "location" TEXT,
    "contactSource" TEXT,
    "relationshipStrength" INTEGER,
    "notesSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "primaryPersonId" UUID,
    "title" TEXT NOT NULL,
    "opportunityType" "OpportunityType" NOT NULL DEFAULT 'job',
    "stage" "OpportunityStage" NOT NULL DEFAULT 'new',
    "status" TEXT,
    "source" TEXT,
    "priority" TEXT,
    "fitScore" INTEGER,
    "qualificationScore" INTEGER,
    "summary" TEXT,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "estimatedValueCents" INTEGER,
    "closeProbability" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_people" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "roleInOpportunity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opportunityId" UUID,
    "companyId" UUID,
    "personId" UUID,
    "activityType" "ActivityType" NOT NULL,
    "channel" TEXT,
    "direction" TEXT,
    "subject" TEXT,
    "bodySummary" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opportunityId" UUID,
    "companyId" UUID,
    "personId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "taskType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "linkedEntityType" TEXT NOT NULL,
    "linkedEntityId" UUID NOT NULL,
    "noteType" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_tags" (
    "id" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "searchProfileType" "SearchProfileType" NOT NULL DEFAULT 'mixed',
    "queryText" TEXT,
    "filtersJson" JSONB,
    "cadence" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_runs" (
    "id" UUID NOT NULL,
    "searchProfileId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "highPriorityCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_opportunities" (
    "id" UUID NOT NULL,
    "searchRunId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rawExternalId" TEXT,
    "title" TEXT NOT NULL,
    "companyNameRaw" TEXT,
    "companyId" UUID,
    "descriptionRaw" TEXT,
    "location" TEXT,
    "employmentType" TEXT,
    "remoteType" TEXT,
    "postedAt" TIMESTAMP(3),
    "fitScore" INTEGER,
    "priorityScore" INTEGER,
    "aiSummary" TEXT,
    "suggestedAction" TEXT,
    "suggestedPositioningProfile" TEXT,
    "lifecycleStatus" "DiscoveredOpportunityStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovered_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plan_features_featureKey_idx" ON "plan_features"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_planId_featureKey_key" ON "plan_features"("planId", "featureKey");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_key" ON "subscriptions"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "usage_counters_userId_idx" ON "usage_counters"("userId");

-- CreateIndex
CREATE INDEX "usage_counters_featureKey_idx" ON "usage_counters"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_userId_featureKey_usagePeriodStart_usagePeri_key" ON "usage_counters"("userId", "featureKey", "usagePeriodStart", "usagePeriodEnd");

-- CreateIndex
CREATE INDEX "model_access_policies_featureKey_idx" ON "model_access_policies"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "model_access_policies_planId_featureKey_key" ON "model_access_policies"("planId", "featureKey");

-- CreateIndex
CREATE INDEX "companies_userId_idx" ON "companies"("userId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_companyType_idx" ON "companies"("companyType");

-- CreateIndex
CREATE INDEX "companies_userId_companyType_idx" ON "companies"("userId", "companyType");

-- CreateIndex
CREATE INDEX "people_userId_idx" ON "people"("userId");

-- CreateIndex
CREATE INDEX "people_companyId_idx" ON "people"("companyId");

-- CreateIndex
CREATE INDEX "people_fullName_idx" ON "people"("fullName");

-- CreateIndex
CREATE INDEX "people_email_idx" ON "people"("email");

-- CreateIndex
CREATE INDEX "people_userId_companyId_idx" ON "people"("userId", "companyId");

-- CreateIndex
CREATE INDEX "opportunities_userId_idx" ON "opportunities"("userId");

-- CreateIndex
CREATE INDEX "opportunities_companyId_idx" ON "opportunities"("companyId");

-- CreateIndex
CREATE INDEX "opportunities_primaryPersonId_idx" ON "opportunities"("primaryPersonId");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_opportunityType_idx" ON "opportunities"("opportunityType");

-- CreateIndex
CREATE INDEX "opportunities_nextActionDate_idx" ON "opportunities"("nextActionDate");

-- CreateIndex
CREATE INDEX "opportunities_userId_stage_idx" ON "opportunities"("userId", "stage");

-- CreateIndex
CREATE INDEX "opportunities_userId_companyId_idx" ON "opportunities"("userId", "companyId");

-- CreateIndex
CREATE INDEX "opportunity_people_opportunityId_idx" ON "opportunity_people"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_people_personId_idx" ON "opportunity_people"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_people_opportunityId_personId_roleInOpportunity_key" ON "opportunity_people"("opportunityId", "personId", "roleInOpportunity");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "activities_opportunityId_idx" ON "activities"("opportunityId");

-- CreateIndex
CREATE INDEX "activities_companyId_idx" ON "activities"("companyId");

-- CreateIndex
CREATE INDEX "activities_personId_idx" ON "activities"("personId");

-- CreateIndex
CREATE INDEX "activities_occurredAt_idx" ON "activities"("occurredAt");

-- CreateIndex
CREATE INDEX "activities_activityType_idx" ON "activities"("activityType");

-- CreateIndex
CREATE INDEX "activities_userId_occurredAt_idx" ON "activities"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_opportunityId_idx" ON "tasks"("opportunityId");

-- CreateIndex
CREATE INDEX "tasks_personId_idx" ON "tasks"("personId");

-- CreateIndex
CREATE INDEX "tasks_dueAt_idx" ON "tasks"("dueAt");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_userId_status_dueAt_idx" ON "tasks"("userId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "notes_userId_idx" ON "notes"("userId");

-- CreateIndex
CREATE INDEX "notes_linkedEntityType_linkedEntityId_idx" ON "notes"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "notes_createdAt_idx" ON "notes"("createdAt");

-- CreateIndex
CREATE INDEX "tags_userId_idx" ON "tags"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags"("userId", "name");

-- CreateIndex
CREATE INDEX "entity_tags_entityType_entityId_idx" ON "entity_tags"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "entity_tags_tagId_idx" ON "entity_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "entity_tags_tagId_entityType_entityId_key" ON "entity_tags"("tagId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "search_profiles_userId_idx" ON "search_profiles"("userId");

-- CreateIndex
CREATE INDEX "search_profiles_isActive_idx" ON "search_profiles"("isActive");

-- CreateIndex
CREATE INDEX "search_profiles_userId_isActive_idx" ON "search_profiles"("userId", "isActive");

-- CreateIndex
CREATE INDEX "search_runs_searchProfileId_idx" ON "search_runs"("searchProfileId");

-- CreateIndex
CREATE INDEX "search_runs_startedAt_idx" ON "search_runs"("startedAt");

-- CreateIndex
CREATE INDEX "search_runs_status_idx" ON "search_runs"("status");

-- CreateIndex
CREATE INDEX "discovered_opportunities_searchRunId_idx" ON "discovered_opportunities"("searchRunId");

-- CreateIndex
CREATE INDEX "discovered_opportunities_companyId_idx" ON "discovered_opportunities"("companyId");

-- CreateIndex
CREATE INDEX "discovered_opportunities_lifecycleStatus_idx" ON "discovered_opportunities"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "discovered_opportunities_postedAt_idx" ON "discovered_opportunities"("postedAt");

-- CreateIndex
CREATE INDEX "discovered_opportunities_fitScore_idx" ON "discovered_opportunities"("fitScore");

-- CreateIndex
CREATE INDEX "discovered_opportunities_searchRunId_lifecycleStatus_idx" ON "discovered_opportunities"("searchRunId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "discovered_opportunities_rawExternalId_idx" ON "discovered_opportunities"("rawExternalId");

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_access_policies" ADD CONSTRAINT "model_access_policies_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_primaryPersonId_fkey" FOREIGN KEY ("primaryPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_people" ADD CONSTRAINT "opportunity_people_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_people" ADD CONSTRAINT "opportunity_people_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_profiles" ADD CONSTRAINT "search_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_opportunities" ADD CONSTRAINT "discovered_opportunities_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_opportunities" ADD CONSTRAINT "discovered_opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
