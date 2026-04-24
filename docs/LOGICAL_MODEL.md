# Logical Relational Model

## 1. Design Principles for the Logical Model

These principles guide the relational design:

* **PostgreSQL-first**
* use **UUIDs** for primary keys
* include `created_at` and `updated_at` on core mutable tables
* keep **User** as ownership root
* keep **Opportunity** as the main workflow entity
* allow **Person**, **Company**, and **Opportunity** to be linked flexibly
* use **junction tables** only where relationships are truly many-to-many
* use **enum columns** where state model is stable
* keep the schema extensible for later:

  * authentication identities
  * authentication sessions
  * verification tokens
  * resumes
  * campaigns
  * GitHub evidence
  * application sessions
* use **JSONB** for semi-structured provider payloads, AI metadata, and flexible configuration
* keep **User** out of foreign key cascades; user deletion should be an explicit product/data-retention operation

---

## 2. Core Enums for MVP

These should exist conceptually as relational enums or constrained strings.

### `subscription_status`

Values:

* `trialing`
* `active`
* `past_due`
* `canceled`
* `expired`

### `feature_access_level`

Values:

* `disabled`
* `enabled`
* `limited`
* `premium`

### `authentication_credential_type`

Values:

* `password`
* `google_oauth`
* `apple_sign_in`
* `passkey`

### `verification_token_type`

Values:

* `email_verify`
* `password_reset`
* `magic_link`

### `authentication_session_status`

Values:

* `active`
* `revoked`
* `expired`

### `opportunity_stage`

Values:

* `new`
* `targeted`
* `outreach_sent`
* `applied`
* `conversation_started`
* `interviewing`
* `awaiting_decision`
* `closed_won`
* `closed_lost`

### `activity_type`

Values:

* `linkedin_message`
* `email`
* `call`
* `interview`
* `application_submitted`
* `meeting`
* `follow_up`
* `note_event`
* `other`

### `task_status`

Values:

* `open`
* `in_progress`
* `done`
* `canceled`

### `task_priority`

Values:

* `low`
* `medium`
* `high`
* `urgent`

### `company_type`

Values:

* `employer`
* `prospect`
* `recruiter_agency`
* `startup`
* `consulting_target`
* `other`

### `opportunity_type`

Values:

* `job`
* `contract`
* `consulting`
* `networking`
* `other`

### `discovered_opportunity_status`

Values:

* `new`
* `reviewed`
* `shortlisted`
* `promoted`
* `dismissed`
* `watchlisted`

### `search_profile_type`

Values:

* `jobs`
* `companies`
* `people`
* `mixed`

### `discovery_scan_type`

Values:

* `companies`
* `people`
* `university_professors`
* `content_signals`
* `mixed`

### `discovery_scan_status`

Values:

* `requested`
* `running`
* `completed`
* `failed`
* `cancelled`

### `discovery_target_type`

Values:

* `company`
* `person`
* `university_professor`
* `content_signal`
* `opportunity`

### `discovery_target_status`

Values:

* `proposed`
* `accepted`
* `rejected`
* `promoted`
* `duplicate`
* `archived`

### `discovery_evidence_type`

Values:

* `website`
* `linkedin`
* `publication`
* `article`
* `profile`
* `directory`
* `search_result`
* `uploaded_content`
* `other`

### `connection_import_status`

Values:

* `uploading`
* `parsing`
* `processing`
* `completed`
* `failed`
* `cancelled`

### `connection_strength`

Values:

* `very_weak`   // No recent interaction
* `weak`        // Occasional likes/views
* `moderate`    // Some messages or comments
* `strong`      // Regular interaction
* `very_strong` // Close professional relationship

### `connection_segment_type`

Values:

* `by_company`
* `by_title`
* `by_industry`
* `by_location`
* `by_recency`
* `by_strength`
* `by_relevance`  // AI-scored against active offering

### `offering_type`

Values:

* `product`
* `service`
* `consulting`
* `advisory_program`
* `book`
* `content_series`
* `software`
* `platform`
* `event`
* `job_profile`
* `role_candidacy`
* `other`

### `offering_status`

Values:

* `draft`
* `active`
* `inactive`
* `archived`

### `offering_asset_type`

Values:

* `portfolio`
* `case_study`
* `testimonial`
* `document`
* `image`
* `video`
* `other`

### `offering_positioning_status`

Values:

* `draft`
* `active`
* `inactive`
* `archived`

### `campaign_status`

Values:

* `PLANNING`
* `ACTIVE`
* `PAUSED`
* `COMPLETED`
* `ARCHIVED`

### `ai_conversation_purpose`

Values:

* `onboarding`
* `offering_strategy`
* `opportunity_analysis`
* `resume_tailoring`
* `outreach_planning`
* `general_chat`
* `other`

### `ai_conversation_status`

Values:

* `active`
* `paused`
* `completed`
* `archived`

### `opportunity_cycle_phase`

Values:

* `surfaced`
* `interpreted`
* `proposed`
* `drafting`
* `awaiting_confirmation`
* `executed`
* `confirmed`
* `completed`
* `dismissed`

### `campaign_status`

Values:

* `planning`
* `active`
* `paused`
* `completed`
* `archived`

### `action_lane_type`

Values:

* `email`
* `linkedin_messaging`
* `linkedin_content`
* `call_outreach`
* `referral_warm_intro`
* `event_webinar_outreach`
* `application_proposal`
* `local_reactivation`
* `client_retention`
* `content_leverage`
* `other`

### `action_lane_status`

Values:

* `active`
* `paused`
* `completed`
* `archived`

### `action_cycle_status`

Values:

* `surfaced`
* `pursuing`
* `executed`
* `confirmed`
* `failed`
* `dismissed`

### `opportunity_cycle_status`

Values:

* `active`
* `paused`
* `completed`
* `dismissed`
* `archived`

### `workspace_mode`

Values:

* `empty`
* `signal_review`
* `goal_planning`
* `campaign_review`
* `opportunity_review`
* `draft_edit`
* `asset_review`
* `execution_confirm`
* `progress_summary`

### `workspace_signal_status`

Values:

* `new`
* `surfaced`
* `active`
* `consumed`
* `dismissed`
* `archived`

### `workspace_signal_importance`

Values:

* `low`
* `medium`
* `high`
* `critical`

### `workspace_command_status`

Values:

* `pending`
* `running`
* `succeeded`
* `failed`
* `cancelled`

### `capability_type`

Values:

* `email`
* `calendar`
* `messaging`
* `calling`
* `contacts`
* `storage`
* `discovery`

### `connector_status`

Values:

* `connected`
* `disconnected`
* `error`
* `expired`
* `syncing`
* `pending_setup`

### `capability_execution_status`

Values:

* `succeeded`
* `failed`
* `retrying`
* `cancelled`
* `rate_limited`
* `provider_error`

### `upgrade_reason`

Values:

* `plan_does_not_include_capability`
* `usage_limit_reached`
* `connector_limit_reached`
* `missing_required_connector`
* `trial_expired`
* `payment_required`
* `feature_temporarily_disabled`

### `referral_milestone_type`

Values:

* `signup`
* `onboarding_completed`
* `first_cycle_completed`
* `first_outreach_sent`
* `paid_conversion`

### `reward_type`

Values:

* `ai_usage_credit`
* `cycle_credit`
* `discovery_scan_credit`
* `connector_slot_credit`
* `premium_trial_unlock`
* `subscription_credit`

### `growth_credit_status`

Values:

* `available`
* `partially_used`
* `consumed`
* `expired`
* `revoked`

### `momentum_state_type`

Values:

* `on_track`
* `behind`
* `stalled`
* `recovering`
* `strong_momentum`

### `coaching_nudge_type`

Values:

* `complete_cycle`
* `send_follow_up`
* `review_signal`
* `celebrate_progress`
* `reactivate_opportunity`
* `resume_onboarding`

### `coaching_nudge_status`

Values:

* `pending`
* `delivered`
* `acted_on`
* `dismissed`
* `expired`

### `engagement_state_type`

Values:

* `active`
* `quiet`
* `at_risk`
* `dormant`
* `reactivated`

---

## 3. Tables

### `users`

Purpose: account owner and root owner of data.

#### Columns

* `id` UUID PK
* `email` VARCHAR NOT NULL UNIQUE
* `full_name` VARCHAR NULL
* `timezone` VARCHAR NULL
* `email_verified_at` TIMESTAMP NULL
* `last_login_at` TIMESTAMP NULL
* `is_active` BOOLEAN NOT NULL DEFAULT true
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique index on `email`

#### Notes

* All user-owned tables reference `users.id`

---

### `authentication_identities`

Purpose: login-facing identities that resolve to one user.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `identity_type` VARCHAR NOT NULL DEFAULT `email`
* `email` VARCHAR NOT NULL
* `email_normalized` VARCHAR NOT NULL
* `is_primary` BOOLEAN NOT NULL DEFAULT true
* `is_verified` BOOLEAN NOT NULL DEFAULT false
* `verified_at` TIMESTAMP NULL
* `last_authenticated_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique index on `email_normalized`
* index on `user_id`

#### Notes

* MVP uses a single primary email identity per user
* this separates login identity from business-domain ownership

---

### `credentials`

Purpose: concrete authentication methods attached to an identity.

#### Columns

* `id` UUID PK
* `authentication_identity_id` UUID NOT NULL FK -> `authentication_identities.id`
* `credential_type` `authentication_credential_type` NOT NULL
* `password_hash` TEXT NULL
* `provider_name` VARCHAR NULL
* `provider_account_id` VARCHAR NULL
* `password_version` INTEGER NOT NULL DEFAULT 1
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `authentication_identity_id`
* optional unique composite index on (`provider_name`, `provider_account_id`) where both are not null

#### Notes

* MVP can support exactly one password credential per identity at the app layer
* `password_hash` is only populated for password credentials

---

### `authentication_sessions`

Purpose: authenticated client sessions used for refresh and revocation.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `authentication_identity_id` UUID NULL FK -> `authentication_identities.id`
* `status` `authentication_session_status` NOT NULL DEFAULT `active`
* `client_type` VARCHAR NOT NULL
* `device_name` VARCHAR NULL
* `user_agent` TEXT NULL
* `ip_address` INET NULL
* `refresh_token_hash` TEXT NOT NULL
* `expires_at` TIMESTAMP NOT NULL
* `last_used_at` TIMESTAMP NULL
* `revoked_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `authentication_identity_id`
* index on (`user_id`, `status`)
* index on `expires_at`

#### Notes

* access tokens remain stateless; refresh lifecycle is backed by this table
* supports concurrent sessions across iOS, web, and internal tools

---

### `verification_tokens`

Purpose: one-time auth lifecycle proofs such as email verification and password reset.

#### Columns

* `id` UUID PK
* `user_id` UUID NULL FK -> `users.id`
* `authentication_identity_id` UUID NULL FK -> `authentication_identities.id`
* `token_type` `verification_token_type` NOT NULL
* `token_hash` TEXT NOT NULL
* `expires_at` TIMESTAMP NOT NULL
* `consumed_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `authentication_identity_id`
* index on `token_type`
* index on `expires_at`

#### Notes

* store only hashed verification/reset tokens
* either `user_id` or `authentication_identity_id` may be the main lookup depending on flow

---

### `plans`

Purpose: pricing tiers.

#### Columns

* `id` UUID PK
* `code` VARCHAR NOT NULL UNIQUE
* `name` VARCHAR NOT NULL
* `description` TEXT NULL
* `monthly_price_cents` INTEGER NOT NULL DEFAULT 0
* `annual_price_cents` INTEGER NOT NULL DEFAULT 0
* `currency` VARCHAR NOT NULL DEFAULT 'USD'
* `is_active` BOOLEAN NOT NULL DEFAULT true
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique index on `code`

#### Notes

* Examples: `free_explorer`, `builder`, `operator`, `studio`, `team`
* A plan defines durable commercial posture; plan feature rows define concrete capability access and quotas.

---

### `plan_features`

Purpose: plan capability definitions.

#### Columns

* `id` UUID PK
* `plan_id` UUID NOT NULL FK -> `plans.id`
* `feature_key` VARCHAR NOT NULL
* `access_level` `feature_access_level` NOT NULL
* `config_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`plan_id`, `feature_key`)
* index on `feature_key`

#### Notes

* `config_json` can hold quota-like settings such as:

  * max AI requests or token budget
  * max next-action cycles
  * max offerings
  * max discovery scans
  * max content ingestions
  * max connector slots
  * max connected email accounts
  * whether email draft/send/background sync is enabled

* `CapabilityGateService` evaluates plan features at runtime; this is not a persisted table.

---

### `subscriptions`

Purpose: current or historical commercial subscription state.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `plan_id` UUID NOT NULL FK -> `plans.id`
* `provider` VARCHAR NULL
* `provider_customer_id` VARCHAR NULL
* `provider_subscription_id` VARCHAR NULL
* `status` `subscription_status` NOT NULL
* `billing_interval` VARCHAR NULL
* `started_at` TIMESTAMP NOT NULL
* `current_period_start` TIMESTAMP NULL
* `current_period_end` TIMESTAMP NULL
* `cancel_at_period_end` BOOLEAN NOT NULL DEFAULT false
* `trial_ends_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `plan_id`
* index on `status`
* optional unique index on `provider_subscription_id` where not null

#### Notes

* User may have many subscriptions historically
* App logic should define active subscription resolution

---

### `usage_counters`

Purpose: current metered usage by feature and period.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `feature_key` VARCHAR NOT NULL
* `usage_period_start` DATE NOT NULL
* `usage_period_end` DATE NOT NULL
* `used_count` INTEGER NOT NULL DEFAULT 0
* `reset_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`user_id`, `feature_key`, `usage_period_start`, `usage_period_end`)
* index on `user_id`
* index on `feature_key`

#### Notes

* This is a fast lookup table for entitlement enforcement
* Growth credits can extend the effective allowance for a feature without mutating the base plan feature.
* Usage increments should occur in the same application flow as the gated capability execution or through an idempotent usage event pattern.

---

### `model_access_policies`

Purpose: AI model policy per plan and feature.

#### Columns

* `id` UUID PK
* `plan_id` UUID NOT NULL FK -> `plans.id`
* `feature_key` VARCHAR NOT NULL
* `model_tier` VARCHAR NOT NULL
* `max_tokens_per_request` INTEGER NULL
* `max_requests_per_period` INTEGER NULL
* `fallback_model_tier` VARCHAR NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`plan_id`, `feature_key`)
* index on `feature_key`

#### Notes

* This lets AI routing stay plan-aware

---

### `companies`

Purpose: organizations relevant to a user's pipeline.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `name` VARCHAR NOT NULL
* `domain` VARCHAR NULL
* `website` VARCHAR NULL
* `linkedin_url` TEXT NULL
* `industry` VARCHAR NULL
* `size_band` VARCHAR NULL
* `geography` VARCHAR NULL
* `company_type` `company_type` NOT NULL DEFAULT `prospect`
* `description` TEXT NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `name`
* index on `company_type`
* optional unique composite index on (`user_id`, `name`)
* optional composite index on (`user_id`, `domain`)

#### Notes

* Keep duplicate prevention mostly at app layer at first

---

### `people`

Purpose: individuals connected to companies and opportunities.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `company_id` UUID NULL FK -> `companies.id`
* `first_name` VARCHAR NULL
* `last_name` VARCHAR NULL
* `full_name` VARCHAR NOT NULL
* `title` VARCHAR NULL
* `email` VARCHAR NULL
* `phone` VARCHAR NULL
* `linkedin_url` TEXT NULL
* `github_url` TEXT NULL
* `location` VARCHAR NULL
* `contact_source` VARCHAR NULL
* `relationship_strength` INTEGER NULL
* `notes_summary` TEXT NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `company_id`
* index on `full_name`
* index on `email`
* optional composite index on (`user_id`, `company_id`)
* optional unique composite index on (`user_id`, `email`) where email is not null

#### Notes

* `relationship_strength` can be a simple 1–5 or 1–10 score later

---

### `opportunities`

Purpose: main pursuit/workflow entity.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `company_id` UUID NOT NULL FK -> `companies.id`
* `primary_person_id` UUID NULL FK -> `people.id`
* `source_discovered_opportunity_id` UUID NULL FK -> `discovered_opportunities.id`
* `title` VARCHAR NOT NULL
* `opportunity_type` `opportunity_type` NOT NULL DEFAULT `job`
* `stage` `opportunity_stage` NOT NULL DEFAULT `new`
* `status` VARCHAR NULL
* `source` VARCHAR NULL
* `priority` VARCHAR NULL
* `fit_score` INTEGER NULL
* `qualification_score` INTEGER NULL
* `summary` TEXT NULL
* `next_action` TEXT NULL
* `next_action_date` TIMESTAMP NULL
* `estimated_value_cents` INTEGER NULL
* `close_probability` INTEGER NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `company_id`
* index on `primary_person_id`
* index on `stage`
* index on `opportunity_type`
* index on `next_action_date`
* optional composite index on (`user_id`, `stage`)
* optional composite index on (`user_id`, `company_id`)

#### Notes

* `status` can remain flexible string for now
* `close_probability` for future weighting, even if lightly used

---

### `opportunity_people`

Purpose: many-to-many link between opportunities and people.

#### Columns

* `id` UUID PK
* `opportunity_id` UUID NOT NULL FK -> `opportunities.id`
* `person_id` UUID NOT NULL FK -> `people.id`
* `role_in_opportunity` VARCHAR NOT NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`opportunity_id`, `person_id`, `role_in_opportunity`)
* index on `opportunity_id`
* index on `person_id`

#### Notes

* examples of `role_in_opportunity`:

  * recruiter
  * hiring_manager
  * decision_maker
  * champion
  * referral

---

### `activities`

Purpose: timeline of interactions and events.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `opportunity_id` UUID NULL FK -> `opportunities.id`
* `company_id` UUID NULL FK -> `companies.id`
* `person_id` UUID NULL FK -> `people.id`
* `activity_type` `activity_type` NOT NULL
* `channel` VARCHAR NULL
* `direction` VARCHAR NULL
* `subject` VARCHAR NULL
* `body_summary` TEXT NULL
* `occurred_at` TIMESTAMP NOT NULL
* `outcome` VARCHAR NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `opportunity_id`
* index on `company_id`
* index on `person_id`
* index on `occurred_at`
* index on `activity_type`
* optional composite index on (`user_id`, `occurred_at`) desc

#### Notes

* `channel` examples:

  * linkedin
  * email
  * phone
  * website_form
  * recruiter_portal
* At least one of opportunity/company/person should usually be present by app rule

---

### `tasks`

Purpose: next actions and to-dos.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `opportunity_id` UUID NULL FK -> `opportunities.id`
* `company_id` UUID NULL FK -> `companies.id`
* `person_id` UUID NULL FK -> `people.id`
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `due_at` TIMESTAMP NULL
* `status` `task_status` NOT NULL DEFAULT `open`
* `priority` `task_priority` NOT NULL DEFAULT `medium`
* `task_type` VARCHAR NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL
* `completed_at` TIMESTAMP NULL

#### Indexes

* index on `user_id`
* index on `opportunity_id`
* index on `person_id`
* index on `due_at`
* index on `status`
* optional composite index on (`user_id`, `status`, `due_at`)

#### Notes

* App rule can ensure at least one parent reference when relevant

---

### `notes`

Purpose: freeform notes attached to one entity.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `linked_entity_type` VARCHAR NOT NULL
* `linked_entity_id` UUID NOT NULL
* `note_type` VARCHAR NULL
* `text` TEXT NOT NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* composite index on (`linked_entity_type`, `linked_entity_id`)
* index on `created_at`

#### Notes

* Polymorphic association by design
* linked entity types initially:

  * company
  * person
  * opportunity

---

### `tags`

Purpose: reusable labels.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `name` VARCHAR NOT NULL
* `color` VARCHAR NULL
* `category` VARCHAR NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`user_id`, `name`)
* index on `user_id`

#### Notes

* tags are user-scoped

---

### `entity_tags`

Purpose: polymorphic tag attachment table.

#### Columns

* `id` UUID PK
* `tag_id` UUID NOT NULL FK -> `tags.id`
* `entity_type` VARCHAR NOT NULL
* `entity_id` UUID NOT NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* composite index on (`entity_type`, `entity_id`)
* index on `tag_id`
* unique composite index on (`tag_id`, `entity_type`, `entity_id`)

#### Notes

* initial supported entity types:

  * company
  * person
  * opportunity

---

### `search_profiles`

Purpose: saved recurring search definitions.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `name` VARCHAR NOT NULL
* `search_profile_type` `search_profile_type` NOT NULL DEFAULT `mixed`
* `query_text` TEXT NULL
* `filters_json` JSONB NULL
* `cadence` VARCHAR NULL
* `is_active` BOOLEAN NOT NULL DEFAULT true
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `is_active`
* optional composite index on (`user_id`, `is_active`)

#### Notes

* `filters_json` can hold:

  * titles
  * geographies
  * remote preferences
  * exclusions
  * industries

---

### `search_runs`

Purpose: one execution of a search profile.

#### Columns

* `id` UUID PK
* `search_profile_id` UUID NOT NULL FK -> `search_profiles.id`
* `started_at` TIMESTAMP NOT NULL
* `completed_at` TIMESTAMP NULL
* `status` VARCHAR NOT NULL
* `result_count` INTEGER NOT NULL DEFAULT 0
* `high_priority_count` INTEGER NOT NULL DEFAULT 0
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `search_profile_id`
* index on `started_at`
* index on `status`

#### Notes

* `status` can be flexible string initially:

  * queued
  * running
  * completed
  * failed

---

### `discovered_opportunities`

Purpose: scanned opportunities before promotion into CRM.

#### Columns

* `id` UUID PK
* `search_run_id` UUID NOT NULL FK -> `search_runs.id`
* `source_type` VARCHAR NOT NULL
* `source_url` TEXT NULL
* `raw_external_id` VARCHAR NULL
* `title` VARCHAR NOT NULL
* `company_name_raw` VARCHAR NULL
* `company_id` UUID NULL FK -> `companies.id`
* `description_raw` TEXT NULL
* `location` VARCHAR NULL
* `employment_type` VARCHAR NULL
* `remote_type` VARCHAR NULL
* `posted_at` TIMESTAMP NULL
* `fit_score` INTEGER NULL
* `priority_score` INTEGER NULL
* `ai_summary` TEXT NULL
* `suggested_action` VARCHAR NULL
* `suggested_positioning_profile` VARCHAR NULL
* `lifecycle_status` `discovered_opportunity_status` NOT NULL DEFAULT `new`
* `promoted_opportunity_id` UUID NULL FK -> `opportunities.id`
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `search_run_id`
* index on `company_id`
* index on `lifecycle_status`
* index on `posted_at`
* index on `fit_score`
* optional composite index on (`search_run_id`, `lifecycle_status`)
* optional index on `raw_external_id`

#### Notes

* `company_id` is optional because normalization may happen later
* `promoted_opportunity_id` allows traceability into CRM
* deduplication may use `raw_external_id` plus source type where available

---

### `discovery_scans`

Purpose: first-class discovery runs created from an offering, campaign, goal, or explicit Conductor request.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `campaign_id` UUID NULL FK -> `campaigns.id`
* `goal_id` UUID NULL FK -> `goals.id`
* `scan_type` `discovery_scan_type` NOT NULL DEFAULT `mixed`
* `status` `discovery_scan_status` NOT NULL DEFAULT `requested`
* `provider_key` VARCHAR NOT NULL DEFAULT `local_mock`
* `query` TEXT NOT NULL
* `target_segment` TEXT NULL
* `max_targets` INTEGER NOT NULL DEFAULT 10
* `accepted_count` INTEGER NOT NULL DEFAULT 0
* `rejected_count` INTEGER NOT NULL DEFAULT 0
* `promoted_count` INTEGER NOT NULL DEFAULT 0
* `started_at` TIMESTAMP NULL
* `completed_at` TIMESTAMP NULL
* `failed_at` TIMESTAMP NULL
* `failure_reason` TEXT NULL
* `request_context_json` JSONB NULL
* `provider_result_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `offering_id`
* index on `campaign_id`
* index on `goal_id`
* index on `status`
* index on `scan_type`
* composite index on (`user_id`, `status`, `created_at`)

#### Notes

* Discovery is provider-abstracted; `provider_key` identifies the implementation used for the run.
* Scans are durable even when no targets are promoted, because the user may review evidence later.

---

### `discovery_targets`

Purpose: explainable candidate prospects or signals produced by discovery before promotion into CRM.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `scan_id` UUID NOT NULL FK -> `discovery_scans.id`
* `target_type` `discovery_target_type` NOT NULL DEFAULT `person`
* `status` `discovery_target_status` NOT NULL DEFAULT `proposed`
* `title` VARCHAR NOT NULL
* `company_name` VARCHAR NULL
* `person_name` VARCHAR NULL
* `role_title` VARCHAR NULL
* `email` VARCHAR NULL
* `phone` VARCHAR NULL
* `website` TEXT NULL
* `linkedin_url` TEXT NULL
* `location` VARCHAR NULL
* `source_url` TEXT NULL
* `dedupe_key` VARCHAR NULL
* `confidence_score` INTEGER NOT NULL DEFAULT 50
* `relevance_score` INTEGER NOT NULL DEFAULT 50
* `qualification_score` INTEGER NULL
* `why_this_target` TEXT NULL
* `recommended_action` TEXT NULL
* `rejection_reason` TEXT NULL
* `accepted_at` TIMESTAMP NULL
* `rejected_at` TIMESTAMP NULL
* `promoted_at` TIMESTAMP NULL
* `company_id` UUID NULL FK -> `companies.id`
* `person_id` UUID NULL FK -> `people.id`
* `opportunity_id` UUID NULL FK -> `opportunities.id`
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `scan_id`
* index on `status`
* index on `target_type`
* index on `company_id`, `person_id`, and `opportunity_id`
* indexes on `relevance_score`, `confidence_score`, and `dedupe_key`
* composite index on (`user_id`, `status`, `relevance_score`)

#### Notes

* Targets are reviewed before promotion; campaigns consume promoted CRM records, not raw provider payloads.
* `why_this_target` and evidence records are required for explainability in the Canvas.

---

### `discovery_evidence`

Purpose: source-level proof or context behind a discovered target.

#### Columns

* `id` UUID PK
* `discovery_target_id` UUID NOT NULL FK -> `discovery_targets.id`
* `evidence_type` `discovery_evidence_type` NOT NULL DEFAULT `other`
* `title` VARCHAR NOT NULL
* `source_url` TEXT NULL
* `source_name` VARCHAR NULL
* `snippet` TEXT NULL
* `published_at` TIMESTAMP NULL
* `confidence_score` INTEGER NOT NULL DEFAULT 50
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `discovery_target_id`
* index on `evidence_type`
* index on `source_url`

---

### `connection_import_batches`

Purpose: track LinkedIn connections CSV imports and their processing status.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `filename` VARCHAR NOT NULL
* `file_size` INTEGER NOT NULL
* `total_rows` INTEGER NOT NULL
* `processed_rows` INTEGER NOT NULL DEFAULT 0
* `created_people_count` INTEGER NOT NULL DEFAULT 0
* `updated_people_count` INTEGER NOT NULL DEFAULT 0
* `duplicate_count` INTEGER NOT NULL DEFAULT 0
* `error_count` INTEGER NOT NULL DEFAULT 0
* `status` `connection_import_status` NOT NULL DEFAULT `uploading`
* `error_message` TEXT NULL
* `processing_started_at` TIMESTAMP NULL
* `processing_completed_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `status`
* index on `created_at`

#### Notes

* Each CSV upload creates one batch record.
* Processing is asynchronous to handle large files.
* Tracks creation vs updates to understand data freshness.

---

### `connection_records`

Purpose: individual LinkedIn connections with relationship context and campaign potential.

#### Columns

* `id` UUID PK
* `import_batch_id` UUID NOT NULL FK -> `connection_import_batches.id`
* `user_id` UUID NOT NULL FK -> `users.id`
* `person_id` UUID NULL FK -> `people.id`
* `first_name` VARCHAR NOT NULL
* `last_name` VARCHAR NOT NULL
* `email` VARCHAR NULL
* `company` VARCHAR NULL
* `title` VARCHAR NULL
* `linkedin_url` VARCHAR NULL
* `connected_on` DATE NULL
* `last_interaction_on` DATE NULL
* `strength` `connection_strength` NOT NULL DEFAULT `moderate`
* `relevance_score` DECIMAL(3,2) NULL  // AI-scored 0.00-1.00 against active offering
* `is_potential_referral` BOOLEAN NOT NULL DEFAULT FALSE
* `referral_target_notes` TEXT NULL
* `campaign_suggestions_json` JSONB NULL
* `import_row_number` INTEGER NOT NULL
* `import_metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `import_batch_id`
* index on `user_id`
* index on `person_id`
* index on `email`
* index on `company`
* index on `title`
* index on `strength`
* index on `relevance_score`
* index on `is_potential_referral`
* composite index on (`user_id`, `company`)
* composite index on (`user_id`, `title`)

#### Notes

* Links to canonical Person record after deduplication and promotion.
* Relevance scoring is updated when active offerings change.
* Campaign suggestions are AI-generated based on connection profile.

---

### `connection_segments`

Purpose: AI-generated groupings of connections for targeted campaigns.

#### Columns

* `id` UUID PK
* `import_batch_id` UUID NOT NULL FK -> `connection_import_batches.id`
* `user_id` UUID NOT NULL FK -> `users.id`
* `segment_type` `connection_segment_type` NOT NULL
* `segment_key` VARCHAR NOT NULL  // e.g., "Google", "CTO", "San Francisco"
* `segment_name` VARCHAR NOT NULL  // e.g., "Google Employees", "CTO Connections", "Bay Area Network"
* `description` TEXT NULL
* `connection_count` INTEGER NOT NULL DEFAULT 0
* `avg_relevance_score` DECIMAL(3,2) NULL
* `campaign_suggestion` TEXT NULL
* `priority_rank` INTEGER NULL
* `auto_generated` BOOLEAN NOT NULL DEFAULT TRUE
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `import_batch_id`
* index on `user_id`
* index on `segment_type`
* index on `priority_rank`
* composite index on (`user_id`, `segment_type`, `priority_rank`)

#### Notes

* Segments are created during import processing and updated as offerings change.
* Priority ranking helps users focus on high-value segments first.
* Auto-generated segments can be manually edited or supplemented.

---

### `connection_segment_members`

Purpose: many-to-many relationship between connections and segments.

#### Columns

* `id` UUID PK
* `segment_id` UUID NOT NULL FK -> `connection_segments.id`
* `connection_id` UUID NOT NULL FK -> `connection_records.id`
* `match_score` DECIMAL(3,2) NULL  // How strongly this connection belongs to the segment
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `segment_id`
* index on `connection_id`
* composite index on (`segment_id`, `match_score`)

#### Notes

* Allows connections to belong to multiple segments (e.g., by company AND title).
* Match score helps with segment quality analysis.

---

### `offerings`

Purpose: structured packages of value that users can take to market.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `offering_type` `offering_type` NOT NULL
* `status` `offering_status` NOT NULL DEFAULT `draft`
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on (`offering_type`, `status`)
* index on `created_at`

#### Notes

* An active offering is the commercial context the Conductor should use when ranking next actions.
* An offering is the market-facing value unit being advanced, not the user's raw experience or resume by itself.
* Offerings may be advanced by goals, campaigns, opportunities, lane execution records, and legacy opportunity cycles.
* Supporting assets such as resumes, books, portfolios, case studies, and briefs provide evidence and leverage for an offering.
* Offerings should be created from confirmed `offering_proposals` when the source is conversational AI inference.

---

### `offering_proposals`

Purpose: AI-inferred offering structures awaiting user confirmation before they become durable offerings.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `ai_conversation_id` UUID NULL FK -> `ai_conversations.id`
* `confirmed_offering_id` UUID NULL FK -> `offerings.id`
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `offering_type` `offering_type` NOT NULL
* `status` `offering_proposal_status` NOT NULL DEFAULT `proposed`
* `target_audiences_json` JSONB NULL
* `problem_solved` TEXT NULL
* `outcome_created` TEXT NULL
* `credibility` TEXT NULL
* `best_outreach_angle` TEXT NULL
* `suggested_assets_json` JSONB NULL
* `positioning_json` JSONB NULL
* `metadata_json` JSONB NULL
* `confirmed_at` TIMESTAMP NULL
* `rejected_at` TIMESTAMP NULL
* `superseded_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `ai_conversation_id`
* index on `confirmed_offering_id`
* index on (`status`, `updated_at`)

#### Notes

* This table is the approval boundary between conversational inference and durable business context.
* The `confirm_offering` Canvas should read and edit one proposed record at a time.
* Confirming a proposal creates or links a durable `offering`, links the conversation to that offering, and marks the proposal `confirmed`.
* Rejecting or skipping a proposal marks it `rejected`; a newer proposal for the same conversation may mark older open proposals `superseded`.
* JSON columns intentionally preserve flexible AI-inferred structure without forcing premature schema decisions around every positioning field.

---

### `offering_positionings`

Purpose: alternative framing for the same offering by audience, angle, or context.

#### Columns

* `id` UUID PK
* `offering_id` UUID NOT NULL FK -> `offerings.id`
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `status` `offering_positioning_status` NOT NULL DEFAULT `draft`
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `offering_id`
* index on (`status`, `created_at`)

#### Notes

* Positioning can be expanded later with structured target audience, value proposition, and messaging-angle columns if the product needs more queryability.

---

### `offering_assets`

Purpose: proof, packaging, or supporting material attached to an offering.

#### Columns

* `id` UUID PK
* `offering_id` UUID NOT NULL FK -> `offerings.id`
* `offering_positioning_id` UUID NULL FK -> `offering_positionings.id`
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `asset_type` `offering_asset_type` NOT NULL
* `content_url` VARCHAR NULL
* `content_text` TEXT NULL
* `is_public` BOOLEAN NOT NULL DEFAULT false
* `status` `offering_status` NOT NULL DEFAULT `draft`
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `offering_id`
* index on `offering_positioning_id`
* index on (`asset_type`, `status`)
* index on `is_public`

#### Notes

* Large files should live in object storage or file storage; this table should store metadata, URLs, and text excerpts useful to AI.

---

### `goals`

Purpose: desired business or professional outcomes owned by the user.

#### Columns

* `id` UUID PK
* `user_id` UUID NULL FK -> `users.id`
* `guest_session_id` VARCHAR NULL
* `offering_id` UUID NULL FK -> `offerings.id`
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `status` VARCHAR NOT NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `guest_session_id`
* index on `offering_id`
* index on (`user_id`, `status`)

#### Notes

* `offering_id` should be populated whenever the goal is intended to advance a known offering.
* Guest-owned goals can be claimed by a user during signup.

---

### `campaigns`

Purpose: tactical motions designed to advance a goal, usually for a specific audience, channel, or positioning angle.

#### Columns

* `id` UUID PK
* `user_id` UUID NULL FK -> `users.id`
* `guest_session_id` VARCHAR NULL
* `goal_id` UUID NOT NULL FK -> `goals.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `title` VARCHAR NOT NULL
* `strategic_angle` TEXT NULL
* `target_segment` TEXT NULL
* `status` `campaign_status` NOT NULL DEFAULT `PLANNING`
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `goal_id`
* index on `offering_id`
* index on `guest_session_id`
* index on (`user_id`, `status`)

#### Notes

* `offering_id` intentionally duplicates the offering context available through `goal_id` so campaign/workspace queries do not need to join through goals.
* This is distinct from later sequence/outreach campaign tables.

---

### `ai_conversations`

Purpose: bounded AI discussion threads with persistent context.

#### Columns

* `id` UUID PK
* `user_id` UUID NULL FK -> `users.id`
* `guest_session_id` VARCHAR NULL
* `title` VARCHAR NULL
* `purpose` `ai_conversation_purpose` NOT NULL
* `offering_id` UUID NULL FK -> `offerings.id`
* `opportunity_id` UUID NULL FK -> `opportunities.id`
* `status` `ai_conversation_status` NOT NULL DEFAULT `active`
* `message_count` INTEGER NOT NULL DEFAULT 0
* `last_message_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `guest_session_id`
* index on `offering_id`
* index on `opportunity_id`
* index on (`status`, `updated_at`)
* index on `last_message_at`

#### Notes

* Conversations can start before signup using `guest_session_id`, then be claimed by a user.

---

### `ai_conversation_messages`

Purpose: individual turns in an AI conversation.

#### Columns

* `id` UUID PK
* `conversation_id` UUID NOT NULL FK -> `ai_conversations.id`
* `role` VARCHAR NOT NULL
* `content` TEXT NOT NULL
* `metadata_json` JSONB NULL
* `token_count` INTEGER NULL
* `model_used` VARCHAR NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `conversation_id`
* index on (`role`, `created_at`)
* index on `created_at`

#### Notes

* `role` examples: `user`, `assistant`, `system`, `tool`.

---

### `ai_context_summaries`

Purpose: reusable condensed summaries of conversations or domain entities.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `title` VARCHAR NOT NULL
* `summary_type` VARCHAR NOT NULL
* `content` TEXT NOT NULL
* `source_type` VARCHAR NOT NULL
* `source_id` UUID NULL
* `ai_conversation_id` UUID NULL FK -> `ai_conversations.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `opportunity_id` UUID NULL FK -> `opportunities.id`
* `expires_at` TIMESTAMP NULL
* `usage_count` INTEGER NOT NULL DEFAULT 0
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on (`source_type`, `source_id`)
* index on `ai_conversation_id`
* index on `offering_id`
* index on `opportunity_id`
* index on `expires_at`
* index on `usage_count`

#### Notes

* Summaries should preserve enough offering and campaign context to make later AI turns useful without replaying full transcripts.

---

### `ai_tasks`

Purpose: durable records of AI jobs performed by the platform.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `task_type` VARCHAR NOT NULL
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `ai_conversation_id` UUID NULL FK -> `ai_conversations.id`
* `ai_context_summary_id` UUID NULL FK -> `ai_context_summaries.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `opportunity_id` UUID NULL FK -> `opportunities.id`
* `input_data_json` JSONB NULL
* `output_data_json` JSONB NULL
* `status` VARCHAR NOT NULL
* `error_message` TEXT NULL
* `token_count` INTEGER NULL
* `processing_time_ms` INTEGER NULL
* `model_used` VARCHAR NULL
* `started_at` TIMESTAMP NULL
* `completed_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on (`task_type`, `status`)
* index on `ai_conversation_id`
* index on `ai_context_summary_id`
* index on `offering_id`
* index on `opportunity_id`
* index on `created_at`
* index on `completed_at`

#### Notes

* AI tasks are useful for auditability and for async work such as draft generation, summaries, and offering interpretation.

---

### `workspace_signals`

Purpose: meaningful items promoted for user attention. Signals are not raw events; they are ranked and explainable items that may deserve action.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `source_type` VARCHAR NOT NULL
* `source_id` UUID NULL
* `title` VARCHAR NOT NULL
* `summary` TEXT NULL
* `importance` `workspace_signal_importance` NOT NULL DEFAULT `medium`
* `status` `workspace_signal_status` NOT NULL DEFAULT `new`
* `priority_score` INTEGER NOT NULL DEFAULT 50
* `reason` TEXT NULL
* `recommended_action` TEXT NULL
* `recommended_workspace_mode` `workspace_mode` NOT NULL DEFAULT `signal_review`
* `evidence_json` JSONB NULL
* `metadata_json` JSONB NULL
* `surfaced_at` TIMESTAMP NULL
* `consumed_at` TIMESTAMP NULL
* `dismissed_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on (`source_type`, `source_id`)
* index on `status`
* index on `importance`
* index on `priority_score`
* composite index on (`user_id`, `status`, `priority_score`)
* optional unique composite index on (`user_id`, `source_type`, `source_id`) where `source_id` is not null

#### Notes

* `source_type` examples: `discovered_opportunity`, `opportunity`, `task`, `campaign`, `activity`, `ai_conversation`, `asset`
* `evidence_json` stores supporting snippets or facts used by the Conductor
* application logic should suppress low-value duplicate signals

---

### `opportunity_cycles`

Purpose: the active unit of web workflow momentum. A cycle connects a signal or recommendation to a focused workspace and tracks progression from surfaced item to execution and confirmation.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `workspace_signal_id` UUID NULL FK -> `workspace_signals.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `goal_id` UUID NULL FK -> `goals.id`
* `campaign_id` UUID NULL FK -> `campaigns.id`
* `opportunity_id` UUID NULL FK -> `opportunities.id`
* `task_id` UUID NULL FK -> `tasks.id`
* `discovered_opportunity_id` UUID NULL FK -> `discovered_opportunities.id`
* `ai_conversation_id` UUID NULL FK -> `ai_conversations.id`
* `phase` `opportunity_cycle_phase` NOT NULL DEFAULT `surfaced`
* `status` `opportunity_cycle_status` NOT NULL DEFAULT `active`
* `workspace_mode` `workspace_mode` NOT NULL DEFAULT `signal_review`
* `title` VARCHAR NOT NULL
* `why_it_matters` TEXT NULL
* `recommended_action` TEXT NULL
* `priority_score` INTEGER NOT NULL DEFAULT 50
* `confidence` INTEGER NULL
* `allowed_actions_json` JSONB NULL
* `state_json` JSONB NULL
* `started_at` TIMESTAMP NOT NULL
* `last_advanced_at` TIMESTAMP NULL
* `completed_at` TIMESTAMP NULL
* `dismissed_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `workspace_signal_id`
* index on `offering_id`
* index on `goal_id`
* index on `campaign_id`
* index on `opportunity_id`
* index on `task_id`
* index on `discovered_opportunity_id`
* index on `ai_conversation_id`
* index on `phase`
* index on `status`
* composite index on (`user_id`, `status`, `priority_score`)
* composite index on (`user_id`, `status`, `updated_at`)

#### Notes

* At least one contextual reference should usually be present: signal, offering, goal, campaign, opportunity, task, discovered opportunity, or conversation.
* `offering_id` should be set whenever the cycle advances a known offering, even if the offering can be inferred through goal or campaign.
* `allowed_actions_json` is intentionally flexible for V1 because the action vocabulary will evolve with the web UX.
* `state_json` can store workspace-specific draft state, selected asset ids, temporary recommendation payloads, or UI hints.
* Only one active cycle may be foregrounded in the UI, but the database can allow multiple active cycles and let application logic choose the foreground cycle.

---

### `workspace_commands`

Purpose: audit and execute structured actions from the Conductor or Active Workspace.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `opportunity_cycle_id` UUID NULL FK -> `opportunity_cycles.id`
* `ai_conversation_id` UUID NULL FK -> `ai_conversations.id`
* `command_type` VARCHAR NOT NULL
* `status` `workspace_command_status` NOT NULL DEFAULT `pending`
* `input_json` JSONB NULL
* `result_json` JSONB NULL
* `error_message` TEXT NULL
* `started_at` TIMESTAMP NULL
* `completed_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `opportunity_cycle_id`
* index on `ai_conversation_id`
* index on `command_type`
* index on `status`
* index on `created_at`
* composite index on (`user_id`, `status`, `created_at`)

#### Notes

* `command_type` examples: `activate_signal`, `generate_draft`, `revise_draft`, `approve_draft`, `send_outreach`, `create_task`, `advance_opportunity`, `dismiss_cycle`, `complete_cycle`, `summarize_progress`
* domain updates should still happen in the owning tables, such as activities, tasks, opportunities, campaigns, and AI conversations
* commands provide an audit trail and a consistent execution path for both chat-driven and button-driven actions

---

### `capabilities`

Purpose: functional capabilities the platform can perform, independent of specific providers.

#### Columns

* `id` UUID PK
* `capability_type` `capability_type` NOT NULL
* `name` VARCHAR NOT NULL
* `description` TEXT NULL
* `is_active` BOOLEAN NOT NULL DEFAULT true
* `supported_features_json` JSONB NULL
* `default_config_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique index on `capability_type`
* index on `is_active`

#### Notes

* Examples: email, calendar, messaging, calling, contacts, storage, discovery
* `supported_features_json` can define feature flags like: `["send", "receive", "draft", "sync"]`

---

### `capability_providers`

Purpose: specific providers that implement capability interfaces.

#### Columns

* `id` UUID PK
* `capability_id` UUID NOT NULL FK -> `capabilities.id`
* `provider_name` VARCHAR NOT NULL
* `display_name` VARCHAR NOT NULL
* `description` TEXT NULL
* `is_active` BOOLEAN NOT NULL DEFAULT true
* `auth_type` VARCHAR NOT NULL
* `required_scopes_json` JSONB NULL
* `rate_limit_config_json` JSONB NULL
* `provider_config_schema_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`capability_id`, `provider_name`)
* index on `provider_name`
* index on `is_active`

#### Notes

* Examples: Gmail, Outlook (email capability); Google Calendar, Microsoft Graph (calendar capability)
* `auth_type` examples: `oauth2`, `api_key`, `basic_auth`

---

### `user_connectors`

Purpose: user's configured connections to specific capability providers.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `capability_id` UUID NOT NULL FK -> `capabilities.id`
* `capability_provider_id` UUID NOT NULL FK -> `capability_providers.id`
* `connector_name` VARCHAR NULL
* `status` `connector_status` NOT NULL DEFAULT `pending_setup`
* `enabled_features_json` JSONB NULL
* `last_sync_at` TIMESTAMP NULL
* `last_success_at` TIMESTAMP NULL
* `error_message` TEXT NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`user_id`, `capability_id`)
* index on `user_id`
* index on `capability_provider_id`
* index on `status`
* composite index on (`user_id`, `status`)

#### Notes

* One user can have only one connector per capability type (e.g., one email connector)
* `enabled_features_json` defines which capability features are enabled for this connector

---

### `connector_credentials`

Purpose: stored authentication and credential data for user connectors.

#### Columns

* `id` UUID PK
* `user_connector_id` UUID NOT NULL FK -> `user_connectors.id`
* `credential_type` VARCHAR NOT NULL
* `encrypted_data` TEXT NOT NULL
* `expires_at` TIMESTAMP NULL
* `last_refreshed_at` TIMESTAMP NULL
* `refresh_status` VARCHAR NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique index on `user_connector_id`
* index on `expires_at`

#### Notes

* `encrypted_data` stores OAuth tokens, API keys, etc.
* Application-level encryption required for sensitive data

---

### `connector_sync_states`

Purpose: tracking data and state for connector synchronization operations.

#### Columns

* `id` UUID PK
* `user_connector_id` UUID NOT NULL FK -> `user_connectors.id`
* `sync_type` VARCHAR NOT NULL
* `provider_cursor` TEXT NULL
* `last_sync_at` TIMESTAMP NULL
* `sync_status` VARCHAR NOT NULL
* `items_synced` INTEGER NOT NULL DEFAULT 0
* `error_details_json` JSONB NULL
* `retry_count` INTEGER NOT NULL DEFAULT 0
* `next_retry_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`user_connector_id`, `sync_type`)
* index on `sync_status`
* index on `next_retry_at`

#### Notes

* `sync_type` examples: `incremental`, `full`, `delta`
* `provider_cursor` stores provider-specific pagination tokens

---

### `capability_execution_logs`

Purpose: audit trail and logging for all capability executions.

#### Columns

* `id` UUID PK
* `user_connector_id` UUID NOT NULL FK -> `user_connectors.id`
* `workspace_command_id` UUID NULL FK -> `workspace_commands.id`
* `execution_type` VARCHAR NOT NULL
* `execution_status` `capability_execution_status` NOT NULL
* `input_payload_json` JSONB NULL
* `output_payload_json` JSONB NULL
* `error_details_json` JSONB NULL
* `duration_ms` INTEGER NULL
* `provider_response_code` VARCHAR NULL
* `provider_request_id` VARCHAR NULL
* `linked_entity_type` VARCHAR NULL
* `linked_entity_id` UUID NULL
* `executed_at` TIMESTAMP NOT NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_connector_id`
* index on `workspace_command_id`
* index on `execution_status`
* index on `executed_at`
* composite index on (`user_connector_id`, `executed_at`)
* optional composite index on (`linked_entity_type`, `linked_entity_id`)

#### Notes

* Links capability executions to business entities (opportunities, activities, etc.)
* Provides complete audit trail for all external integrations

---

### `connector_configurations`

Purpose: schema and configuration data for capability providers.

#### Columns

* `id` UUID PK
* `capability_provider_id` UUID NOT NULL FK -> `capability_providers.id`
* `config_key` VARCHAR NOT NULL
* `config_value` JSONB NOT NULL
* `config_type` VARCHAR NOT NULL
* `is_required` BOOLEAN NOT NULL DEFAULT false
* `is_user_configurable` BOOLEAN NOT NULL DEFAULT true
* `description` TEXT NULL
* `validation_rules_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`capability_provider_id`, `config_key`)
* index on `config_type`
* index on `is_required`

#### Notes

* Defines setup requirements and validation for each provider
* `config_type` examples: `oauth_scope`, `api_endpoint`, `webhook_url`

---

### `referral_links`

Purpose: shareable referral handles owned by a user.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `code` VARCHAR NOT NULL UNIQUE
* `label` VARCHAR NULL
* `campaign_source` VARCHAR NULL
* `is_active` BOOLEAN NOT NULL DEFAULT true
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique index on `code`
* index on `user_id`
* composite index on (`user_id`, `is_active`)

#### Notes

* Referral links should identify the referrer, not grant rewards by themselves.
* Rewards should be created only after meaningful referred-user milestones.

---

### `referral_invites`

Purpose: optional explicit invitations sent or shared by a user.

#### Columns

* `id` UUID PK
* `referral_link_id` UUID NULL FK -> `referral_links.id`
* `referrer_user_id` UUID NOT NULL FK -> `users.id`
* `invitee_email_hash` TEXT NULL
* `channel` VARCHAR NULL
* `status` VARCHAR NOT NULL DEFAULT `sent`
* `sent_at` TIMESTAMP NULL
* `accepted_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `referral_link_id`
* index on `referrer_user_id`
* index on `status`

#### Notes

* Store hashed invitee email when possible; this table should not become an address book.
* Invites are attribution helpers, not reward triggers.

---

### `referral_attributions`

Purpose: durable relationship between a referrer and a referred user.

#### Columns

* `id` UUID PK
* `referral_link_id` UUID NULL FK -> `referral_links.id`
* `referral_invite_id` UUID NULL FK -> `referral_invites.id`
* `referrer_user_id` UUID NOT NULL FK -> `users.id`
* `referred_user_id` UUID NOT NULL FK -> `users.id`
* `attribution_source` VARCHAR NULL
* `attributed_at` TIMESTAMP NOT NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique index on `referred_user_id`
* index on `referrer_user_id`
* index on `referral_link_id`
* index on `referral_invite_id`

#### Notes

* A referred user should normally have one canonical referral attribution.
* Application logic should prevent self-referrals.

---

### `referral_milestones`

Purpose: meaningful progress events that can qualify a referral for rewards.

#### Columns

* `id` UUID PK
* `referral_attribution_id` UUID NOT NULL FK -> `referral_attributions.id`
* `milestone_type` `referral_milestone_type` NOT NULL
* `occurred_at` TIMESTAMP NOT NULL
* `source_entity_type` VARCHAR NULL
* `source_entity_id` UUID NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`referral_attribution_id`, `milestone_type`)
* index on `milestone_type`
* index on `occurred_at`

#### Notes

* Milestones are product outcomes such as onboarding completion or first completed cycle, not raw click events.

---

### `referral_rewards`

Purpose: reward grants produced by referral milestones.

#### Columns

* `id` UUID PK
* `referral_attribution_id` UUID NOT NULL FK -> `referral_attributions.id`
* `referral_milestone_id` UUID NULL FK -> `referral_milestones.id`
* `user_id` UUID NOT NULL FK -> `users.id`
* `reward_type` `reward_type` NOT NULL
* `feature_key` VARCHAR NULL
* `quantity` INTEGER NULL
* `status` VARCHAR NOT NULL DEFAULT `granted`
* `granted_at` TIMESTAMP NOT NULL
* `expires_at` TIMESTAMP NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `referral_attribution_id`
* index on `referral_milestone_id`
* index on (`user_id`, `reward_type`)

#### Notes

* One milestone may produce rewards for both referrer and referred user.
* Rewards that affect usage should create corresponding `growth_credits`.

---

### `growth_credits`

Purpose: additive allowance credits that extend plan limits for specific capabilities.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `referral_reward_id` UUID NULL FK -> `referral_rewards.id`
* `feature_key` VARCHAR NOT NULL
* `credit_type` `reward_type` NOT NULL
* `quantity_granted` INTEGER NOT NULL
* `quantity_used` INTEGER NOT NULL DEFAULT 0
* `status` `growth_credit_status` NOT NULL DEFAULT `available`
* `granted_at` TIMESTAMP NOT NULL
* `expires_at` TIMESTAMP NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `feature_key`
* composite index on (`user_id`, `feature_key`, `status`)
* index on `expires_at`

#### Notes

* Capability gating can consider unexpired available credits after evaluating base plan limits.
* Credits should be consumed idempotently to avoid double spending during retries.

---

### `goal_progress`

Purpose: rollup progress against a user's goal.

#### Columns

* `id` UUID PK
* `goal_id` UUID NOT NULL FK -> `goals.id`
* `user_id` UUID NOT NULL FK -> `users.id`
* `period_start` DATE NULL
* `period_end` DATE NULL
* `target_count` INTEGER NULL
* `completed_count` INTEGER NOT NULL DEFAULT 0
* `progress_percent` INTEGER NULL
* `metadata_json` JSONB NULL
* `computed_at` TIMESTAMP NOT NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `goal_id`
* index on `user_id`
* composite index on (`user_id`, `period_start`, `period_end`)

#### Notes

* This can be recomputed from activities, cycles, and tasks; persistence is useful for fast workspace and coaching reads.

---

### `weekly_targets`

Purpose: user-defined or AI-recommended weekly execution targets.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `goal_id` UUID NULL FK -> `goals.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `target_type` VARCHAR NOT NULL
* `target_count` INTEGER NOT NULL
* `week_start` DATE NOT NULL
* `week_end` DATE NOT NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `goal_id`
* index on `offering_id`
* composite index on (`user_id`, `week_start`, `target_type`)

#### Notes

* Examples of `target_type`: `outreach_sent`, `cycles_completed`, `followups_sent`.

---

### `momentum_states`

Purpose: latest or periodic momentum assessment for a user, goal, offering, or campaign.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `goal_id` UUID NULL FK -> `goals.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `campaign_id` UUID NULL FK -> `campaigns.id`
* `state_type` `momentum_state_type` NOT NULL
* `score` INTEGER NULL
* `reason` TEXT NULL
* `computed_at` TIMESTAMP NOT NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `goal_id`
* index on `offering_id`
* index on `campaign_id`
* composite index on (`user_id`, `computed_at`)

#### Notes

* Momentum can be computed from activities, tasks, opportunities, signals, cycles, and weekly targets.

---

### `coaching_nudges`

Purpose: product-native prompts that help users keep cycles moving.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `momentum_state_id` UUID NULL FK -> `momentum_states.id`
* `nudge_type` `coaching_nudge_type` NOT NULL
* `status` `coaching_nudge_status` NOT NULL DEFAULT `pending`
* `title` VARCHAR NOT NULL
* `body` TEXT NULL
* `linked_entity_type` VARCHAR NULL
* `linked_entity_id` UUID NULL
* `scheduled_for` TIMESTAMP NULL
* `delivered_at` TIMESTAMP NULL
* `acted_on_at` TIMESTAMP NULL
* `dismissed_at` TIMESTAMP NULL
* `expires_at` TIMESTAMP NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `momentum_state_id`
* index on `status`
* index on `scheduled_for`
* composite index on (`user_id`, `status`, `scheduled_for`)
* optional composite index on (`linked_entity_type`, `linked_entity_id`)

#### Notes

* Nudges should reference actionable product context whenever possible.
* Notification delivery can be added later; this table represents the coaching decision.

---

### `campaigns`

Purpose: strategic containers representing larger pursuit objectives that coordinate multiple execution streams.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `offering_id` UUID NULL FK -> `offerings.id`
* `goal_id` UUID NULL FK -> `goals.id`
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `objective` TEXT NULL
* `success_definition` TEXT NULL
* `timeframe_start` TIMESTAMP NULL
* `timeframe_end` TIMESTAMP NULL
* `status` `campaign_status` NOT NULL DEFAULT `planning`
* `priority_score` INTEGER NOT NULL DEFAULT 50
* `metrics_json` JSONB NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `offering_id`
* index on `goal_id`
* index on `status`
* composite index on (`user_id`, `status`, `priority_score`)
* index on `timeframe_start`
* index on `timeframe_end`

#### Notes

* `offering_id` should be populated when the campaign promotes a specific offering
* `goal_id` should be populated when the campaign advances a specific goal
* `metrics_json` stores campaign-level performance and momentum data
* Campaigns can exist without offering or goal for general pursuit objectives

---

### `action_lanes`

Purpose: coordinated execution streams or channels within a campaign, representing specific modes of pursuit.

#### Columns

* `id` UUID PK
* `campaign_id` UUID NOT NULL FK -> `campaigns.id`
* `lane_type` `action_lane_type` NOT NULL
* `title` VARCHAR NOT NULL
* `description` TEXT NULL
* `strategy` TEXT NULL
* `cadence_json` JSONB NULL
* `target_criteria_json` JSONB NULL
* `status` `action_lane_status` NOT NULL DEFAULT `active`
* `priority_score` INTEGER NOT NULL DEFAULT 50
* `metrics_json` JSONB NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `campaign_id`
* index on `lane_type`
* index on `status`
* composite index on (`campaign_id`, `status`, `priority_score`)
* index on `created_at`

#### Notes

* `cadence_json` stores timing rules, frequency settings, and scheduling preferences
* `target_criteria_json` stores audience filters, segment definitions, and targeting rules
* `metrics_json` stores lane-specific performance data and engagement metrics
* Each lane operates independently but contributes to the overall campaign objective

---

### `action_cycles`

Purpose: lane execution records within ActionLanes, representing one execution attempt against one target.

#### Columns

* `id` UUID PK
* `campaign_id` UUID NOT NULL FK -> `campaigns.id`
* `action_lane_id` UUID NOT NULL FK -> `action_lanes.id`
* `target_type` VARCHAR NOT NULL
* `target_id` UUID NOT NULL
* `action_type` VARCHAR NOT NULL
* `status` `action_cycle_status` NOT NULL DEFAULT `surfaced`
* `priority_score` INTEGER NOT NULL DEFAULT 50
* `execution_data_json` JSONB NULL
* `outcome_data_json` JSONB NULL
* `metadata_json` JSONB NULL
* `surfaced_at` TIMESTAMP NULL
* `pursuing_at` TIMESTAMP NULL
* `executed_at` TIMESTAMP NULL
* `confirmed_at` TIMESTAMP NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `campaign_id`
* index on `action_lane_id`
* composite index on (`target_type`, `target_id`)
* index on `status`
* composite index on (`campaign_id`, `status`, `priority_score`)
* index on `surfaced_at`
* index on `executed_at`

#### Notes

* `target_type` examples: `person`, `company`, `opportunity`, `discovered_target`
* `execution_data_json` stores message content, channel details, and execution parameters
* `outcome_data_json` stores results, responses, next actions, and follow-up requirements
* Action cycles are not the main product loop; they are only lane-level execution records
* The main product flow is `goal -> offering -> discovery -> campaign -> action lane execution -> results -> next prioritization`
* `campaign_id` should match the campaign implied by `action_lane_id`; this must be validated application-side if both values are accepted at write time

---

### `campaign_metrics`

Purpose: performance and momentum tracking across campaigns and lanes for AI decision-making and user coaching.

#### Columns

* `id` UUID PK
* `campaign_id` UUID NULL FK -> `campaigns.id`
* `action_lane_id` UUID NULL FK -> `action_lanes.id`
* `user_id` UUID NOT NULL FK -> `users.id`
* `metric_type` VARCHAR NOT NULL
* `metric_value` NUMERIC NOT NULL
* `metric_unit` VARCHAR NULL
* `period_start` TIMESTAMP NULL
* `period_end` TIMESTAMP NULL
* `comparison_value` NUMERIC NULL
* `trend_direction` VARCHAR NULL
* `computed_at` TIMESTAMP NOT NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `campaign_id`
* index on `action_lane_id`
* index on `user_id`
* index on `metric_type`
* composite index on (`campaign_id`, `metric_type`, `period_start`)
* composite index on (`action_lane_id`, `metric_type`, `period_start`)
* index on `computed_at`

#### Notes

* `metric_type` examples: `conversion_rate`, `engagement_score`, `momentum_indicator`, `response_rate`
* Either `campaign_id` or `action_lane_id` should be populated (not both null)
* Metrics are used by AI for lane prioritization, campaign coaching, and strategic recommendations
* `trend_direction` examples: `up`, `down`, `stable`, `volatile`

---

### `engagement_states`

Purpose: user engagement posture used for reactivation and lifecycle messaging.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `state_type` `engagement_state_type` NOT NULL
* `last_activity_at` TIMESTAMP NULL
* `last_cycle_completed_at` TIMESTAMP NULL
* `computed_at` TIMESTAMP NOT NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `state_type`
* composite index on (`user_id`, `computed_at`)

#### Notes

* This supports coaching and later lifecycle notification decisions.

---

### `notification_preferences`

Purpose: user-level preferences for coaching and product notifications.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `channel` VARCHAR NOT NULL
* `topic` VARCHAR NOT NULL
* `is_enabled` BOOLEAN NOT NULL DEFAULT true
* `quiet_hours_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* unique composite index on (`user_id`, `channel`, `topic`)
* index on `user_id`

#### Notes

* Examples of `channel`: `email`, `push`, `in_app`.
* Examples of `topic`: `coaching`, `goal_progress`, `reactivation`, `referral_rewards`.

---

### `reactivation_triggers`

Purpose: detected conditions that may create coaching nudges or lifecycle outreach.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `engagement_state_id` UUID NULL FK -> `engagement_states.id`
* `trigger_type` VARCHAR NOT NULL
* `linked_entity_type` VARCHAR NULL
* `linked_entity_id` UUID NULL
* `detected_at` TIMESTAMP NOT NULL
* `resolved_at` TIMESTAMP NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL
* `updated_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `engagement_state_id`
* index on `trigger_type`
* index on `detected_at`

#### Notes

* Examples: inactive after onboarding, stalled opportunity, missed weekly target, no cycle completed this week.

---

### `motivation_events`

Purpose: durable record of positive or progress-oriented events that can feed coaching.

#### Columns

* `id` UUID PK
* `user_id` UUID NOT NULL FK -> `users.id`
* `event_type` VARCHAR NOT NULL
* `linked_entity_type` VARCHAR NULL
* `linked_entity_id` UUID NULL
* `occurred_at` TIMESTAMP NOT NULL
* `metadata_json` JSONB NULL
* `created_at` TIMESTAMP NOT NULL

#### Indexes

* index on `user_id`
* index on `event_type`
* index on `occurred_at`
* optional composite index on (`linked_entity_type`, `linked_entity_id`)

#### Notes

* Examples: first cycle completed, weekly goal reached, referral reward earned, opportunity advanced.

---

## 4. Relationship Summary

### Ownership

* `users` owns:

  * authentication_identities
  * credentials (through authentication identities)
  * authentication_sessions
  * verification_tokens
  * companies
  * people
  * opportunities
  * offerings
  * goals
  * campaigns
  * ai_conversations
  * ai_context_summaries
  * ai_tasks
  * tags
  * notes
  * search_profiles
  * workspace_signals
  * opportunity_cycles
  * workspace_commands
  * user_connectors
  * connector_credentials (through user_connectors)
  * connector_sync_states (through user_connectors)
  * capability_execution_logs (through user_connectors)
  * subscriptions
  * usage_counters
  * referral_links
  * referral_invites
  * referral_attributions as referrer or referred user
  * referral_rewards
  * growth_credits
  * goal_progress
  * weekly_targets
  * momentum_states
  * coaching_nudges
  * engagement_states
  * notification_preferences
  * reactivation_triggers
  * motivation_events

### Commercial

* `plans` -> many `plan_features`
* `plans` -> many `subscriptions`
* `plans` -> many `model_access_policies`
* `users` -> many `subscriptions`
* `users` -> many `usage_counters`
* `users` -> many `growth_credits`
* `CapabilityGateService` evaluates active subscription, plan features, usage counters, growth credits, connector state, and feature flags
* `CapabilityCheckResult` is an API/service result, not a required persisted table
* `UpgradeReason` is represented by stable reason codes, not a required persisted table

### Authentication

* `users` -> many `authentication_identities`
* `authentication_identities` -> many `credentials`
* `users` -> many `authentication_sessions`
* `authentication_identities` -> many `authentication_sessions`
* `authentication_identities` -> many `verification_tokens`

### CRM

* `companies` -> many `people`
* `companies` -> many `opportunities`
* `opportunities` -> optional `primary_person_id`
* `opportunities` <-> `people` through `opportunity_people`
* `activities`, `tasks` can point to opportunity/company/person
* `notes` and `entity_tags` are polymorphic attachments

### Discovery

* `search_profiles` -> many `search_runs`
* `search_runs` -> many `discovered_opportunities`
* `discovered_opportunities` -> optional `companies`
* `discovered_opportunities` -> optional promoted `opportunities`
* `users` -> many `discovery_scans`
* `offerings` -> many optional `discovery_scans`
* `goals` -> many optional `discovery_scans`
* `campaigns` -> many optional `discovery_scans`
* `discovery_scans` -> many `discovery_provider_runs`
* `discovery_scans` -> many `discovery_targets`
* `discovery_targets` -> many `discovery_evidence`
* `discovery_targets` may store pre-promotion match metadata against existing `companies`, `people`, `opportunities`, or prior `discovery_targets`
* `discovery_targets` -> optional `companies`, `people`, and `opportunities` after promotion

### LinkedIn Connection Imports

* `users` -> many `connection_import_batches`
* `connection_import_batches` -> many `connection_records`
* `connection_records` -> optional canonical `people` (after promotion/deduplication)
* `connection_import_batches` -> many `connection_segments`
* `connection_segments` -> many `connection_segment_members`
* `connection_segment_members` -> many `connection_records`
* `connection_records` may generate campaign suggestions based on AI relevance scoring
* `connection_segments` may generate campaign suggestions for entire groups

### Offerings, Goals, and Campaigns

* `users` -> many `offerings`
* `users` -> many `offering_proposals`
* `ai_conversations` -> many optional `offering_proposals`
* `offering_proposals` -> optional confirmed `offerings`
* `offerings` -> many `offering_positionings`
* `offerings` -> many `offering_assets`
* `offering_positionings` -> many optional `offering_assets`
* `offerings` -> many optional `goals`
* `offerings` -> many optional `campaigns`
* `offerings` -> many optional `campaigns`
* `goals` -> many `campaigns`
* `goals` -> many `campaigns`
* `campaigns` -> many `action_lanes`
* `action_lanes` -> many `action_cycles`
* `campaigns` -> many `opportunities`
* `campaigns` -> many `opportunities`

### AI Conversation / Context

* `users` -> many `ai_conversations`
* `ai_conversations` -> many `ai_conversation_messages`
* `ai_conversations` -> many `ai_context_summaries`
* `ai_conversations` -> many `ai_tasks`
* `offerings` -> many optional `ai_conversations`
* `offerings` -> many optional `ai_context_summaries`
* `offerings` -> many optional `ai_tasks`
* `opportunities` -> many optional `ai_conversations`
* `opportunities` -> many optional `ai_context_summaries`
* `opportunities` -> many optional `ai_tasks`

### Workspace Orchestration

* `users` -> many `workspace_signals`
* `users` -> many `opportunity_cycles`
* `users` -> many `workspace_commands`
* `workspace_signals` -> zero or more originating `opportunity_cycles`
* `opportunity_cycles` -> optional `workspace_signals`
* `opportunity_cycles` -> optional `offerings`
* `opportunity_cycles` -> optional `goals`
* `opportunity_cycles` -> optional `campaigns`
* `opportunity_cycles` -> optional `opportunities`
* `opportunity_cycles` -> optional `tasks`
* `opportunity_cycles` -> optional `discovered_opportunities`
* `opportunity_cycles` -> optional `ai_conversations`
* `opportunity_cycles` -> many `workspace_commands`
* `workspace_commands` -> optional `ai_conversations`

### Capability Integration

* `capabilities` -> many `capability_providers`
* `capability_providers` -> many `user_connectors`
* `capability_providers` -> many `connector_configurations`
* `users` -> many `user_connectors` (one per capability type)
* `user_connectors` -> one `connector_credentials`
* `user_connectors` -> many `connector_sync_states`
* `user_connectors` -> many `capability_execution_logs`
* `workspace_commands` -> optional `capability_execution_logs`
* `capability_execution_logs` may reference business entities (opportunities, activities, people)

### Growth, Referrals, and Rewards

* `users` -> many `referral_links`
* `referral_links` -> many optional `referral_invites`
* `referral_links` -> many optional `referral_attributions`
* `referral_invites` -> optional `referral_attributions`
* `referral_attributions` connect one referrer user to one referred user
* `referral_attributions` -> many `referral_milestones`
* `referral_attributions` -> many `referral_rewards`
* `referral_milestones` -> optional many `referral_rewards`
* `referral_rewards` -> optional many `growth_credits`
* `users` -> many `growth_credits`

### Coaching, Momentum, and Engagement

* `goals` -> many `goal_progress`
* `users` -> many `weekly_targets`
* `goals` -> optional many `weekly_targets`
* `offerings` -> optional many `weekly_targets`
* `users` -> many `momentum_states`
* `goals`, `offerings`, and `campaigns` -> optional many `momentum_states`
* `momentum_states` -> many `coaching_nudges`
* `users` -> many `coaching_nudges`
* `users` -> many `engagement_states`
* `engagement_states` -> many `reactivation_triggers`
* `users` -> many `notification_preferences`
* `users` -> many `motivation_events`

---

## 5. Required vs Optional Field Guidance

## Required in Practice

These should almost always be required:

### `companies`

* user_id
* name
* company_type

### `people`

* user_id
* full_name

### `opportunities`

* user_id
* company_id
* title
* opportunity_type
* stage

### `activities`

* user_id
* activity_type
* occurred_at

### `tasks`

* user_id
* title
* status
* priority

### `search_profiles`

* user_id
* name
* search_profile_type

### `search_runs`

* search_profile_id
* started_at
* status

### `discovered_opportunities`

* search_run_id
* source_type
* title
* lifecycle_status

### `workspace_signals`

* user_id
* source_type
* title
* importance
* status
* priority_score
* recommended_workspace_mode

### `opportunity_cycles`

* user_id
* phase
* status
* workspace_mode
* title
* started_at

### `workspace_commands`

* user_id
* command_type
* status

### `capabilities`

* capability_type
* name

### `capability_providers`

* capability_id
* provider_name
* display_name
* auth_type

### `user_connectors`

* user_id
* capability_id
* capability_provider_id
* status

### `connector_credentials`

* user_connector_id
* credential_type
* encrypted_data

### `connector_sync_states`

* user_connector_id
* sync_type
* sync_status

### `capability_execution_logs`

* user_connector_id
* execution_type
* execution_status
* executed_at

### `connector_configurations`

* capability_provider_id
* config_key
* config_value
* config_type

### `referral_links`

* user_id
* code
* is_active

### `referral_attributions`

* referrer_user_id
* referred_user_id
* attributed_at

### `referral_milestones`

* referral_attribution_id
* milestone_type
* occurred_at

### `referral_rewards`

* referral_attribution_id
* user_id
* reward_type
* granted_at

### `growth_credits`

* user_id
* feature_key
* credit_type
* quantity_granted
* quantity_used
* status
* granted_at

### `goal_progress`

* goal_id
* user_id
* completed_count
* computed_at

### `weekly_targets`

* user_id
* target_type
* target_count
* week_start
* week_end

### `momentum_states`

* user_id
* state_type
* computed_at

### `coaching_nudges`

* user_id
* nudge_type
* status
* title

### `engagement_states`

* user_id
* state_type
* computed_at

---

## 6. Important Indexes for MVP

These are the most important ones to include early.

### User-scoped Lookups

* `companies(user_id)`
* `people(user_id)`
* `opportunities(user_id)`
* `offerings(user_id)`
* `offering_proposals(user_id)`
* `goals(user_id)`
* `campaigns(user_id)`
* `ai_conversations(user_id)`
* `search_profiles(user_id)`
* `tags(user_id)`

### Workflow Lookups

* `opportunities(stage)`
* `opportunities(next_action_date)`
* `tasks(status, due_at)`
* `activities(occurred_at)`

### Relationship Lookups

* `people(company_id)`
* `opportunities(company_id)`
* `goals(offering_id)`
* `campaigns(goal_id)`
* `campaigns(offering_id)`
* `ai_conversations(offering_id)`
* `ai_context_summaries(offering_id)`
* `activities(opportunity_id)`
* `activities(person_id)`

### Commercial Lookups

* `subscriptions(user_id, status)`
* `plan_features(plan_id, feature_key)`
* `usage_counters(user_id, feature_key, usage_period_start, usage_period_end)`
* `growth_credits(user_id, feature_key, status)`

### Authentication Lookups

* `authentication_identities(email_normalized)`
* `authentication_sessions(user_id, status)`
* `verification_tokens(token_type, expires_at)`

### Discovery Lookups

* `search_runs(search_profile_id, started_at)`
* `discovered_opportunities(search_run_id, lifecycle_status)`
* `discovered_opportunities(posted_at)`
* `discovery_scans(user_id, status, created_at)`
* `discovery_scans(campaign_id)`
* `discovery_provider_runs(discovery_scan_id, provider_key)`
* `discovery_provider_runs(provider_key, status, created_at)`
* `discovery_targets(scan_id, status)`
* `discovery_targets(user_id, dedupe_key)`
* `discovery_targets(email)`
* `discovery_targets(company_id)`
* `discovery_targets(person_id)`
* `discovery_targets(opportunity_id)`
* `discovery_evidence(discovery_target_id)`
* `discovery_evidence(source_url)`

### LinkedIn Connection Import Lookups

* `connection_import_batches(user_id, status, created_at)`
* `connection_import_batches(user_id, status)`
* `connection_records(import_batch_id)`
* `connection_records(user_id, person_id)`
* `connection_records(user_id, email)`
* `connection_records(user_id, company, title)`
* `connection_records(user_id, strength)`
* `connection_records(user_id, relevance_score DESC)`
* `connection_records(user_id, is_potential_referral)`
* `connection_segments(import_batch_id, segment_type, priority_rank)`
* `connection_segments(user_id, segment_type, priority_rank)`
* `connection_segment_members(segment_id, match_score DESC)`
* `connection_segment_members(connection_id)`

### Workspace Orchestration Lookups

* `workspace_signals(user_id, status, priority_score)`
* `workspace_signals(source_type, source_id)`
* `opportunity_cycles(offering_id)`
* `opportunity_cycles(goal_id)`
* `opportunity_cycles(campaign_id)`
* `opportunity_cycles(user_id, status, priority_score)`
* `opportunity_cycles(user_id, status, updated_at)`
* `workspace_commands(user_id, status, created_at)`
* `workspace_commands(opportunity_cycle_id)`

### Capability Integration Lookups

* `user_connectors(user_id, status)`
* `user_connectors(user_id, capability_id)`
* `capability_providers(capability_id, is_active)`
* `connector_credentials(user_connector_id, expires_at)`
* `connector_sync_states(user_connector_id, sync_status)`
* `capability_execution_logs(user_connector_id, executed_at)`
* `capability_execution_logs(workspace_command_id)`
* `connector_configurations(capability_provider_id, is_required)`

### Growth and Referral Lookups

* `referral_links(code)`
* `referral_links(user_id, is_active)`
* `referral_attributions(referred_user_id)`
* `referral_attributions(referrer_user_id)`
* `referral_milestones(referral_attribution_id, milestone_type)`
* `referral_rewards(user_id, reward_type)`

### Coaching and Momentum Lookups

* `goal_progress(goal_id)`
* `weekly_targets(user_id, week_start, target_type)`
* `momentum_states(user_id, computed_at)`
* `coaching_nudges(user_id, status, scheduled_for)`
* `engagement_states(user_id, computed_at)`
* `reactivation_triggers(user_id, detected_at)`
* `motivation_events(user_id, occurred_at)`

---

## 7. Constraints and Business Rules

These are important even if some are enforced at application level instead of DB level.

### Subscriptions

* a user may have many subscriptions historically
* app should determine one active subscription at a time

### Authentication

* a user may have many authentication sessions over time
* refresh tokens should be stored only as hashes
* a verification token may be consumed once
* app should determine which authentication identity is primary for login UX

### Opportunity Relationships

* an opportunity must belong to one company
* an opportunity may have zero or one primary person
* an opportunity may have many linked people through `opportunity_people`

### Tags

* tag names are unique per user

### Usage Counters

* one row per user + feature + time window
* usage increments should be idempotent when capability execution retries are possible
* effective allowance is base plan entitlement plus eligible growth credits

### Capability Gating

* backend services must call the capability gate before executing expensive or premium capabilities
* the gate should return allow/block, current usage, remaining allowance, and upgrade reason metadata
* `CapabilityGateService`, `CapabilityCheckResult`, and `WorkspaceState` are service/API concepts, not required persisted tables
* AI, discovery, outreach, connector, workspace, and communication services should all use the same gating path

### Discovered Opportunity Promotion

* a discovered opportunity may be promoted once
* a promoted opportunity may reference its source discovered opportunity

### Offering Context

* an offering may exist before any goals, campaigns, or opportunities
* goals and campaigns should store `offering_id` when they are created to advance a known offering
* campaigns should preserve `offering_id` even though it is inferable through goals, because workspace and reporting queries should not need to join through goals
* legacy strategic campaigns may continue to preserve `offering_id` during transition, but new orchestration should consolidate around `campaigns`
* opportunity cycles should preserve `offering_id` whenever known, because the Active Workspace needs direct access to the commercial context being advanced

### Notes and Entity Tags

* polymorphic relations require application-level validation of referenced entity existence

### Workspace Orchestration

* a signal should be created only when it represents meaningful user attention, not every raw event
* signal deduplication should suppress repeated source records unless the source materially changes
* a cycle should usually reference at least one contextual entity or originating signal
* a cycle should preserve offering context directly when the active offering can be inferred from a goal, campaign, opportunity, conversation, or command input
* the foreground active cycle is selected by application logic, even if multiple active cycles exist
* allowed actions must be recomputed or validated server-side before execution
* every command that mutates domain state should produce or update a durable domain record such as Activity, Task, Opportunity, Campaign, AIConversation, or WorkspaceCommand result
* WorkspaceState is an API composition, not a required persisted table

### Capability Integration

* a user may have only one connector per capability type (e.g., one email connector)
* connector credentials must be encrypted at rest
* capability execution logs must be created for all external API calls
* workspace commands that require external capabilities must route through user connectors
* connector sync state must track incremental sync cursors for efficiency
* capability providers must implement the same interface defined by their capability type
* connector configurations must validate required fields before connector activation
* failed capability executions should trigger retry logic with exponential backoff

### Growth and Referrals

* referral clicks or shares do not directly create rewards
* referral rewards are granted only after meaningful milestones
* a referred user should have at most one canonical referral attribution
* application logic should prevent self-referrals
* growth credits created from rewards should expire or be consumed according to their grant terms

### Coaching and Momentum

* momentum state should be computed from durable activity, task, cycle, opportunity, and target data
* coaching nudges should reference actionable context when possible
* notification preferences should be checked before external notification delivery
* reactivation triggers should resolve when the user completes the relevant action or the trigger becomes stale

---

## 8. MVP Table Set

These are the tables I recommend for the first real schema pass:

* `users`
* `authentication_identities`
* `credentials`
* `authentication_sessions`
* `verification_tokens`
* `plans`
* `plan_features`
* `subscriptions`
* `usage_counters`
* `model_access_policies`
* `companies`
* `people`
* `opportunities`
* `opportunity_people`
* `activities`
* `tasks`
* `notes`
* `tags`
* `entity_tags`
* `search_profiles`
* `search_runs`
* `discovered_opportunities`
* `offerings`
* `offering_positionings`
* `offering_assets`
* `goals`
* `campaigns`
* `action_lanes`
* `action_cycles`
* `campaign_metrics`
* `campaigns`
* `ai_conversations`
* `ai_conversation_messages`
* `ai_context_summaries`
* `ai_tasks`
* `workspace_signals`
* `opportunity_cycles`
* `workspace_commands`
* `capabilities`
* `capability_providers`
* `user_connectors`
* `connector_credentials`
* `connector_sync_states`
* `capability_execution_logs`
* `connector_configurations`
* `referral_links`
* `referral_attributions`
* `referral_milestones`
* `referral_rewards`
* `growth_credits`
* `goal_progress`
* `weekly_targets`
* `momentum_states`
* `coaching_nudges`

That is a strong MVP backbone with first-class offering context, workspace orchestration, capability-based integration architecture, bounded free usage, referral rewards, and product-native momentum coaching.

---

## 9. Tables Explicitly Deferred

These should come later:

* `sequences`
* `sequence_steps`
* `message_templates`
* `campaign_enrollments`
* `approval_items`
* `delivery_logs`
* `response_events`
* `suppression_rules`
* `resume_masters`
* `resume_fragments`
* `positioning_profiles`
* `resume_variants`
* `repositories`
* `opportunity_matches`
* `application_fields`
* `application_artifacts`
* `application_audit_events`
* `referral_invites`
* `engagement_states`
* `notification_preferences`
* `reactivation_triggers`
* `motivation_events`

---

## 10. Windsurf-Ready Prompt for Prisma Generation

Here is the next prompt you can feed Windsurf:

```text
Using the following logical relational data model, generate a clean Prisma schema for PostgreSQL for the MVP of Opportunity OS.

Models to include:
- User
- AuthenticationIdentity
- Credential
- AuthenticationSession
- VerificationToken
- Plan
- PlanFeature
- Subscription
- UsageCounter
- ModelAccessPolicy
- Company
- Person
- Opportunity
- OpportunityPerson
- Activity
- Task
- Note
- Tag
- EntityTag
- SearchProfile
- SearchRun
- DiscoveredOpportunity
- DiscoveryScan
- DiscoveryTarget
- DiscoveryEvidence
- Offering
- OfferingPositioning
- OfferingAsset
- Goal
- Campaign
- AIConversation
- AIConversationMessage
- AIContextSummary
- AITask
- WorkspaceSignal
- OpportunityCycle
- WorkspaceCommand
- Capability
- CapabilityProvider
- UserConnector
- ConnectorCredential
- ConnectorSyncState
- CapabilityExecutionLog
- ConnectorConfiguration
- ReferralLink
- ReferralAttribution
- ReferralMilestone
- ReferralReward
- GrowthCredit
- GoalProgress
- WeeklyTarget
- MomentumState
- CoachingNudge

Requirements:
- Use UUID ids
- Add createdAt / updatedAt where appropriate
- Use enums for stable state fields
- Use Prisma relation fields cleanly
- Add @@index and @@unique where appropriate
- Keep field names in Prisma-friendly camelCase while preserving the logical model
- Use PostgreSQL provider
- Keep the schema extensible for later additions like campaigns, resumes, repositories, and application sessions
- Include workspace orchestration enums for cycle phase/status, workspace mode, signal status/importance, and command status
- Include capability integration enums for capability type, connector status, and capability execution status
- Keep authentication separate from commercial subscription state
- Keep CapabilityGateService, CapabilityCheckResult, UpgradeReason, and WorkspaceState as service/API concepts unless there is a clear audit-log requirement to persist them
- Model the capability-first architecture where UserConnectors link Capabilities to CapabilityProviders
- Ensure WorkspaceCommands can route through UserConnectors to CapabilityProviders
- Preserve offering context by adding optional offeringId references on Goal, Campaign, OpportunityCycle, AIConversation, AIContextSummary, and AITask
- Include commercial gating tables needed for bounded free usage: Plan, PlanFeature, Subscription, UsageCounter, ModelAccessPolicy, and GrowthCredit
- Include referral reward tables for milestone-based rewards: ReferralLink, ReferralAttribution, ReferralMilestone, ReferralReward
- Include coaching tables for early momentum support: GoalProgress, WeeklyTarget, MomentumState, CoachingNudge
- Do not overmodel deferred features yet

Important modeling notes:
- Opportunity belongs to one Company and one User
- Opportunity may reference one primary Person
- Opportunity has many related People through OpportunityPerson
- Notes are polymorphic via linkedEntityType + linkedEntityId
- EntityTag is polymorphic via entityType + entityId
- DiscoveredOpportunity belongs to one SearchRun and may promote to one Opportunity
- Offering belongs to one User and may have many OfferingPositionings, OfferingAssets, Goals, Campaigns, AIConversations, AIContextSummaries, AITasks, and OpportunityCycles
- Goal belongs to one User when authenticated, may reference one Offering, and has many Campaigns and OpportunityCycles
- Campaign belongs to one Goal, may reference one Offering, and has many Opportunities and OpportunityCycles
- PlanFeature and ModelAccessPolicy are scoped by Plan
- CapabilityGateService evaluates active subscription, PlanFeature entitlement, UsageCounter consumption, GrowthCredit allowance, connector state, and feature flags
- UpgradeReason is an enum/reason code used in API responses, not a persisted table
- AuthenticationIdentity belongs to one User
- AuthenticationSession belongs to one User and may optionally reference one AuthenticationIdentity
- VerificationToken belongs to a User and/or AuthenticationIdentity depending on flow
- UsageCounter is scoped by User + featureKey + billing period
- GrowthCredit is scoped by User + featureKey and can extend effective allowance
- Referral rewards are created only from meaningful milestones, not raw clicks
- MomentumState and CoachingNudge are user-owned records that may optionally reference goals, offerings, campaigns, or other linked entities
- WorkspaceSignal belongs to one User and may reference a source entity through sourceType + sourceId
- AIConversation belongs to one User or guest session and may optionally reference Offering and Opportunity
- AIContextSummary belongs to one User and may optionally reference AIConversation, Offering, and Opportunity
- AITask belongs to one User and may optionally reference AIConversation, AIContextSummary, Offering, and Opportunity
- OpportunityCycle belongs to one User and may optionally reference WorkspaceSignal, Offering, Goal, Campaign, Opportunity, Task, DiscoveredOpportunity, and AIConversation
- WorkspaceCommand belongs to one User and may optionally reference OpportunityCycle and AIConversation
- WorkspaceState is an API composition, not a persisted table
- Capability has many CapabilityProviders implementing the same interface
- CapabilityProvider belongs to one Capability and has many UserConnectors
- UserConnector belongs to one User and links one Capability to one CapabilityProvider (one connector per capability type per user)
- UserConnector has one ConnectorCredential for authentication
- UserConnector has many ConnectorSyncStates for different sync types
- UserConnector has many CapabilityExecutionLogs for audit trail
- CapabilityExecutionLog belongs to one UserConnector and may optionally reference one WorkspaceCommand
- CapabilityExecutionLog may link to business entities through linkedEntityType + linkedEntityId

After generating the Prisma schema, also provide:
1. a short explanation of key modeling choices
2. any areas where application-level validation is still required
3. suggested first migration and seed strategy
```

If you want, I can also generate the **Prisma schema draft** directly here.
