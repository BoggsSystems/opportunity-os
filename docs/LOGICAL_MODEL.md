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

* Examples: `free`, `pro`, `power`

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

  * max scans
  * max resume variants
  * max active campaigns

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
  * tags
  * notes
  * search_profiles
  * subscriptions
  * usage_counters

### Commercial

* `plans` -> many `plan_features`
* `plans` -> many `subscriptions`
* `plans` -> many `model_access_policies`
* `users` -> many `subscriptions`
* `users` -> many `usage_counters`

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

---

## 6. Important Indexes for MVP

These are the most important ones to include early.

### User-scoped Lookups

* `companies(user_id)`
* `people(user_id)`
* `opportunities(user_id)`
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
* `activities(opportunity_id)`
* `activities(person_id)`

### Commercial Lookups

* `subscriptions(user_id, status)`
* `plan_features(plan_id, feature_key)`
* `usage_counters(user_id, feature_key, usage_period_start, usage_period_end)`

### Authentication Lookups

* `authentication_identities(email_normalized)`
* `authentication_sessions(user_id, status)`
* `verification_tokens(token_type, expires_at)`

### Discovery Lookups

* `search_runs(search_profile_id, started_at)`
* `discovered_opportunities(search_run_id, lifecycle_status)`
* `discovered_opportunities(posted_at)`

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

### Discovered Opportunity Promotion

* a discovered opportunity may be promoted once
* a promoted opportunity may reference its source discovered opportunity

### Notes and Entity Tags

* polymorphic relations require application-level validation of referenced entity existence

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

That is a strong MVP backbone.

---

## 9. Tables Explicitly Deferred

These should come later:

* `campaigns`
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
* `repository_analyses`
* `project_evidence`
* `opportunity_matches`
* `application_sessions`
* `application_fields`
* `application_artifacts`
* `application_audit_events`
* `ai_summaries`
* `opportunity_recommendations`
* `metric_snapshots`

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

Requirements:
- Use UUID ids
- Add createdAt / updatedAt where appropriate
- Use enums for stable state fields
- Use Prisma relation fields cleanly
- Add @@index and @@unique where appropriate
- Keep field names in Prisma-friendly camelCase while preserving the logical model
- Use PostgreSQL provider
- Keep the schema extensible for later additions like campaigns, resumes, repositories, and application sessions
- Keep authentication separate from commercial subscription state
- Do not overmodel deferred features yet

Important modeling notes:
- Opportunity belongs to one Company and one User
- Opportunity may reference one primary Person
- Opportunity has many related People through OpportunityPerson
- Notes are polymorphic via linkedEntityType + linkedEntityId
- EntityTag is polymorphic via entityType + entityId
- DiscoveredOpportunity belongs to one SearchRun and may promote to one Opportunity
- PlanFeature and ModelAccessPolicy are scoped by Plan
- AuthenticationIdentity belongs to one User
- AuthenticationSession belongs to one User and may optionally reference one AuthenticationIdentity
- VerificationToken belongs to a User and/or AuthenticationIdentity depending on flow
- UsageCounter is scoped by User + featureKey + billing period

After generating the Prisma schema, also provide:
1. a short explanation of key modeling choices
2. any areas where application-level validation is still required
3. suggested first migration and seed strategy
```

If you want, I can also generate the **Prisma schema draft** directly here.
