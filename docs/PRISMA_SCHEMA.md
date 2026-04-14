# Prisma Schema Draft

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SubscriptionStatus {
  trialing
  active
  past_due
  canceled
  expired
}

enum FeatureAccessLevel {
  disabled
  enabled
  limited
  premium
}

enum OpportunityStage {
  new
  targeted
  outreach_sent
  applied
  conversation_started
  interviewing
  awaiting_decision
  closed_won
  closed_lost
}

enum ActivityType {
  linkedin_message
  email
  call
  interview
  application_submitted
  meeting
  follow_up
  note_event
  other
}

enum TaskStatus {
  open
  in_progress
  done
  canceled
}

enum TaskPriority {
  low
  medium
  high
  urgent
}

enum CompanyType {
  employer
  prospect
  recruiter_agency
  startup
  consulting_target
  other
}

enum OpportunityType {
  job
  contract
  consulting
  networking
  other
}

enum DiscoveredOpportunityStatus {
  new
  reviewed
  shortlisted
  promoted
  dismissed
  watchlisted
}

enum SearchProfileType {
  jobs
  companies
  people
  mixed
}

model User {
  id            String         @id @default(uuid()) @db.Uuid
  email         String         @unique
  fullName      String?
  timezone      String?
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  subscriptions Subscription[]
  usageCounters UsageCounter[]

  companies     Company[]
  people        Person[]
  opportunities Opportunity[]
  activities    Activity[]
  tasks         Task[]
  notes         Note[]
  tags          Tag[]
  searchProfiles SearchProfile[]

  @@map("users")
}

model Plan {
  id                String              @id @default(uuid()) @db.Uuid
  code              String              @unique
  name              String
  description       String?
  monthlyPriceCents Int                 @default(0)
  annualPriceCents  Int                 @default(0)
  currency          String              @default("USD")
  isActive          Boolean             @default(true)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  planFeatures        PlanFeature[]
  subscriptions       Subscription[]
  modelAccessPolicies ModelAccessPolicy[]

  @@map("plans")
}

model PlanFeature {
  id          String             @id @default(uuid()) @db.Uuid
  planId      String             @db.Uuid
  featureKey  String
  accessLevel FeatureAccessLevel
  configJson  Json?
  createdAt   DateTime           @default(now())

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, featureKey])
  @@index([featureKey])
  @@map("plan_features")
}

model Subscription {
  id                     String             @id @default(uuid()) @db.Uuid
  userId                 String             @db.Uuid
  planId                 String             @db.Uuid
  provider               String?
  providerCustomerId     String?
  providerSubscriptionId String?
  status                 SubscriptionStatus
  billingInterval        String?
  startedAt              DateTime
  currentPeriodStart     DateTime?
  currentPeriodEnd       DateTime?
  cancelAtPeriodEnd      Boolean            @default(false)
  trialEndsAt            DateTime?
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan Plan @relation(fields: [planId], references: [id], onDelete: Restrict)

  @@index([userId])
  @@index([planId])
  @@index([status])
  @@unique([providerSubscriptionId])
  @@map("subscriptions")
}

model UsageCounter {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @db.Uuid
  featureKey       String
  usagePeriodStart DateTime @db.Date
  usagePeriodEnd   DateTime @db.Date
  usedCount        Int      @default(0)
  resetAt          DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, featureKey, usagePeriodStart, usagePeriodEnd])
  @@index([userId])
  @@index([featureKey])
  @@map("usage_counters")
}

model ModelAccessPolicy {
  id                   String   @id @default(uuid()) @db.Uuid
  planId               String   @db.Uuid
  featureKey           String
  modelTier            String
  maxTokensPerRequest  Int?
  maxRequestsPerPeriod Int?
  fallbackModelTier    String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, featureKey])
  @@index([featureKey])
  @@map("model_access_policies")
}

model Company {
  id          String      @id @default(uuid()) @db.Uuid
  userId      String      @db.Uuid
  name        String
  domain      String?
  website     String?
  linkedinUrl String?
  industry    String?
  sizeBand    String?
  geography   String?
  companyType CompanyType @default(prospect)
  description String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  people        Person[]
  opportunities Opportunity[]
  activities    Activity[]

  @@index([userId])
  @@index([name])
  @@index([companyType])
  @@index([userId, companyType])
  @@map("companies")
}

model Person {
  id                   String    @id @default(uuid()) @db.Uuid
  userId               String    @db.Uuid
  companyId            String?   @db.Uuid
  firstName            String?
  lastName             String?
  fullName             String
  title                String?
  email                String?
  phone                String?
  linkedinUrl          String?
  githubUrl            String?
  location             String?
  contactSource        String?
  relationshipStrength Int?
  notesSummary         String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user                 User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  company              Company?            @relation(fields: [companyId], references: [id], onDelete: SetNull)
  primaryOpportunities Opportunity[]       @relation("PrimaryPersonOpportunities")
  opportunityLinks     OpportunityPerson[]
  activities           Activity[]
  tasks                Task[]

  @@index([userId])
  @@index([companyId])
  @@index([fullName])
  @@index([email])
  @@index([userId, companyId])
  @@map("people")
}

model Opportunity {
  id                           String           @id @default(uuid()) @db.Uuid
  userId                       String           @db.Uuid
  companyId                    String           @db.Uuid
  primaryPersonId              String?          @db.Uuid
  sourceDiscoveredOpportunityId String?         @db.Uuid
  title                        String
  opportunityType              OpportunityType  @default(job)
  stage                        OpportunityStage @default(new)
  status                       String?
  source                       String?
  priority                     String?
  fitScore                     Int?
  qualificationScore           Int?
  summary                      String?
  nextAction                   String?
  nextActionDate               DateTime?
  estimatedValueCents          Int?
  closeProbability             Int?
  createdAt                    DateTime         @default(now())
  updatedAt                    DateTime         @updatedAt

  user              User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  company           Company               @relation(fields: [companyId], references: [id], onDelete: Restrict)
  primaryPerson     Person?               @relation("PrimaryPersonOpportunities", fields: [primaryPersonId], references: [id], onDelete: SetNull)
  sourceDiscoveredOpportunity DiscoveredOpportunity? @relation("PromotedOpportunitySource", fields: [sourceDiscoveredOpportunityId], references: [id], onDelete: SetNull)

  opportunityPeople OpportunityPerson[]
  activities        Activity[]
  tasks             Task[]

  promotedFrom DiscoveredOpportunity[] @relation("PromotedOpportunity")

  @@index([userId])
  @@index([companyId])
  @@index([primaryPersonId])
  @@index([stage])
  @@index([opportunityType])
  @@index([nextActionDate])
  @@index([userId, stage])
  @@index([userId, companyId])
  @@map("opportunities")
}

model OpportunityPerson {
  id                String   @id @default(uuid()) @db.Uuid
  opportunityId     String   @db.Uuid
  personId          String   @db.Uuid
  roleInOpportunity String
  createdAt         DateTime @default(now())

  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  person      Person      @relation(fields: [personId], references: [id], onDelete: Cascade)

  @@unique([opportunityId, personId, roleInOpportunity])
  @@index([opportunityId])
  @@index([personId])
  @@map("opportunity_people")
}

model Activity {
  id          String       @id @default(uuid()) @db.Uuid
  userId      String       @db.Uuid
  opportunityId String?    @db.Uuid
  companyId   String?      @db.Uuid
  personId    String?      @db.Uuid
  activityType ActivityType
  channel     String?
  direction   String?
  subject     String?
  bodySummary String?
  occurredAt  DateTime
  outcome     String?
  metadataJson Json?
  createdAt   DateTime     @default(now())

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  company     Company?     @relation(fields: [companyId], references: [id], onDelete: SetNull)
  person      Person?      @relation(fields: [personId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([opportunityId])
  @@index([companyId])
  @@index([personId])
  @@index([occurredAt])
  @@index([activityType])
  @@index([userId, occurredAt])
  @@map("activities")
}

model Task {
  id          String       @id @default(uuid()) @db.Uuid
  userId      String       @db.Uuid
  opportunityId String?    @db.Uuid
  companyId   String?      @db.Uuid
  personId    String?      @db.Uuid
  title       String
  description String?
  dueAt       DateTime?
  status      TaskStatus   @default(open)
  priority    TaskPriority @default(medium)
  taskType    String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  completedAt DateTime?

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  company     Company?     @relation(fields: [companyId], references: [id], onDelete: SetNull)
  person      Person?      @relation(fields: [personId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([opportunityId])
  @@index([personId])
  @@index([dueAt])
  @@index([status])
  @@index([userId, status, dueAt])
  @@map("tasks")
}

model Note {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @db.Uuid
  linkedEntityType String
  linkedEntityId   String   @db.Uuid
  noteType         String?
  text             String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([linkedEntityType, linkedEntityId])
  @@index([createdAt])
  @@map("notes")
}

model Tag {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  name      String
  color     String?
  category  String?
  createdAt DateTime @default(now())

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  entityTags EntityTag[]

  @@unique([userId, name])
  @@index([userId])
  @@map("tags")
}

model EntityTag {
  id         String   @id @default(uuid()) @db.Uuid
  tagId      String   @db.Uuid
  entityType String
  entityId   String   @db.Uuid
  createdAt  DateTime @default(now())

  tag Tag @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([tagId, entityType, entityId])
  @@index([entityType, entityId])
  @@index([tagId])
  @@map("entity_tags")
}

model SearchProfile {
  id                String            @id @default(uuid()) @db.Uuid
  userId            String            @db.Uuid
  name              String
  searchProfileType SearchProfileType @default(mixed)
  queryText         String?
  filtersJson       Json?
  cadence           String?
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  searchRuns SearchRun[]

  @@index([userId])
  @@index([isActive])
  @@index([userId, isActive])
  @@map("search_profiles")
}

model SearchRun {
  id                String   @id @default(uuid()) @db.Uuid
  searchProfileId   String   @db.Uuid
  startedAt         DateTime
  completedAt       DateTime?
  status            String
  resultCount       Int      @default(0)
  highPriorityCount Int      @default(0)
  createdAt         DateTime @default(now())

  searchProfile SearchProfile         @relation(fields: [searchProfileId], references: [id], onDelete: Cascade)
  discoveredOpportunities DiscoveredOpportunity[]

  @@index([searchProfileId])
  @@index([startedAt])
  @@index([status])
  @@map("search_runs")
}

model DiscoveredOpportunity {
  id                         String                     @id @default(uuid()) @db.Uuid
  searchRunId                String                     @db.Uuid
  sourceType                 String
  sourceUrl                  String?
  rawExternalId              String?
  title                      String
  companyNameRaw             String?
  companyId                  String?                    @db.Uuid
  descriptionRaw             String?
  location                   String?
  employmentType             String?
  remoteType                 String?
  postedAt                   DateTime?
  fitScore                   Int?
  priorityScore              Int?
  aiSummary                  String?
  suggestedAction            String?
  suggestedPositioningProfile String?
  lifecycleStatus            DiscoveredOpportunityStatus @default(new)
  promotedOpportunityId      String?                    @db.Uuid
  createdAt                  DateTime                  @default(now())
  updatedAt                  DateTime                  @updatedAt

  searchRun          SearchRun     @relation(fields: [searchRunId], references: [id], onDelete: Cascade)
  company            Company?      @relation(fields: [companyId], references: [id], onDelete: SetNull)
  promotedOpportunity Opportunity? @relation("PromotedOpportunity", fields: [promotedOpportunityId], references: [id], onDelete: SetNull)
  sourceForOpportunity Opportunity? @relation("PromotedOpportunitySource")

  @@index([searchRunId])
  @@index([companyId])
  @@index([lifecycleStatus])
  @@index([postedAt])
  @@index([fitScore])
  @@index([searchRunId, lifecycleStatus])
  @@index([rawExternalId])
  @@map("discovered_opportunities")
}
```

---

## Modeling Notes

### 1. Polymorphic Notes and Tags

`Note` and `EntityTag` use:

* `linkedEntityType` + `linkedEntityId`
* `entityType` + `entityId`

This keeps the MVP simple and flexible. Prisma does not support true polymorphic foreign keys, so validation that the referenced entity actually exists must happen in application code.

### 2. Opportunity to Discovered-Opportunity Linkage

There are two conceptual links:

* `Opportunity.sourceDiscoveredOpportunityId`
* `DiscoveredOpportunity.promotedOpportunityId`

You may decide later to keep only one of these. For now, both give you easy traceability in either direction.

### 3. Usage Counters are Periodic

`UsageCounter` is modeled by:

* user
* feature key
* period start
* period end

This is a good fit for subscription-based quotas and avoids making metering logic too complicated in MVP.

### 4. Stable Enums vs Flexible Strings

Enums are used for:

* core lifecycle/state fields
* fields unlikely to churn constantly

Strings are left for:

* `status` on some entities
* `priority` on opportunities
* provider-specific or workflow-specific fields

This keeps the schema practical and less brittle early on.

### 5. No Outreach/Resume/GitHub/Application Models Yet

Those are intentionally deferred to keep the MVP schema focused on:

* core CRM
* discovery
* commercial access

---

## Application-Level Validation Still Required

These should be enforced in the service layer, not just schema.

### 1. Active Subscription Resolution

A user may have multiple subscriptions historically.
The app must determine which one is currently active.

### 2. Polymorphic Entity Validation

For:

* `Note`
* `EntityTag`

The app must validate that:

* `linkedEntityType/entityType` is allowed
* referenced entity actually exists and belongs to the user

### 3. Activity/Task Parent Validity

For `Activity` and `Task`, the schema allows all parent refs to be nullable.
The app should ensure at least one meaningful parent reference is attached when required.

### 4. Promotion Rules

For `DiscoveredOpportunity`:

* it should not be promoted multiple times unintentionally
* once promoted, lifecycle rules should be enforced in application logic

### 5. Duplicate Control

For companies and people, exact duplicate prevention may need app-level logic, especially around:

* company names/domains
* people with similar name/email/linkedin combinations

---

## Suggested First Migration and Seed Strategy

### First Migration

Create the schema exactly for the MVP tables in this order:

1. enums
2. users
3. plans
4. plan_features
5. subscriptions
6. usage_counters
7. model_access_policies
8. companies
9. people
10. opportunities
11. opportunity_people
12. activities
13. tasks
14. notes
15. tags
16. entity_tags
17. search_profiles
18. search_runs
19. discovered_opportunities

### Seed Strategy

Seed with:

#### User

* one development user

#### Plans

* free
* pro
* power

#### Plan Features

Examples:

* discovery.scan
* crm.opportunities
* resume.generate_variant
* github.repo_analysis
* application.start_session

#### Model Access Policies

A few simple rows for:

* free → standard
* pro → premium
* power → premium_plus

#### Subscription

* one active subscription for the dev user

#### CRM Sample Data

* 2–3 companies
* 3–5 people
* 3–5 opportunities
* a few activities
* a few tasks

#### Discovery Sample Data

* 1 search profile
* 1–2 search runs
* a few discovered opportunities

---

## Suggested Markdown File Name

Use:

```text
docs/architecture/prisma-schema-draft.md
```

or, if you want a more structured path:

```text
docs/architecture/data-model/prisma-schema-draft.md
```

---

## Windsurf Follow-up Prompt

```text
Take the Prisma schema draft in docs/architecture/prisma-schema-draft.md and turn it into a real packages/db/prisma/schema.prisma file.

Then:
- validate relation names and directions
- check nullable vs required fields carefully
- ensure indexes and unique constraints are correct
- generate a clean initial migration
- update the seed script to match the schema
- keep the schema extensible for later modules like campaigns, resumes, repositories, and application sessions

Also report back with:
1. any ambiguities or schema issues you found
2. any changes you made from the draft and why
3. exact commands to run Prisma generate, migrate, and seed
```

If you want, I can also generate a **cleaned-up v2 Prisma draft** that simplifies the dual discovered-opportunity linkage before you hand it to Windsurf.
