# Conceptual Data Model

## 1. Conceptual Model Purpose

The platform is an **AI-powered opportunity operating system** for:

* finding opportunities
* organizing people and companies
* managing outreach
* tailoring resumes and assets
* tracking applications
* enforcing plan/usage rules

At the conceptual level, the system has 10 domain areas:

1. Identity and ownership
2. Commercial access
3. CRM core
4. Discovery
5. Outreach
6. Resume and evidence
7. Application assistance
8. AI and analytics
9. Offerings
10. AI Conversation / Context

---

## 2. Core Conceptual Domains

### A. Identity and Ownership

This domain answers:

* who is using the platform?
* who owns data?
* what workspace or account context does data belong to?

#### Main Entity

**User**

A person using the platform and owning data in their workspace.

Represents:

* the account holder
* owner of companies, contacts, opportunities, resumes, campaigns, and usage

Relationships:

* a User has one or more Authentication Identities over time
* a User has one or more Credentials over time
* a User has many Authentication Sessions over time
* a User has many Companies
* a User has many People
* a User has many Opportunities
* a User has one or more Subscriptions over time
* a User has many Usage Counters
* a User has many Search Profiles
* a User has many Resume assets
* a User has many Campaigns

MVP: yes

**Authentication Identity**

The login-facing identity used to prove who a User is.

Represents:

* a normalized email-first identity in MVP
* a stable authentication handle that can later support external providers
* the distinction between domain ownership and login mechanics

Relationships:

* belongs to one User
* may have one or more Credentials over time
* may produce many Verification Tokens

MVP: yes

**Credential**

A secret or provider-backed credential attached to an Authentication Identity.

Represents:

* password credential in MVP
* future OAuth or passkey-backed login methods
* the mechanism used to authenticate

Relationships:

* belongs to one Authentication Identity

MVP: yes

**Authentication Session**

A live authenticated interaction between a User and the platform.

Represents:

* a signed-in mobile, web, or internal client session
* refreshable access over time
* revocable authenticated presence on a device or client

Relationships:

* belongs to one User
* may be created from one Authentication Identity

MVP: yes

**Verification Token**

A one-time proof token used for auth lifecycle flows.

Represents:

* email verification
* password reset
* future magic-link or invitation flows

Relationships:

* belongs to one Authentication Identity or one User conceptually

MVP: yes

---

### B. Commercial Access

This domain answers:

* what plan is the user on?
* what features are enabled?
* how much usage is allowed?
* which AI capability level is available?

#### Main Entities

**Plan**

A commercial tier such as Free, Pro, or Power.

Represents:

* the product package being sold
* commercial feature bundle

Relationships:

* a Plan has many Plan Features
* a Plan has many Subscriptions
* a Plan has many Model Access Policies

MVP: yes

**Plan Feature**

A capability or feature rule attached to a Plan.

Represents:

* whether a feature is enabled
* whether it is limited
* what quota/config applies

Examples:

* discovery.scan
* resume.generate_variant
* github.repo_analysis
* application.start_session

Relationships:

* belongs to one Plan

MVP: yes

**Subscription**

The current commercial access state for a User.

Represents:

* active paid plan
* billing status
* trialing/cancelled/past-due state

Relationships:

* belongs to one User
* belongs to one Plan

MVP: yes

**Usage Counter**

A tracked quantity of feature consumption for a User within a time period.

Represents:

* how much of a metered feature has been used

Examples:

* scans this month
* resume variants this month
* repo analyses this month

Relationships:

* belongs to one User
* corresponds conceptually to one feature key

MVP: yes

**Model Access Policy**

Defines what AI model tier is allowed for a plan/feature combination.

Represents:

* cost control
* AI capability tiering
* prompt/context size policies

Relationships:

* belongs to one Plan

MVP: yes, even if simple

---

### C. CRM Core

This is the central system of record.

It answers:

* which companies matter?
* who are the people?
* what opportunities are being pursued?
* what has happened so far?
* what should happen next?

#### Main Entities

**Company**

An organization relevant to a user's opportunity pipeline.

Represents:

* employers
* prospect companies
* recruiter agencies
* startups
* consulting targets

Relationships:

* belongs to one User
* has many People
* has many Opportunities
* has many Activities
* has many Notes
* may have a Company Watch

MVP: yes

**Person**

An individual related to a company or opportunity.

Represents:

* recruiter
* hiring manager
* CTO
* founder
* engineer
* referral source

Relationships:

* belongs to one User
* may belong to one Company
* may be linked to many Opportunities
* has many Activities
* has many Tasks
* has many Notes
* may be enrolled in Campaigns

MVP: yes

**Opportunity**

A concrete pursuit being tracked.

Represents:

* a job application
* contract lead
* recruiter thread
* direct company pursuit
* consulting-style opening

Relationships:

* belongs to one User
* belongs to one Company
* may have one primary Person
* may have many related People
* has many Activities
* has many Tasks
* has many Notes
* may originate from a Discovered Opportunity
* may have many Resume Variants
* may have many Campaign Enrollments
* may have many Application Sessions
* may have many Opportunity Matches

MVP: yes

**Opportunity Contact Link**

A relationship between an Opportunity and a Person.

Represents:

* recruiter for this opportunity
* hiring manager for this opportunity
* champion
* decision maker
* referral

Relationships:

* links one Opportunity to one Person

MVP: yes

**Activity**

A recorded interaction or event.

Represents:

* LinkedIn message
* email sent
* call
* interview
* outreach attempt
* application submitted
* note-worthy event

Relationships:

* belongs to one User
* may belong to one Opportunity
* may belong to one Company
* may belong to one Person

MVP: yes

**Task**

A next action that should be completed.

Represents:

* follow up Friday
* send resume
* message recruiter
* prepare for interview

Relationships:

* belongs to one User
* may belong to one Opportunity
* may belong to one Company
* may belong to one Person

MVP: yes

**Note**

A freeform piece of user knowledge attached to something.

Represents:

* strategic notes
* company observations
* message ideas
* interview prep notes

Relationships:

* belongs to one User
* attached to one entity such as Company, Person, or Opportunity

MVP: yes

**Tag**

A label for classification.

Represents:

* fintech
* recruiter
* warm
* contract
* trading
* startup

Relationships:

* belongs to one User
* may be attached to multiple entities

MVP: yes

---

### D. Discovery

This is the top-of-funnel domain.

It answers:

* what did we search for?
* what did we find?
* what is worth reviewing?
* what should become a real opportunity?

#### Main Entities

**Search Profile**

A saved search strategy.

Represents:

* one recurring search definition
* titles, filters, industries, locations, exclusions

Relationships:

* belongs to one User
* has many Search Runs

MVP: yes

**Search Run**

A single execution of a Search Profile.

Represents:

* one scan event
* one market refresh
* one opportunity fetch cycle

Relationships:

* belongs to one Search Profile
* produces many Discovered Opportunities

MVP: yes

**Discovered Opportunity**

A potential opportunity found through scanning before promotion into CRM.

Represents:

* a role
* recruiter post
* company signal
* contract listing

Relationships:

* belongs to one Search Run
* may map to one Company
* may be promoted to one Opportunity

MVP: yes

**Company Watch**

A strategic watch on a company even if there is no active role.

Represents:

* target account monitoring
* follow hiring changes
* watch for future openings

Relationships:

* belongs to one User
* belongs to one Company

MVP: later

**Contact Lead**

A person discovered through search but not yet promoted to full CRM Person.

Represents:

* possible recruiter
* potential hiring manager
* lead found during discovery

Relationships:

* may belong to one Company
* may later promote into one Person

MVP: later

---

### E. Outreach

This domain supports proactive contact and follow-up.

It answers:

* what campaign is this part of?
* what message sequence is being used?
* what step is next?
* what was sent?
* what reply came back?

#### Main Entities

**Campaign**

A named outreach initiative.

Represents:

* fintech recruiter push
* direct outreach to trading firms
* startup contract outreach

Relationships:

* belongs to one User
* has many Sequences
* has many Campaign Enrollments

MVP: later or light MVP

**Sequence**

A reusable outreach cadence.

Represents:

* intro message + follow-up + reactivation flow

Relationships:

* belongs to one Campaign
* has many Sequence Steps
* has many Campaign Enrollments

MVP: later or light MVP

**Sequence Step**

One action within a sequence.

Represents:

* send first email
* wait three days
* draft LinkedIn follow-up
* mark stale

Relationships:

* belongs to one Sequence

MVP: later

**Message Template**

A reusable content pattern for outreach.

Represents:

* recruiter intro template
* hiring manager follow-up
* contract pitch

Relationships:

* used by Sequence Steps

MVP: later or simple

**Campaign Enrollment**

A live enrollment of a target in a sequence.

Represents:

* this person/opportunity is currently in a campaign flow

Relationships:

* belongs to one Campaign
* belongs to one Sequence
* belongs to one Opportunity
* may belong to one Person
* has many Approval Items
* has many Delivery Logs
* has many Response Events

MVP: later

**Approval Item**

An action awaiting user review.

Represents:

* draft outreach message waiting to be approved
* sensitive send waiting for confirmation

Relationships:

* belongs to one Campaign Enrollment

MVP: later

**Delivery Log**

A log of an executed outreach action.

Represents:

* message sent
* send failed
* channel used
* timestamp

Relationships:

* belongs to one Campaign Enrollment

MVP: later

**Response Event**

A tracked reaction from a target.

Represents:

* replied
* bounced
* interested
* not interested
* asked for resume

Relationships:

* belongs to one Campaign Enrollment
* may belong to one Opportunity
* may belong to one Person

MVP: later

**Suppression Rule**

A rule preventing bad or excessive outreach.

Represents:

* do not contact after reply
* max touches per time period
* do not message current employer

Relationships:

* belongs conceptually to a User or global policy set

MVP: later

---

### F. Resume and Evidence

This domain supports tailoring assets to a specific target.

It answers:

* what is the master resume?
* what fragments can be reused?
* what positioning angle should be used?
* what tailored variant was produced?
* what project evidence supports it?

#### Main Entities

**Resume Master**

The canonical structured resume data set for a user.

Represents:

* main resume content inventory
* experience, skills, education, summary

Relationships:

* belongs to one User
* has many Resume Fragments
* has many Resume Variants

MVP: later, phase 2

**Resume Fragment**

A reusable resume building block.

Represents:

* an achievement bullet
* a role summary
* a project snippet
* a skills grouping

Relationships:

* belongs to one User
* may belong conceptually to one Resume Master

MVP: later, phase 2

**Positioning Profile**

A narrative angle used for tailoring.

Represents:

* Capital Markets UI Engineer
* Solutions Engineer
* Full-Stack Product Builder

Relationships:

* belongs to one User
* may be used by many Resume Variants

MVP: later, phase 2

**Resume Variant**

A tailored output for a specific target.

Represents:

* a customized resume for one opportunity/company/person

Relationships:

* belongs to one User
* belongs to one Opportunity
* belongs to one Resume Master
* may use one Positioning Profile

MVP: later, phase 2

**Resume Generation Job**

A tracked generation event.

Represents:

* one AI resume build/rebuild process

Relationships:

* belongs to one Resume Variant

MVP: later

**Repository**

A GitHub repository or project source.

Represents:

* one codebase or project

Relationships:

* belongs to one User
* has many Repository Analyses
* has many Project Evidence items
* may match many Opportunities

MVP: later, phase 3

**Repository Analysis**

A structured analysis of a Repository.

Represents:

* inferred frameworks
* architecture patterns
* domain tags
* maturity

Relationships:

* belongs to one Repository

MVP: later

**Project Evidence**

A reusable proof point extracted from a Repository.

Represents:

* resume bullet candidate
* project summary
* architecture highlight

Relationships:

* belongs to one Repository

MVP: later

**Opportunity Match**

A relationship between an Opportunity and a Repository or Project Evidence.

Represents:

* why this repo/project is relevant to this opportunity

Relationships:

* belongs to one Opportunity
* belongs to one Repository

MVP: later

---

### G. Application Assistance

This domain supports live applications and company-site workflows.

It answers:

* what application session is in progress?
* what fields were found?
* what values were proposed?
* what files or answers were used?
* what happened during the session?

#### Main Entities

**Application Session**

A guided application run.

Represents:

* one live company-site or portal application process

Relationships:

* belongs to one User
* belongs to one Opportunity
* has many Application Fields
* has many Application Artifacts
* has many Application Audit Events

MVP: later, phase 4

**Application Field**

A detected or handled field in an application.

Represents:

* one form question or input
* proposed value
* confidence
* resolution mode

Relationships:

* belongs to one Application Session

MVP: later

**Application Artifact**

A file or generated answer used during application.

Represents:

* uploaded resume
* generated short answer
* cover note
* supporting text

Relationships:

* belongs to one Application Session
* may belong to one Opportunity

MVP: later

**Application Audit Event**

A recorded event during the application process.

Represents:

* page advanced
* field filled
* file uploaded
* answer approved

Relationships:

* belongs to one Application Session

MVP: later

---

### H. AI and Analytics

This domain supports intelligence, recommendations, and reporting.

It answers:

* what summaries exist?
* what recommendations were generated?
* what metrics are being tracked?

#### Main Entities

**AI Summary**

A cached AI-produced summary attached to an entity.

Represents:

* company summary
* opportunity summary
* repo summary
* person summary

Relationships:

* attached to one entity

MVP: later, optional early

**Opportunity Recommendation**

An AI recommendation tied to an opportunity.

Represents:

* next best action
* best resume strategy
* best outreach angle

Relationships:

* belongs to one Opportunity

MVP: later, optional early

**Metric Snapshot**

A stored analytics measurement.

Represents:

* reply rate
* opportunity conversion
* discovery performance
* resume conversion

Relationships:

* belongs to one User conceptually
* attached to a metric type/time period

MVP: later

---

### I. Offerings

This domain represents the deterministic value the user can take to market across products, services, consulting, jobs, contracts, and founder-style pursuits.

It answers:

* what value can the user offer?
* how can the same offering be positioned differently?
* what supporting materials exist for each offering?

#### Main Entities

**Offering**

A structured package of value that can be matched to an opportunity.

Represents:

* products and services
* consulting packages
* job/contract/professional profiles
* founder-style pursuits
* any marketable value proposition

Relationships:

* a User has many Offerings
* an Offering has many OfferingPositionings
* an Offering has many OfferingAssets
* an Offering can be matched to many Opportunities

MVP: yes

**OfferingPositioning**

Different ways the same offering can be framed for different contexts.

Represents:

* alternative value propositions
* different target audiences
* varied messaging angles
* context-specific positioning

Relationships:

* belongs to one Offering
* can be linked to specific Opportunity types
* may have associated OfferingAssets

MVP: V1

**OfferingAsset**

Supporting proof and packaging materials for an offering.

Represents:

* portfolio pieces
* case studies
* testimonials
* technical documentation
* pricing sheets
* demo materials

Relationships:

* belongs to one Offering
* may be associated with OfferingPositionings
* can be referenced in AI conversations

MVP: V1

---

### J. AI Conversation / Context

This domain represents the platform's persistent AI working memory rather than relying on implicit chat memory.

It answers:

* what AI conversations have occurred?
* what context summaries are available?
* what AI tasks have been performed?
* how can AI maintain context across sessions?

#### Main Entities

**AIConversation**

A bounded discussion thread for a specific purpose.

Represents:

* offering strategy discussions
* opportunity analysis conversations
* resume tailoring sessions
* outreach planning dialogs

Relationships:

* belongs to one User
* has many AIConversationMessages
* may be linked to structured entities (Offerings, Opportunities)
* may generate AIContextSummaries

MVP: V1

**AIConversationMessage**

Individual turns in an AI conversation thread.

Represents:

* user messages
* AI responses
* system messages
* context updates

Relationships:

* belongs to one AIConversation
* may reference structured entities
* may trigger AITasks

MVP: V1

**AIContextSummary**

Reusable condensed summaries of conversations or entities.

Represents:

* offering summaries
* opportunity insights
* user preference patterns
* conversation highlights

Relationships:

* belongs to one User
* may be derived from AIConversation
* can be referenced in future conversations
* may be linked to structured entities

MVP: V1

**AITask**

Specific AI jobs performed by the platform.

Represents:

* resume generation tasks
* outreach message creation
* opportunity analysis
* offering positioning suggestions

Relationships:

* belongs to one User
* may be triggered by AIConversation
* may reference structured entities
* may produce AIContextSummaries

MVP: V1

---

## 3. Core Conceptual Relationships

### User-Centered Relationships

* A User owns almost all core business data.
* A User authenticates through one or more Authentication Identities.
* A User may have many Authentication Sessions over time.
* A User has one active Subscription at a time.
* A User consumes feature usage through Usage Counters.

### Authentication Relationships

* An Authentication Identity belongs to one User.
* An Authentication Identity may have one or more Credentials over time.
* An Authentication Identity may issue many Verification Tokens over time.
* An Authentication Session represents authenticated access for one User on one client/device context.
* Authentication establishes identity; Subscription and Plan determine entitlement.

### CRM Relationships

* A Company has many People.
* A Company has many Opportunities.
* An Opportunity belongs to one Company.
* An Opportunity may involve many People.
* Activities, Tasks, and Notes can be attached to Opportunities, People, and Companies.

### Discovery Relationships

* A Search Profile has many Search Runs.
* A Search Run produces many Discovered Opportunities.
* A Discovered Opportunity may be promoted to an Opportunity.

### Commercial Relationships

* A Plan has many Plan Features.
* A Subscription links a User to a Plan.
* A Plan controls which features and AI model tiers are available.

### Resume/Evidence Relationships

* A Resume Variant belongs to one Opportunity.
* A Resume Variant is created from a Resume Master and optional Positioning Profile.
* A Repository can produce Project Evidence.
* An Opportunity can be matched to relevant Repository evidence.

### Outreach Relationships

* A Campaign has one or more Sequences.
* A Sequence has one or more Steps.
* A Campaign Enrollment links a target to an active sequence flow.

### Application Relationships

* An Application Session belongs to one Opportunity.
* An Application Session contains Fields, Artifacts, and Audit Events.

### Offerings Relationships

* A User has many Offerings.
* An Offering has many OfferingPositionings.
* An Offering has many OfferingAssets.
* An Offering can be matched to many Opportunities.
* An OfferingPositioning may be linked to specific Opportunity types.
* OfferingAssets may be associated with OfferingPositionings.

### AI Conversation / Context Relationships

* A User has many AIConversations.
* An AIConversation has many AIConversationMessages.
* An AIConversation may be linked to structured entities (Offerings, Opportunities).
* AIContextSummaries belong to one User and may be derived from AIConversations.
* AITasks belong to one User and may be triggered by AIConversations.
* AIContextSummaries can be referenced in future conversations.
* AITasks may produce AIContextSummaries.

---

## 4. Conceptual Enums and Status Concepts

### Opportunity Stage

Examples:

* New
* Targeted
* Outreach Sent
* Applied
* Conversation Started
* Interviewing
* Awaiting Decision
* Closed Won
* Closed Lost

### Subscription Status

Examples:

* Trialing
* Active
* Past Due
* Canceled
* Expired

### Verification Token Type

Examples:

* Email Verify
* Password Reset
* Magic Link

### Authentication Session Status

Examples:

* Active
* Revoked
* Expired

### Authentication Credential Type

Examples:

* Password
* Google OAuth
* Apple Sign In
* Passkey

### Feature Access Level

Examples:

* Disabled
* Enabled
* Limited
* Premium

### Activity Type

Examples:

* LinkedIn Message
* Email
* Call
* Interview
* Application Submitted
* Note Added
* Follow-up
* Meeting

### Discovery Lifecycle Status

Examples:

* New
* Reviewed
* Shortlisted
* Promoted
* Dismissed
* Watchlisted

### Task Status

Examples:

* Open
* In Progress
* Done
* Canceled

### Resume Variant Status

Examples:

* Draft
* Reviewed
* Finalized
* Sent

### Application Session Status

Examples:

* Started
* In Progress
* Awaiting Approval
* Completed
* Failed
* Abandoned

---

## 5. MVP Conceptual Scope

### MVP Yes

* User
* Authentication Identity
* Credential
* Authentication Session
* Verification Token
* Plan
* Plan Feature
* Subscription
* Usage Counter
* Model Access Policy
* Company
* Person
* Opportunity
* Opportunity Contact Link
* Activity
* Task
* Note
* Tag
* Search Profile
* Search Run
* Discovered Opportunity
* Offering

### MVP Maybe, if you move fast

* AI Summary
* Opportunity Recommendation

### V1 Logical Modeling

* OfferingPositioning
* OfferingAsset
* AIConversation
* AIConversationMessage
* AIContextSummary
* AITask

### Later Phase

* Campaign
* Sequence
* Sequence Step
* Message Template
* Campaign Enrollment
* Approval Item
* Delivery Log
* Response Event
* Suppression Rule
* Resume Master
* Resume Fragment
* Positioning Profile
* Resume Variant
* Repository
* Repository Analysis
* Project Evidence
* Opportunity Match
* Authentication Identity
* Credential
* Verification Token
* Authentication Session
* Application Field
* Application Artifact
* Application Audit Event
* Metric Snapshot
* Company Watch
* Contact Lead

---

## 6. Conceptual Model Summary

The platform revolves around a **User** who owns a set of **Companies**, **People**, **Opportunities**, and **Offerings** inside a commercially controlled workspace defined by **Plan**, **Subscription**, **Plan Feature**, and **Usage Counter**. That ownership is accessed through explicit authentication concepts: **Authentication Identity**, **Credential**, **Verification Token**, and **Authentication Session**. New potential opportunities enter the system through **Search Profiles**, **Search Runs**, and **Discovered Opportunities**, and can be promoted into the CRM core. The **Offerings** domain represents the user's marketable value propositions that can be matched to opportunities. Around that core, layers support **Outreach**, **Resume Tailoring**, **GitHub Evidence**, **Application Assistance**, **AI Recommendations**, and persistent **AI Conversation/Context** for maintaining working memory across sessions, all while keeping CRM as the main system of record and keeping authentication separate from commercial entitlement.
