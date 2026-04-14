"use strict";
// Core platform enums
Object.defineProperty(exports, "__esModule", { value: true });
exports.Priority = exports.ActivityType = exports.TaskStatus = exports.ResumeVariantStatus = exports.CampaignStatus = exports.FeatureKey = exports.SubscriptionStatus = exports.OpportunityStage = void 0;
var OpportunityStage;
(function (OpportunityStage) {
    OpportunityStage["LEAD"] = "LEAD";
    OpportunityStage["QUALIFIED"] = "QUALIFIED";
    OpportunityStage["PROPOSAL"] = "PROPOSAL";
    OpportunityStage["NEGOTIATION"] = "NEGOTIATION";
    OpportunityStage["CLOSED_WON"] = "CLOSED_WON";
    OpportunityStage["CLOSED_LOST"] = "CLOSED_LOST";
})(OpportunityStage || (exports.OpportunityStage = OpportunityStage = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["TRIALING"] = "TRIALING";
    SubscriptionStatus["PAST_DUE"] = "PAST_DUE";
    SubscriptionStatus["CANCELED"] = "CANCELED";
    SubscriptionStatus["UNPAID"] = "UNPAID";
    SubscriptionStatus["INACTIVE"] = "INACTIVE";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var FeatureKey;
(function (FeatureKey) {
    FeatureKey["MAX_COMPANIES"] = "MAX_COMPANIES";
    FeatureKey["MAX_OPPORTUNITIES"] = "MAX_OPPORTUNITIES";
    FeatureKey["AI_CREDITS_MONTHLY"] = "AI_CREDITS_MONTHLY";
    FeatureKey["BROWSER_AUTOMATION"] = "BROWSER_AUTOMATION";
    FeatureKey["API_ACCESS"] = "API_ACCESS";
    FeatureKey["DEDICATED_SUPPORT"] = "DEDICATED_SUPPORT";
})(FeatureKey || (exports.FeatureKey = FeatureKey = {}));
var CampaignStatus;
(function (CampaignStatus) {
    CampaignStatus["DRAFT"] = "DRAFT";
    CampaignStatus["ACTIVE"] = "ACTIVE";
    CampaignStatus["PAUSED"] = "PAUSED";
    CampaignStatus["COMPLETED"] = "COMPLETED";
    CampaignStatus["FAILED"] = "FAILED";
})(CampaignStatus || (exports.CampaignStatus = CampaignStatus = {}));
var ResumeVariantStatus;
(function (ResumeVariantStatus) {
    ResumeVariantStatus["PENDING"] = "PENDING";
    ResumeVariantStatus["GENERATING"] = "GENERATING";
    ResumeVariantStatus["COMPLETED"] = "COMPLETED";
    ResumeVariantStatus["FAILED"] = "FAILED";
})(ResumeVariantStatus || (exports.ResumeVariantStatus = ResumeVariantStatus = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["TODO"] = "TODO";
    TaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TaskStatus["DONE"] = "DONE";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var ActivityType;
(function (ActivityType) {
    ActivityType["EMAIL"] = "EMAIL";
    ActivityType["CALL"] = "CALL";
    ActivityType["MEETING"] = "MEETING";
    ActivityType["NOTE"] = "NOTE";
    ActivityType["TASK"] = "TASK";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var Priority;
(function (Priority) {
    Priority["LOW"] = "LOW";
    Priority["MEDIUM"] = "MEDIUM";
    Priority["HIGH"] = "HIGH";
})(Priority || (exports.Priority = Priority = {}));
//# sourceMappingURL=enums.js.map