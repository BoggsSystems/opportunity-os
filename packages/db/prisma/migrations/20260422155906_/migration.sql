-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "FeatureAccessLevel" AS ENUM ('disabled', 'enabled', 'limited', 'premium');

-- CreateEnum
CREATE TYPE "AuthenticationCredentialType" AS ENUM ('password', 'google_oauth', 'apple_sign_in', 'passkey');

-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('email_verify', 'password_reset', 'magic_link');

-- CreateEnum
CREATE TYPE "AuthenticationSessionStatus" AS ENUM ('active', 'revoked', 'expired');

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

-- CreateEnum
CREATE TYPE "OfferingType" AS ENUM ('product', 'service', 'consulting', 'job_profile', 'other');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "OfferingAssetType" AS ENUM ('portfolio', 'case_study', 'testimonial', 'document', 'image', 'video', 'other');

-- CreateEnum
CREATE TYPE "OfferingPositioningStatus" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "AIConversationPurpose" AS ENUM ('onboarding', 'offering_strategy', 'opportunity_analysis', 'general', 'other');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('resume', 'executive_brief', 'portfolio', 'book', 'presentation', 'other');

-- CreateEnum
CREATE TYPE "AssetInteractionType" AS ENUM ('uploaded', 'analyzed', 'suggested', 'attached', 'sent');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AIConversationStatus" AS ENUM ('active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "AIConversationMessageType" AS ENUM ('user', 'assistant', 'system', 'function_call', 'function_result');

-- CreateEnum
CREATE TYPE "AIContextSummaryType" AS ENUM ('offering_summary', 'opportunity_insight', 'user_preference', 'conversation_highlights', 'entity_overview', 'other');

-- CreateEnum
CREATE TYPE "AIContextSummarySourceType" AS ENUM ('ai_conversation', 'offering', 'opportunity', 'user', 'other');

-- CreateEnum
CREATE TYPE "AITaskType" AS ENUM ('offering_analysis', 'opportunity_analysis', 'content_generation', 'other');

-- CreateEnum
CREATE TYPE "AITaskStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "OpportunityCyclePhase" AS ENUM ('surfaced', 'interpreted', 'proposed', 'drafting', 'awaiting_confirmation', 'executed', 'confirmed', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "OpportunityCycleStatus" AS ENUM ('active', 'paused', 'completed', 'dismissed', 'archived');

-- CreateEnum
CREATE TYPE "WorkspaceMode" AS ENUM ('empty', 'signal_review', 'goal_planning', 'campaign_review', 'opportunity_review', 'draft_edit', 'asset_review', 'execution_confirm', 'progress_summary');

-- CreateEnum
CREATE TYPE "WorkspaceSignalStatus" AS ENUM ('new', 'surfaced', 'active', 'consumed', 'dismissed', 'archived');

-- CreateEnum
CREATE TYPE "WorkspaceSignalImportance" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "WorkspaceCommandStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CapabilityType" AS ENUM ('email', 'calendar', 'messaging', 'calling', 'contacts', 'storage', 'discovery');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('connected', 'disconnected', 'error', 'expired', 'syncing', 'pending_setup');

-- CreateEnum
CREATE TYPE "CapabilityExecutionStatus" AS ENUM ('succeeded', 'failed', 'retrying', 'cancelled', 'rate_limited', 'provider_error');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "timezone" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentication_identities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "identityType" TEXT NOT NULL DEFAULT 'email',
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "lastAuthenticatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authentication_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "authenticationIdentityId" UUID NOT NULL,
    "credentialType" "AuthenticationCredentialType" NOT NULL,
    "passwordHash" TEXT,
    "providerName" TEXT,
    "providerAccountId" TEXT,
    "passwordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentication_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "authenticationIdentityId" UUID,
    "status" "AuthenticationSessionStatus" NOT NULL DEFAULT 'active',
    "clientType" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "ipAddress" INET,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authentication_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "authenticationIdentityId" UUID,
    "tokenType" "VerificationTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
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
    "campaignId" UUID,

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

-- CreateTable
CREATE TABLE "offerings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "offeringType" "OfferingType" NOT NULL,
    "status" "OfferingStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_positionings" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OfferingPositioningStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_positionings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_assets" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "offeringPositioningId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetType" "OfferingAssetType" NOT NULL,
    "contentUrl" TEXT,
    "contentText" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" "OfferingStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" VARCHAR(255),
    "title" TEXT NOT NULL,
    "purpose" "AIConversationPurpose" NOT NULL DEFAULT 'general',
    "offeringId" UUID,
    "opportunityId" UUID,
    "status" "AIConversationStatus" NOT NULL DEFAULT 'active',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageType" "AIConversationMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_context_summaries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summaryType" "AIContextSummaryType" NOT NULL,
    "content" TEXT NOT NULL,
    "sourceType" "AIContextSummarySourceType" NOT NULL,
    "sourceId" TEXT,
    "aiConversationId" UUID,
    "offeringId" UUID,
    "opportunityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_context_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskType" "AITaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "aiConversationId" UUID,
    "offeringId" UUID,
    "opportunityId" UUID,
    "inputDataJson" JSONB,
    "outputDataJson" JSONB,
    "status" "AITaskStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_assets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "category" "AssetCategory" NOT NULL DEFAULT 'other',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_narratives" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "valueProposition" TEXT,
    "targetPersona" TEXT,
    "keyProofPoints" JSONB,
    "aiToneDNA" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_deployment_rules" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "conditionsJson" JSONB,
    "recommendationStrength" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_deployment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_interactions" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "opportunityId" UUID,
    "personId" UUID,
    "interactionType" "AssetInteractionType" NOT NULL,
    "context" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" UUID,

    CONSTRAINT "asset_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" VARCHAR(255),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_campaigns" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestSessionId" VARCHAR(255),
    "goalId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "strategicAngle" TEXT,
    "targetSegment" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategic_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_assets" (
    "campaignId" UUID NOT NULL,
    "assetId" UUID NOT NULL,

    CONSTRAINT "campaign_assets_pkey" PRIMARY KEY ("campaignId","assetId")
);

-- CreateTable
CREATE TABLE "workspace_signals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "importance" "WorkspaceSignalImportance" NOT NULL DEFAULT 'medium',
    "status" "WorkspaceSignalStatus" NOT NULL DEFAULT 'new',
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "reason" TEXT,
    "recommendedAction" TEXT,
    "recommendedWorkspaceMode" "WorkspaceMode" NOT NULL DEFAULT 'signal_review',
    "evidenceJson" JSONB,
    "metadataJson" JSONB,
    "surfacedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_cycles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workspaceSignalId" UUID,
    "goalId" UUID,
    "strategicCampaignId" UUID,
    "opportunityId" UUID,
    "taskId" UUID,
    "discoveredOpportunityId" UUID,
    "aiConversationId" UUID,
    "phase" "OpportunityCyclePhase" NOT NULL DEFAULT 'surfaced',
    "status" "OpportunityCycleStatus" NOT NULL DEFAULT 'active',
    "workspaceMode" "WorkspaceMode" NOT NULL DEFAULT 'signal_review',
    "title" TEXT NOT NULL,
    "whyItMatters" TEXT,
    "recommendedAction" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "confidence" INTEGER,
    "allowedActionsJson" JSONB,
    "stateJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAdvancedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_commands" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opportunityCycleId" UUID,
    "aiConversationId" UUID,
    "commandType" TEXT NOT NULL,
    "status" "WorkspaceCommandStatus" NOT NULL DEFAULT 'pending',
    "inputJson" JSONB,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capabilities" (
    "id" UUID NOT NULL,
    "capabilityType" "CapabilityType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supportedFeaturesJson" JSONB,
    "defaultConfigJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_providers" (
    "id" UUID NOT NULL,
    "capabilityId" UUID NOT NULL,
    "providerName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authType" TEXT NOT NULL,
    "requiredScopesJson" JSONB,
    "rateLimitConfigJson" JSONB,
    "providerConfigSchemaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capability_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_connectors" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "capabilityId" UUID NOT NULL,
    "capabilityProviderId" UUID NOT NULL,
    "connectorName" TEXT,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'pending_setup',
    "enabledFeaturesJson" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_credentials" (
    "id" UUID NOT NULL,
    "userConnectorId" UUID NOT NULL,
    "credentialType" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "refreshStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_sync_states" (
    "id" UUID NOT NULL,
    "userConnectorId" UUID NOT NULL,
    "syncType" TEXT NOT NULL,
    "providerCursor" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL,
    "itemsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorDetailsJson" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_execution_logs" (
    "id" UUID NOT NULL,
    "userConnectorId" UUID NOT NULL,
    "workspaceCommandId" UUID,
    "executionType" TEXT NOT NULL,
    "executionStatus" "CapabilityExecutionStatus" NOT NULL,
    "inputPayloadJson" JSONB,
    "outputPayloadJson" JSONB,
    "errorDetailsJson" JSONB,
    "durationMs" INTEGER,
    "providerResponseCode" TEXT,
    "providerRequestId" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" UUID,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_configurations" (
    "id" UUID NOT NULL,
    "capabilityProviderId" UUID NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValue" JSONB NOT NULL,
    "configType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isUserConfigurable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "validationRulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "authentication_identities_emailNormalized_key" ON "authentication_identities"("emailNormalized");

-- CreateIndex
CREATE INDEX "authentication_identities_userId_idx" ON "authentication_identities"("userId");

-- CreateIndex
CREATE INDEX "credentials_authenticationIdentityId_idx" ON "credentials"("authenticationIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_providerName_providerAccountId_key" ON "credentials"("providerName", "providerAccountId");

-- CreateIndex
CREATE INDEX "authentication_sessions_userId_idx" ON "authentication_sessions"("userId");

-- CreateIndex
CREATE INDEX "authentication_sessions_authenticationIdentityId_idx" ON "authentication_sessions"("authenticationIdentityId");

-- CreateIndex
CREATE INDEX "authentication_sessions_userId_status_idx" ON "authentication_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "authentication_sessions_expiresAt_idx" ON "authentication_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_idx" ON "verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "verification_tokens_authenticationIdentityId_idx" ON "verification_tokens"("authenticationIdentityId");

-- CreateIndex
CREATE INDEX "verification_tokens_tokenType_idx" ON "verification_tokens"("tokenType");

-- CreateIndex
CREATE INDEX "verification_tokens_expiresAt_idx" ON "verification_tokens"("expiresAt");

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

-- CreateIndex
CREATE INDEX "offerings_userId_idx" ON "offerings"("userId");

-- CreateIndex
CREATE INDEX "offerings_offeringType_status_idx" ON "offerings"("offeringType", "status");

-- CreateIndex
CREATE INDEX "offerings_createdAt_idx" ON "offerings"("createdAt");

-- CreateIndex
CREATE INDEX "offering_positionings_offeringId_idx" ON "offering_positionings"("offeringId");

-- CreateIndex
CREATE INDEX "offering_positionings_status_idx" ON "offering_positionings"("status");

-- CreateIndex
CREATE INDEX "offering_assets_offeringId_idx" ON "offering_assets"("offeringId");

-- CreateIndex
CREATE INDEX "offering_assets_offeringPositioningId_idx" ON "offering_assets"("offeringPositioningId");

-- CreateIndex
CREATE INDEX "offering_assets_assetType_idx" ON "offering_assets"("assetType");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_guestSessionId_idx" ON "ai_conversations"("guestSessionId");

-- CreateIndex
CREATE INDEX "ai_conversations_offeringId_idx" ON "ai_conversations"("offeringId");

-- CreateIndex
CREATE INDEX "ai_conversations_opportunityId_idx" ON "ai_conversations"("opportunityId");

-- CreateIndex
CREATE INDEX "ai_conversations_status_updatedAt_idx" ON "ai_conversations"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_conversations_lastMessageAt_idx" ON "ai_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_conversationId_idx" ON "ai_conversation_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_createdAt_idx" ON "ai_conversation_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ai_context_summaries_userId_idx" ON "ai_context_summaries"("userId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_sourceType_sourceId_idx" ON "ai_context_summaries"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_aiConversationId_idx" ON "ai_context_summaries"("aiConversationId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_offeringId_idx" ON "ai_context_summaries"("offeringId");

-- CreateIndex
CREATE INDEX "ai_context_summaries_opportunityId_idx" ON "ai_context_summaries"("opportunityId");

-- CreateIndex
CREATE INDEX "ai_tasks_userId_idx" ON "ai_tasks"("userId");

-- CreateIndex
CREATE INDEX "ai_tasks_taskType_status_idx" ON "ai_tasks"("taskType", "status");

-- CreateIndex
CREATE INDEX "ai_tasks_aiConversationId_idx" ON "ai_tasks"("aiConversationId");

-- CreateIndex
CREATE INDEX "ai_tasks_offeringId_idx" ON "ai_tasks"("offeringId");

-- CreateIndex
CREATE INDEX "ai_tasks_opportunityId_idx" ON "ai_tasks"("opportunityId");

-- CreateIndex
CREATE INDEX "ai_tasks_completedAt_idx" ON "ai_tasks"("completedAt");

-- CreateIndex
CREATE INDEX "user_assets_userId_idx" ON "user_assets"("userId");

-- CreateIndex
CREATE INDEX "user_assets_category_idx" ON "user_assets"("category");

-- CreateIndex
CREATE UNIQUE INDEX "asset_narratives_assetId_key" ON "asset_narratives"("assetId");

-- CreateIndex
CREATE INDEX "asset_deployment_rules_assetId_idx" ON "asset_deployment_rules"("assetId");

-- CreateIndex
CREATE INDEX "asset_interactions_assetId_idx" ON "asset_interactions"("assetId");

-- CreateIndex
CREATE INDEX "asset_interactions_opportunityId_idx" ON "asset_interactions"("opportunityId");

-- CreateIndex
CREATE INDEX "asset_interactions_personId_idx" ON "asset_interactions"("personId");

-- CreateIndex
CREATE INDEX "goals_userId_idx" ON "goals"("userId");

-- CreateIndex
CREATE INDEX "goals_guestSessionId_idx" ON "goals"("guestSessionId");

-- CreateIndex
CREATE INDEX "strategic_campaigns_userId_idx" ON "strategic_campaigns"("userId");

-- CreateIndex
CREATE INDEX "strategic_campaigns_goalId_idx" ON "strategic_campaigns"("goalId");

-- CreateIndex
CREATE INDEX "strategic_campaigns_guestSessionId_idx" ON "strategic_campaigns"("guestSessionId");

-- CreateIndex
CREATE INDEX "workspace_signals_userId_idx" ON "workspace_signals"("userId");

-- CreateIndex
CREATE INDEX "workspace_signals_sourceType_sourceId_idx" ON "workspace_signals"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "workspace_signals_status_idx" ON "workspace_signals"("status");

-- CreateIndex
CREATE INDEX "workspace_signals_importance_idx" ON "workspace_signals"("importance");

-- CreateIndex
CREATE INDEX "workspace_signals_priorityScore_idx" ON "workspace_signals"("priorityScore");

-- CreateIndex
CREATE INDEX "workspace_signals_userId_status_priorityScore_idx" ON "workspace_signals"("userId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "opportunity_cycles_userId_idx" ON "opportunity_cycles"("userId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_workspaceSignalId_idx" ON "opportunity_cycles"("workspaceSignalId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_goalId_idx" ON "opportunity_cycles"("goalId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_strategicCampaignId_idx" ON "opportunity_cycles"("strategicCampaignId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_opportunityId_idx" ON "opportunity_cycles"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_taskId_idx" ON "opportunity_cycles"("taskId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_discoveredOpportunityId_idx" ON "opportunity_cycles"("discoveredOpportunityId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_aiConversationId_idx" ON "opportunity_cycles"("aiConversationId");

-- CreateIndex
CREATE INDEX "opportunity_cycles_phase_idx" ON "opportunity_cycles"("phase");

-- CreateIndex
CREATE INDEX "opportunity_cycles_status_idx" ON "opportunity_cycles"("status");

-- CreateIndex
CREATE INDEX "opportunity_cycles_userId_status_priorityScore_idx" ON "opportunity_cycles"("userId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "opportunity_cycles_userId_status_updatedAt_idx" ON "opportunity_cycles"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "workspace_commands_userId_idx" ON "workspace_commands"("userId");

-- CreateIndex
CREATE INDEX "workspace_commands_opportunityCycleId_idx" ON "workspace_commands"("opportunityCycleId");

-- CreateIndex
CREATE INDEX "workspace_commands_aiConversationId_idx" ON "workspace_commands"("aiConversationId");

-- CreateIndex
CREATE INDEX "workspace_commands_commandType_idx" ON "workspace_commands"("commandType");

-- CreateIndex
CREATE INDEX "workspace_commands_status_idx" ON "workspace_commands"("status");

-- CreateIndex
CREATE INDEX "workspace_commands_createdAt_idx" ON "workspace_commands"("createdAt");

-- CreateIndex
CREATE INDEX "workspace_commands_userId_status_createdAt_idx" ON "workspace_commands"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "capabilities_capabilityType_key" ON "capabilities"("capabilityType");

-- CreateIndex
CREATE INDEX "capability_providers_providerName_idx" ON "capability_providers"("providerName");

-- CreateIndex
CREATE INDEX "capability_providers_isActive_idx" ON "capability_providers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "capability_providers_capabilityId_providerName_key" ON "capability_providers"("capabilityId", "providerName");

-- CreateIndex
CREATE INDEX "user_connectors_userId_idx" ON "user_connectors"("userId");

-- CreateIndex
CREATE INDEX "user_connectors_capabilityProviderId_idx" ON "user_connectors"("capabilityProviderId");

-- CreateIndex
CREATE INDEX "user_connectors_status_idx" ON "user_connectors"("status");

-- CreateIndex
CREATE INDEX "user_connectors_userId_status_idx" ON "user_connectors"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_connectors_userId_capabilityId_key" ON "user_connectors"("userId", "capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "connector_credentials_userConnectorId_key" ON "connector_credentials"("userConnectorId");

-- CreateIndex
CREATE INDEX "connector_credentials_expiresAt_idx" ON "connector_credentials"("expiresAt");

-- CreateIndex
CREATE INDEX "connector_sync_states_syncStatus_idx" ON "connector_sync_states"("syncStatus");

-- CreateIndex
CREATE INDEX "connector_sync_states_nextRetryAt_idx" ON "connector_sync_states"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "connector_sync_states_userConnectorId_syncType_key" ON "connector_sync_states"("userConnectorId", "syncType");

-- CreateIndex
CREATE INDEX "capability_execution_logs_userConnectorId_idx" ON "capability_execution_logs"("userConnectorId");

-- CreateIndex
CREATE INDEX "capability_execution_logs_workspaceCommandId_idx" ON "capability_execution_logs"("workspaceCommandId");

-- CreateIndex
CREATE INDEX "capability_execution_logs_executionStatus_idx" ON "capability_execution_logs"("executionStatus");

-- CreateIndex
CREATE INDEX "capability_execution_logs_executedAt_idx" ON "capability_execution_logs"("executedAt");

-- CreateIndex
CREATE INDEX "capability_execution_logs_userConnectorId_executedAt_idx" ON "capability_execution_logs"("userConnectorId", "executedAt");

-- CreateIndex
CREATE INDEX "capability_execution_logs_linkedEntityType_linkedEntityId_idx" ON "capability_execution_logs"("linkedEntityType", "linkedEntityId");

-- CreateIndex
CREATE INDEX "connector_configurations_configType_idx" ON "connector_configurations"("configType");

-- CreateIndex
CREATE INDEX "connector_configurations_isRequired_idx" ON "connector_configurations"("isRequired");

-- CreateIndex
CREATE UNIQUE INDEX "connector_configurations_capabilityProviderId_configKey_key" ON "connector_configurations"("capabilityProviderId", "configKey");

-- AddForeignKey
ALTER TABLE "authentication_identities" ADD CONSTRAINT "authentication_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_authenticationIdentityId_fkey" FOREIGN KEY ("authenticationIdentityId") REFERENCES "authentication_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_sessions" ADD CONSTRAINT "authentication_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_sessions" ADD CONSTRAINT "authentication_sessions_authenticationIdentityId_fkey" FOREIGN KEY ("authenticationIdentityId") REFERENCES "authentication_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_authenticationIdentityId_fkey" FOREIGN KEY ("authenticationIdentityId") REFERENCES "authentication_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "strategic_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_positionings" ADD CONSTRAINT "offering_positionings_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_assets" ADD CONSTRAINT "offering_assets_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_assets" ADD CONSTRAINT "offering_assets_offeringPositioningId_fkey" FOREIGN KEY ("offeringPositioningId") REFERENCES "offering_positionings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_context_summaries" ADD CONSTRAINT "ai_context_summaries_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tasks" ADD CONSTRAINT "ai_tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_assets" ADD CONSTRAINT "user_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_narratives" ADD CONSTRAINT "asset_narratives_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "user_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_deployment_rules" ADD CONSTRAINT "asset_deployment_rules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "user_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_interactions" ADD CONSTRAINT "asset_interactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "user_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_interactions" ADD CONSTRAINT "asset_interactions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_interactions" ADD CONSTRAINT "asset_interactions_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_interactions" ADD CONSTRAINT "asset_interactions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "strategic_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategic_campaigns" ADD CONSTRAINT "strategic_campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategic_campaigns" ADD CONSTRAINT "strategic_campaigns_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_assets" ADD CONSTRAINT "campaign_assets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "strategic_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_assets" ADD CONSTRAINT "campaign_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "user_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_signals" ADD CONSTRAINT "workspace_signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_workspaceSignalId_fkey" FOREIGN KEY ("workspaceSignalId") REFERENCES "workspace_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_strategicCampaignId_fkey" FOREIGN KEY ("strategicCampaignId") REFERENCES "strategic_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_discoveredOpportunityId_fkey" FOREIGN KEY ("discoveredOpportunityId") REFERENCES "discovered_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_cycles" ADD CONSTRAINT "opportunity_cycles_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_commands" ADD CONSTRAINT "workspace_commands_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_commands" ADD CONSTRAINT "workspace_commands_opportunityCycleId_fkey" FOREIGN KEY ("opportunityCycleId") REFERENCES "opportunity_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_commands" ADD CONSTRAINT "workspace_commands_aiConversationId_fkey" FOREIGN KEY ("aiConversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_providers" ADD CONSTRAINT "capability_providers_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_connectors" ADD CONSTRAINT "user_connectors_capabilityProviderId_fkey" FOREIGN KEY ("capabilityProviderId") REFERENCES "capability_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_credentials" ADD CONSTRAINT "connector_credentials_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_sync_states" ADD CONSTRAINT "connector_sync_states_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_execution_logs" ADD CONSTRAINT "capability_execution_logs_userConnectorId_fkey" FOREIGN KEY ("userConnectorId") REFERENCES "user_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_execution_logs" ADD CONSTRAINT "capability_execution_logs_workspaceCommandId_fkey" FOREIGN KEY ("workspaceCommandId") REFERENCES "workspace_commands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_configurations" ADD CONSTRAINT "connector_configurations_capabilityProviderId_fkey" FOREIGN KEY ("capabilityProviderId") REFERENCES "capability_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
