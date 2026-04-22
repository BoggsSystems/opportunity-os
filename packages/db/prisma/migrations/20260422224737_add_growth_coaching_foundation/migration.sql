-- CreateEnum
CREATE TYPE "UpgradeReason" AS ENUM ('plan_does_not_include_capability', 'usage_limit_reached', 'connector_limit_reached', 'missing_required_connector', 'trial_expired', 'payment_required', 'feature_temporarily_disabled');

-- CreateEnum
CREATE TYPE "ReferralMilestoneType" AS ENUM ('signup', 'onboarding_completed', 'first_cycle_completed', 'first_outreach_sent', 'paid_conversion');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('ai_usage_credit', 'cycle_credit', 'discovery_scan_credit', 'connector_slot_credit', 'premium_trial_unlock', 'subscription_credit');

-- CreateEnum
CREATE TYPE "GrowthCreditStatus" AS ENUM ('available', 'partially_used', 'consumed', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "MomentumStateType" AS ENUM ('on_track', 'behind', 'stalled', 'recovering', 'strong_momentum');

-- CreateEnum
CREATE TYPE "CoachingNudgeType" AS ENUM ('complete_cycle', 'send_follow_up', 'review_signal', 'celebrate_progress', 'reactivate_opportunity', 'resume_onboarding');

-- CreateEnum
CREATE TYPE "CoachingNudgeStatus" AS ENUM ('pending', 'delivered', 'acted_on', 'dismissed', 'expired');

-- CreateTable
CREATE TABLE "referral_links" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "campaignSource" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_attributions" (
    "id" UUID NOT NULL,
    "referralLinkId" UUID,
    "referrerUserId" UUID NOT NULL,
    "referredUserId" UUID NOT NULL,
    "attributionSource" TEXT,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_milestones" (
    "id" UUID NOT NULL,
    "referralAttributionId" UUID NOT NULL,
    "milestoneType" "ReferralMilestoneType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceEntityType" TEXT,
    "sourceEntityId" UUID,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" UUID NOT NULL,
    "referralAttributionId" UUID NOT NULL,
    "referralMilestoneId" UUID,
    "userId" UUID NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "featureKey" TEXT,
    "quantity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'granted',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_credits" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "referralRewardId" UUID,
    "featureKey" TEXT NOT NULL,
    "creditType" "RewardType" NOT NULL,
    "quantityGranted" INTEGER NOT NULL,
    "quantityUsed" INTEGER NOT NULL DEFAULT 0,
    "status" "GrowthCreditStatus" NOT NULL DEFAULT 'available',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_progress" (
    "id" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "targetCount" INTEGER,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" INTEGER,
    "metadataJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_targets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID,
    "offeringId" UUID,
    "targetType" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "momentum_states" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID,
    "offeringId" UUID,
    "strategicCampaignId" UUID,
    "stateType" "MomentumStateType" NOT NULL,
    "score" INTEGER,
    "reason" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "momentum_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coaching_nudges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "momentumStateId" UUID,
    "nudgeType" "CoachingNudgeType" NOT NULL,
    "status" "CoachingNudgeStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" UUID,
    "scheduledFor" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "actedOnAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaching_nudges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_links_code_key" ON "referral_links"("code");

-- CreateIndex
CREATE INDEX "referral_links_userId_idx" ON "referral_links"("userId");

-- CreateIndex
CREATE INDEX "referral_links_userId_isActive_idx" ON "referral_links"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "referral_attributions_referredUserId_key" ON "referral_attributions"("referredUserId");

-- CreateIndex
CREATE INDEX "referral_attributions_referrerUserId_idx" ON "referral_attributions"("referrerUserId");

-- CreateIndex
CREATE INDEX "referral_attributions_referralLinkId_idx" ON "referral_attributions"("referralLinkId");

-- CreateIndex
CREATE INDEX "referral_milestones_milestoneType_idx" ON "referral_milestones"("milestoneType");

-- CreateIndex
CREATE INDEX "referral_milestones_occurredAt_idx" ON "referral_milestones"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "referral_milestones_referralAttributionId_milestoneType_key" ON "referral_milestones"("referralAttributionId", "milestoneType");

-- CreateIndex
CREATE INDEX "referral_rewards_userId_idx" ON "referral_rewards"("userId");

-- CreateIndex
CREATE INDEX "referral_rewards_referralAttributionId_idx" ON "referral_rewards"("referralAttributionId");

-- CreateIndex
CREATE INDEX "referral_rewards_referralMilestoneId_idx" ON "referral_rewards"("referralMilestoneId");

-- CreateIndex
CREATE INDEX "referral_rewards_userId_rewardType_idx" ON "referral_rewards"("userId", "rewardType");

-- CreateIndex
CREATE INDEX "growth_credits_userId_idx" ON "growth_credits"("userId");

-- CreateIndex
CREATE INDEX "growth_credits_featureKey_idx" ON "growth_credits"("featureKey");

-- CreateIndex
CREATE INDEX "growth_credits_userId_featureKey_status_idx" ON "growth_credits"("userId", "featureKey", "status");

-- CreateIndex
CREATE INDEX "growth_credits_expiresAt_idx" ON "growth_credits"("expiresAt");

-- CreateIndex
CREATE INDEX "goal_progress_goalId_idx" ON "goal_progress"("goalId");

-- CreateIndex
CREATE INDEX "goal_progress_userId_idx" ON "goal_progress"("userId");

-- CreateIndex
CREATE INDEX "goal_progress_userId_periodStart_periodEnd_idx" ON "goal_progress"("userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "weekly_targets_userId_idx" ON "weekly_targets"("userId");

-- CreateIndex
CREATE INDEX "weekly_targets_goalId_idx" ON "weekly_targets"("goalId");

-- CreateIndex
CREATE INDEX "weekly_targets_offeringId_idx" ON "weekly_targets"("offeringId");

-- CreateIndex
CREATE INDEX "weekly_targets_userId_weekStart_targetType_idx" ON "weekly_targets"("userId", "weekStart", "targetType");

-- CreateIndex
CREATE INDEX "momentum_states_userId_idx" ON "momentum_states"("userId");

-- CreateIndex
CREATE INDEX "momentum_states_goalId_idx" ON "momentum_states"("goalId");

-- CreateIndex
CREATE INDEX "momentum_states_offeringId_idx" ON "momentum_states"("offeringId");

-- CreateIndex
CREATE INDEX "momentum_states_strategicCampaignId_idx" ON "momentum_states"("strategicCampaignId");

-- CreateIndex
CREATE INDEX "momentum_states_userId_computedAt_idx" ON "momentum_states"("userId", "computedAt");

-- CreateIndex
CREATE INDEX "coaching_nudges_userId_idx" ON "coaching_nudges"("userId");

-- CreateIndex
CREATE INDEX "coaching_nudges_momentumStateId_idx" ON "coaching_nudges"("momentumStateId");

-- CreateIndex
CREATE INDEX "coaching_nudges_status_idx" ON "coaching_nudges"("status");

-- CreateIndex
CREATE INDEX "coaching_nudges_scheduledFor_idx" ON "coaching_nudges"("scheduledFor");

-- CreateIndex
CREATE INDEX "coaching_nudges_userId_status_scheduledFor_idx" ON "coaching_nudges"("userId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "coaching_nudges_linkedEntityType_linkedEntityId_idx" ON "coaching_nudges"("linkedEntityType", "linkedEntityId");

-- AddForeignKey
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "referral_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_milestones" ADD CONSTRAINT "referral_milestones_referralAttributionId_fkey" FOREIGN KEY ("referralAttributionId") REFERENCES "referral_attributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referralAttributionId_fkey" FOREIGN KEY ("referralAttributionId") REFERENCES "referral_attributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referralMilestoneId_fkey" FOREIGN KEY ("referralMilestoneId") REFERENCES "referral_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_credits" ADD CONSTRAINT "growth_credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_credits" ADD CONSTRAINT "growth_credits_referralRewardId_fkey" FOREIGN KEY ("referralRewardId") REFERENCES "referral_rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_progress" ADD CONSTRAINT "goal_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_targets" ADD CONSTRAINT "weekly_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_targets" ADD CONSTRAINT "weekly_targets_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_targets" ADD CONSTRAINT "weekly_targets_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "momentum_states" ADD CONSTRAINT "momentum_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "momentum_states" ADD CONSTRAINT "momentum_states_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "momentum_states" ADD CONSTRAINT "momentum_states_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "momentum_states" ADD CONSTRAINT "momentum_states_strategicCampaignId_fkey" FOREIGN KEY ("strategicCampaignId") REFERENCES "strategic_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_nudges" ADD CONSTRAINT "coaching_nudges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coaching_nudges" ADD CONSTRAINT "coaching_nudges_momentumStateId_fkey" FOREIGN KEY ("momentumStateId") REFERENCES "momentum_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
