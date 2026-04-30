# Conceptual Data Model

## 1. Conceptual Model Purpose

The platform is an **AI-powered opportunity operating system** for:

* finding opportunities
* organizing people and companies
* managing outreach
* tailoring resumes and assets
* tracking applications
* enforcing plan/usage rules

At the conceptual level, the system has 17 domain areas:

1. Identity and ownership
2. Commercial access
3. CRM core
4. Discovery
5. Outreach
6. Resume and evidence
7. Application assistance
8. AI and analytics
9. Offerings
10. Goals and Campaigns
11. Campaign Orchestration
12. AI Conversation / Context
13. Workspace Orchestration
14. Integration Capabilities & Connectors
15. Growth, Referrals, and Rewards
16. Coaching, Momentum, and Engagement
17. Browser Execution
18. Conversation Feedback and Campaign Memory

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
* a User may have Growth Credits and Referral Rewards
* a User may have Momentum State, Coaching Nudges, and Notification Preferences
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
* is this capability request allowed right now?
* what usage remains in the current window?
* what upgrade reason should be returned if blocked?

#### Main Entities

**Plan**

A commercial tier such as Free/Explorer, Builder, Operator, Studio, or Team.

Represents:

* the product package being sold
* commercial feature bundle
* default quota and capability posture

Relationships:

* a Plan has many Plan Features
* a Plan has many Subscriptions
* a Plan has many Model Access Policies

MVP: yes

**Plan Feature / Entitlement**

A capability or feature rule attached to a Plan.

Represents:

* whether a feature is enabled
* whether it is limited
* what quota/config applies

Examples:

* offering.create
* workspace.cycle
* ai.request
* discovery.ingest
* email.draft
* email.send
* connector.create
* communication.intelligence
* coaching.advanced

Relationships:

* belongs to one Plan
* can define a boolean enablement, numeric quota, model tier, or configuration payload
* can be evaluated by CapabilityGateService

MVP: yes

**Subscription / User Plan**

The current commercial access state for a User.

Represents:

* active paid plan
* free/explorer plan
* billing status
* trialing/cancelled/past-due state
* founder/internal/dev bypass status for dogfooding

Relationships:

* belongs to one User
* belongs to one Plan

MVP: yes

**Usage Counter / Usage Window**

A tracked quantity of feature consumption for a User within a time period.

Represents:

* how much of a metered feature has been used
* the period/window that usage applies to
* whether usage came from base plan, bonus credits, or reward credits

Examples:

* AI requests this day/month
* opportunity cycles this week
* discovery scans this month
* content ingestions this month
* email drafts this month
* connector slots currently used

Relationships:

* belongs to one User
* corresponds conceptually to one feature key
* may be augmented by Growth Credits or Usage Credits

MVP: yes

**Capability Gate**

The policy decision point used before executing cost-bearing or premium operations.

Represents:

* backend-enforced access control
* usage/quota checks
* upgrade reason generation
* plan-aware allowance decisions

Relationships:

* evaluates User Plan, Entitlements, Usage Counters, Feature Flags, and Growth Credits
* is called by AI, Discovery, Outreach, Connector, Workspace, and Communication services before execution
* returns a Capability Check Result

MVP: service-level concept

**Capability Check Result**

A structured allow/block result returned by the gating layer.

Represents:

* whether the requested action is allowed
* which plan and entitlement applied
* current usage and remaining allowance
* block reason and suggested upgrade path

Relationships:

* produced by Capability Gate
* consumed by product/capability services and API responses

MVP: API/service contract

**Upgrade Reason**

A normalized reason explaining why a capability is blocked or constrained.

Represents:

* plan does not include feature
* quota exhausted
* connector not available on plan
* premium model required
* usage window limit reached
* trial expired

Relationships:

* included in Capability Check Result
* informs frontend upgrade prompts

MVP: service-level enum/concept

**Feature Flag / Capability Flag**

A product or capability switch independent of billing state.

Represents:

* staged feature rollout
* internal dogfooding access
* experimental features
* provider-specific enablement

Relationships:

* can modify or override entitlement behavior
* may be scoped globally, by plan, or by user

MVP: maybe, if simple

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

**Discovery Scan**

A first-class research run created from an offering, campaign, goal, or explicit user request.

Represents:

* the discovery intent
* the provider plan for the run
* one or more providers or tools used
* the query and target segment
* the bounded scan request
* the consolidated, reviewable result set
* the top-level context for a contact-finding pass

Relationships:

* belongs to one User
* may belong to one Offering
* may belong to one Goal
* may belong to one Campaign
* has one or more Discovery Provider Runs
* produces many Discovery Targets

MVP: yes

**Discovery Provider Run**

A provider-specific execution inside a Discovery Scan.

Represents:

* one provider invocation such as Tavily, OpenAI search, Firecrawl, or a local/mock provider
* the provider-specific query or crawl parameters
* raw result counts and provider status
* provider-level provenance for later debugging and scoring

Relationships:

* belongs to one Discovery Scan
* may contribute evidence to many Discovery Targets conceptually

MVP: yes

**Discovery Target**

An explainable prospect, company, person, professor, content signal, or opportunity candidate discovered before CRM promotion.

Represents:

* who or what was found
* confidence and relevance scoring
* dedupe identity
* candidate contact information before canonical promotion
* existing-record match state
* why the target matters
* recommended next action
* accept/reject/promote review state

Relationships:

* belongs to one User
* belongs to one Discovery Scan
* may represent a company candidate, person/contact candidate, or content-signal candidate
* may match an existing Company before promotion
* may match an existing Person before promotion
* may match an existing Opportunity before promotion
* may link to one Company after promotion
* may link to one Person after promotion
* may link to one Opportunity after promotion
* has many Discovery Evidence records

MVP: yes

**Discovery Evidence**

The source material supporting a discovered target.

Represents:

* source URL or provider result
* snippet or explanation
* source type
* confidence
* publication or retrieval context

Relationships:

* belongs to one Discovery Target

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

**Connection Import Batch**

A batch of LinkedIn connections imported from a CSV file.

Represents:

* one CSV upload event
* the import source (LinkedIn connections)
* import metadata and statistics
* processing status and results

Relationships:

* belongs to one User
* creates or updates many Connection Records
* may trigger Connection Segments
* may generate Campaign Suggestions

MVP: yes

**Connection Record**

A person imported from LinkedIn connections with relationship context.

Represents:

* a LinkedIn connection with relationship history
* connection strength and recency
* professional context (company, title, location)
* potential for re-engagement or referral

Relationships:

* belongs to one Connection Import Batch
* belongs to one User
* links to one Person (canonical CRM record)
* may belong to many Connection Segments
* may generate Campaign Suggestions

MVP: yes

**Connection Segment**

A grouped subset of connections based on shared attributes.

Represents:

* connections by company, title, industry, or geography
* relevance scoring against active offerings
* prioritized target groups for campaigns
* AI-identified high-value segments

Relationships:

* belongs to one User
* belongs to one Connection Import Batch
* contains many Connection Records
* may generate many Campaign Suggestions

MVP: yes

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

Important clarification:

* Discovery Targets are the current staging layer for contact candidates.
* Discovery should not write raw scraped/found contacts directly into canonical CRM records.
* Discovery first stages, scores, dedupes, and matches candidate contacts, then promotes accepted targets into Company / Person / Opportunity records.
* Connection Imports provide warm-network data that bypasses cold discovery and creates immediate campaign opportunities.

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

This domain represents the market-facing value the user is trying to advance across products, services, books, software, advisory work, role candidacy, contracts, and founder-style pursuits.

It answers:

* what value can the user offer?
* how can the same offering be positioned differently?
* what supporting materials exist for each offering?
* which goals, campaigns, and active cycles are advancing this offering?

#### Main Entities

**Offering**

A market-facing value unit that can be positioned, targeted, supported with assets, and advanced toward a goal.

Represents:

* products and services
* books, reports, and content-led assets
* software or platform offerings
* consulting and advisory packages
* job/contract/role candidacy value propositions
* founder-style pursuits
* any value proposition that can be promoted through campaigns and outreach

Important clarification:

* an Offering is not the user's raw experience, resume, or history
* those are supporting assets, evidence, and credibility inputs
* the Offering is the thing being advanced in the market
* an Offering may be a direct revenue offer or a leverage offer that opens the door to another offer

Relationships:

* a User has many Offerings
* an Offering may be confirmed from one or more OfferingProposals
* an Offering has many OfferingPositionings
* an Offering has many OfferingAssets
* an Offering may have many Goals
* an Offering may have many Campaigns
* an Offering may have many ActionLanes through Campaigns
* an Offering may have many OpportunityCycles
* an Offering can be matched to many Opportunities

MVP: yes

**OfferingProposal**

An AI-inferred, user-reviewable offering structure extracted from conversation before it becomes a durable Offering.

Represents:

* the Conductor's current understanding of what the user wants to promote, sell, teach, or create opportunities around
* the editable structured proposal shown in the `confirm_offering` Canvas
* target audiences, problem solved, outcome created, credibility, outreach angle, and suggested supporting assets
* the approval boundary between conversational inference and durable business context

Relationships:

* belongs to one User
* may belong to one AIConversation
* may be confirmed into one Offering
* can be rejected, superseded, or confirmed without polluting durable Offerings with unapproved AI guesses

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

### J. Goals and Campaigns

This domain represents the user's intended outcomes and the campaign structure used to advance an offering.

It answers:

* what offering is being advanced?
* what outcome is the user trying to create?
* what coordinated campaign is being used?
* how do discovery, opportunities, and execution connect back to the objective?

#### Main Entities

**Goal**

A desired business or professional outcome owned by the user.

Represents:

* promote a consulting offering
* book advisory conversations
* generate qualified leads
* advance a job or contract search
* build market visibility around a product, book, or service

Relationships:

* belongs to one User when authenticated
* may belong to one Offering
* has many Campaigns
* may have many OpportunityCycles

MVP: yes

**Campaign**

The coordinated pursuit strategy for advancing a Goal and Offering.

Represents:

* CTO outreach using a book as leverage
* recruiter outreach for a specific market
* executive briefing campaign
* warm-network activation campaign
* targeted discovery and follow-up motion
* a coordinated push made up of multiple ActionLanes

Relationships:

* belongs to one User when authenticated
* belongs to one Goal
* may belong to one Offering
* has many ActionLanes
* may have many Opportunities
* may have many lane execution records

**Campaign**

The durable tactical motion that advances a goal and offering toward concrete results.

MVP: yes

#### Conceptual Rule

The product loop should be modeled like this:

```text
Goal -> Offering -> Discovery -> Campaign -> ActionLanes -> Execution -> Results -> Next prioritization
```

The Goal defines the outcome. The Offering defines what is being advanced. Discovery surfaces relevant opportunities and targets. The Campaign organizes the pursuit. ActionLanes define channel-specific motions. Execution produces Tasks, Activities, and results that feed the next prioritization pass.

---

### K. Campaign Orchestration

This domain represents coordinated multi-stream campaign management, enabling users to pursue one campaign through multiple execution lanes.

It answers:

* what campaign objective is being pursued?
* which execution streams (lanes) are active?
* how are lanes balanced and prioritized?
* what is the next best execution move across all lanes?
* how do results feed back into prioritization?
* what did the market say back, and how should the campaign learn from it?

#### Main Entities

**Campaign**

The canonical campaign container representing the current coordinated pursuit of an Offering/Goal.

Represents:

* promote the AI-Native Software Engineering book
* generate leads for the AI-Native SDLC Audit offering
* reactivate past cat-sitting clients before holidays
* land a new contract in capital markets UI development
* drive repeat visits for a retail collection launch

Relationships:

* belongs to one User
* may belong to one Offering (if promoting specific value)
* may belong to one Goal (if advancing desired outcome)
* is configured one campaign at a time during onboarding/activation
* has many ActionLanes
* has many ActionCycles as execution windows
* has many ActionItems as concrete work units
* has many ConversationThreads that capture replies, comments, screenshots, and content engagement
* has CampaignMetrics and momentum tracking

MVP: yes

**ActionLane**

A coordinated execution stream within a campaign. A lane is a repeatable go-to-market motion, often but not always equivalent to a channel.

Represents:

* Email outreach lane
* LinkedIn DM lane
* LinkedIn content/posting lane
* LinkedIn commenting/engagement lane
* Warm contact/referral lane
* Relationship reactivation lane
* Account research/signal tracking lane
* Podcast/webinar outreach lane
* Application/proposal lane
* Call outreach lane
* Client retention lane

Relationships:

* belongs to one Campaign
* has a LaneType (email, linkedin_dm, linkedin_content, linkedin_commenting, warm_intro, relationship_reactivation, account_research, etc.)
* has LaneStrategy (cadence, target criteria, approach)
* has many ActionCycles
* has many ActionItems
* has LaneMetrics and performance tracking
* may have Lane-specific assets and templates

MVP: yes

**ActionCycle**

An execution window for one ActionLane within one Campaign. A cycle is the engine's short-term operating plan, for example "this week, run five LinkedIn DMs and one post for this campaign."

Represents:

* a weekly email outreach push to recruiters
* a three-day LinkedIn DM push to warm founder contacts
* a content cycle with one LinkedIn post and supporting comments
* a warm-intro push against selected relationships

Relationships:

* belongs to one ActionLane
* belongs to one Campaign (through lane)
* has many ActionItems
* has CycleStatus (planned, active, paused, completed, cancelled)
* has generated reasoning, objective, window dates, and summary outcome data
* has PriorityScore for AI recommendation

Important clarification:

* the product cycle is not the same thing as an ActionCycle
* the product cycle is Goal -> Offering -> Discovery -> Campaign -> ActionLane execution -> Results -> Next prioritization
* ActionCycle is the lane-level execution window; ActionItem is the concrete target/action record

MVP: yes

**ActionItem**

A concrete work unit generated by the action engine from an ActionLane and usually grouped under an ActionCycle.

Represents:

* send this email to this recruiter
* draft this LinkedIn DM for this imported connection
* open this LinkedIn profile/search result, copy the suggested DM, and ask the user to confirm it was sent
* write this LinkedIn post draft and ask the user to confirm it was published
* ask this warm contact for an introduction
* comment on this target person's post

Relationships:

* belongs to one User
* belongs to one Campaign
* belongs to one ActionLane
* may belong to one ActionCycle
* may target one Person or Company
* may create or link to one Activity after confirmation
* may create or link to one ConversationThread when a reply, comment, screenshot, or engagement appears
* may be produced by one WorkspaceCommand or provider capability execution
* has ActionItemStatus (suggested, ready, in_progress, sent_confirmed, published_confirmed, skipped, failed, responded, converted)
* has draft/final content, external URL, due date, and confirmation metadata

MVP: yes

**ConversationThread**

The durable record of a specific exchange or engagement stream created by an ActionItem or campaign motion. A thread may represent a LinkedIn DM conversation, email reply chain, LinkedIn post comment thread, YouTube comment thread, or other campaign feedback channel.

Represents:

* replies to an outbound LinkedIn DM
* email responses to campaign outreach
* comments and replies on a LinkedIn post
* YouTube comment feedback on a short or video
* ongoing engagement around a content asset or outreach action

Relationships:

* belongs to one User
* may belong to one Campaign
* may belong to one ActionLane
* may belong to one ActionCycle
* may originate from one ActionItem
* may target one Person or Company
* has many ConversationThreadMessages
* has many ConversationThreadInsights
* may generate follow-up ActionItems

MVP: yes

**ConversationThreadMessage**

A captured message, reply, comment, screenshot, upload, synced provider event, or internal note within a ConversationThread.

Represents:

* pasted prospect reply text
* a screenshot of a LinkedIn DM response
* an email reply synced from Outlook/Gmail
* a comment captured from a LinkedIn post or YouTube video
* a system/internal note used to preserve context

Relationships:

* belongs to one User
* belongs to one ConversationThread
* has direction (outbound, inbound, internal)
* has source (manual paste, screenshot, upload, provider sync, system)
* may include attachment URLs and attachment MIME types

MVP: yes

**ConversationThreadInsight**

The AI or fallback synthesis of a conversation thread at a point in time.

Represents:

* sentiment
* buyer or audience intent
* objections
* buying signals
* resonance in content feedback
* recommended next action
* suggested follow-up action type
* evidence message IDs used for synthesis

Relationships:

* belongs to one User
* belongs to one ConversationThread
* may point to a suggested follow-up ActionItem
* updates campaign memory through the thread's latest summary, sentiment, intent, and next-action fields

MVP: yes

**ConversationFeedbackIntake**

A transient Conductor/API request where the user provides conversational feedback without manually selecting the underlying thread.

Represents:

* "I got this response" plus pasted text
* a dropped or uploaded screenshot of a DM reply
* a content comment screenshot
* optional hints such as channel, person, company, campaign, or action item

Relationships:

* uses active ConversationThreads and recent ActionItems as attribution candidates
* resolves to an existing ConversationThread when confidence is high
* returns candidate matches when confidence is low
* writes durable state only after attribution: ConversationThreadMessage, ConversationThreadInsight, and optional follow-up ActionItem

MVP: service/API contract, not a DB table

**ConversationAttributionCandidate**

A transient candidate match returned by the attribution layer during Conductor intake.

Represents:

* a possible thread/action item that the pasted reply or screenshot belongs to
* confidence score and reasons
* campaign, lane, action item, person, and company context for user clarification

Relationships:

* references existing ConversationThread and/or ActionItem records
* may be selected by the user or accepted automatically by the Conductor when confidence is high

MVP: service/API contract, not a DB table

**LaneType**

A classification of execution channel or motion type.

Represents:

* email
* linkedin_dm
* linkedin_content
* linkedin_commenting
* call_outreach
* referral_warm_intro
* warm_intro
* relationship_reactivation
* event_webinar_outreach
* application_proposal
* local_reactivation
* client_retention
* content_leverage
* account_research

Relationships:

* used by ActionLanes to define channel behavior
* may have lane-specific templates and strategies
* may have lane-specific metrics and success criteria

MVP: yes

**CampaignMetrics**

Performance and momentum tracking across campaigns and lanes.

Represents:

* lane performance scores
* momentum indicators
* conversion rates
* engagement metrics
* balance indicators across lanes

Relationships:

* belongs to one Campaign
* may belong to one ActionLane
* used by AI for strategic recommendations
* informs lane prioritization and coaching

MVP: yes

#### Conceptual Rules

**Campaign Hierarchy:**
```
Campaign (strategic objective)
├── ActionLane (execution stream)
│   ├── ActionCycle (execution window)
│   │   ├── ActionItem (concrete work)
│   │   │   └── ConversationThread (reply / engagement memory)
│   │   │       ├── ConversationThreadMessage
│   │   │       └── ConversationThreadInsight -> follow-up ActionItem
│   │   ├── ActionItem
│   │   └── ActionItem
│   └── ActionCycle
├── ActionLane
└── ActionLane
```

**AI Decision Flow:**
1. Assess campaign progress across all lanes
2. Identify lane with highest leverage opportunity
3. Recommend next cycle from optimal lane
4. Provide coaching on lane balance and momentum
5. Execute cycle and update campaign metrics
6. Capture replies, comments, and screenshots as ConversationThreadMessages
7. Synthesize feedback into ConversationThreadInsights
8. Generate or reprioritize follow-up ActionItems from the insight

**Lane Coordination:**
- Each lane operates independently but contributes to campaign objective
- AI can rebalance effort between lanes based on performance
- Cross-lane learning and optimization
- Unified campaign momentum tracking
- Conversation feedback is campaign memory: every reply, comment, screenshot, and content reaction should improve future targeting, messaging, content, and next-action selection

**Conductor Feedback Intake:**
- The preferred UX is conversational. A user can paste text or provide a screenshot to the Conductor and say "I got this response."
- The Conductor should attribute the feedback to a likely ConversationThread or recent ActionItem.
- If confidence is high, the system captures and synthesizes the feedback automatically.
- If confidence is low, the Conductor presents candidate threads and asks the user to choose.
- Attribution attempts are transient unless they produce durable thread messages, insights, or follow-up actions.

---

### L. AI Conversation / Context

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

### M. Workspace Orchestration

This domain represents the web product's operating spine. It turns raw CRM records, AI conversation, discovery results, and task/activity state into a focused execution cycle.

It answers:

* what matters right now?
* why does it matter?
* what is the AI recommending?
* what should the active workspace show?
* what actions are allowed from the current state?
* how does the user move from signal to execution to confirmation?

#### Main Entities

**OpportunityCycle**

A bounded unit of momentum that the user and AI are actively moving through.

Represents:

* a surfaced signal being interpreted
* an opportunity being advanced
* a campaign/outreach action being prepared
* a draft moving through review and approval
* a completed execution loop ready to hand off to the next cycle

Relationships:

* belongs to one User when authenticated
* may be linked to one Offering
* may be linked to one Goal
* may be linked to one Campaign
* may be linked to one Opportunity
* may be linked to one Task
* may be linked to one DiscoveredOpportunity
* may be linked to one AIConversation
* may originate from one WorkspaceSignal
* has many WorkspaceCommands over time

MVP: V1 web spine

**WorkspaceSignal**

A meaningful item worth the user's attention. A signal is not every event; it is an event or insight that has been promoted because it may change what the user should do next.

Represents:

* a high-priority discovered opportunity
* a stale opportunity that needs movement
* an overdue or strategically important task
* a campaign milestone or gap
* an AI insight that deserves review
* an asset/opportunity fit worth acting on

Relationships:

* belongs to one User when authenticated
* may reference a source entity through source type and source id
* may activate or create one OpportunityCycle
* may be dismissed, consumed, or converted into active workspace state

MVP: V1 web spine

**WorkspaceRecommendation**

The AI-ranked explanation of what should happen next. This may be stored as a first-class table later, but in the initial implementation it can be represented as structured data on OpportunityCycle, WorkspaceSignal, or WorkspaceCommand outputs.

Represents:

* why the item matters
* the recommended action
* supporting evidence
* confidence or priority
* the workspace mode that should be shown
* allowed execution actions

Relationships:

* derived from NextAction candidates, AI context, and domain state
* may be attached to an OpportunityCycle
* may be returned in WorkspaceState without always being persisted

MVP: computed first; persist later if needed

**WorkspaceCommand**

A structured execution intent from the user or AI conductor.

Represents:

* activate a signal
* generate an outreach draft
* revise a draft
* approve or send outreach
* create a task
* advance an opportunity
* dismiss or complete a cycle
* summarize current progress

Relationships:

* belongs to one User when authenticated
* may belong to one OpportunityCycle
* may be linked to one AIConversation
* may create or update Opportunities, Tasks, Activities, Assets, or Campaigns
* stores input and result payloads for auditability

MVP: V1 web spine

**WorkspaceState**

The composed state object returned to the web app. This is not necessarily a persisted entity; it is a backend contract produced by the orchestration layer.

Represents:

* the active cycle
* conductor state
* active workspace mode
* current recommendation
* relevant signals
* velocity and progress metrics
* allowed actions

Relationships:

* composed from User-owned records across CRM, Discovery, Offerings, Goals, Campaigns, AI Conversation, Assets, Tasks, Activities, Signals, and Cycles

MVP: API contract

---

### N. Integration Capabilities & Connectors

This domain represents the platform's capability-first, provider-abstracted integration architecture. It separates what the platform can do (capabilities) from how it does it (providers), enabling scalable addition of new integrations without changing business logic.

It answers:

* what functional capabilities can the platform perform?
* which providers implement each capability?
* how are user connectors configured and managed?
* how do actions flow from business intent to provider execution?
* what is the audit trail for external integrations?

#### Main Entities

**Capability**

A functional capability the platform can perform, independent of specific providers.

Represents:

* Email sending/receiving
* Calendar management  
* Messaging/SMS communications
* Voice calling and transcription
* Contact synchronization
* File storage and retrieval
* Content discovery and ingestion

Relationships:

* has many Capability Providers
* has many User Connectors
* used by Workspace Commands for execution
* used by Next Action Engine for action routing
* may generate Capability Execution Logs

MVP: core capabilities (email, calendar, messaging, discovery)

**Capability Provider**

A specific provider that implements a capability interface.

Represents:

* Gmail, Outlook (Email Providers)
* Google Calendar, Microsoft Graph (Calendar Providers)
* Twilio, WhatsApp (Messaging Providers)
* Firecrawl, Apify (Discovery Providers)
* Google Drive, S3 (Storage Providers)

Relationships:

* implements one Capability
* has many User Connectors
* has Provider Configuration schema
* may have provider-specific sync requirements

MVP: Gmail, Outlook, Google Calendar, Twilio, Firecrawl

**User Connector**

A user's configured connection to a specific capability provider.

Represents:

* User's authenticated Gmail connection
* User's Twilio account connection
* User's Google Calendar connection
* User's preferred email provider

Relationships:

* belongs to one User
* links one Capability to one Capability Provider
* has one Connector Credential
* has one Connector Sync State
* has many Capability Execution Logs
* may have enabled/disabled feature flags

MVP: email and calendar connectors

**Connector Credential**

Stored authentication and credential data for a user connector.

Represents:

* OAuth access/refresh tokens
* API keys and secrets
* Connection-specific credentials
* Credential metadata and expiry

Relationships:

* belongs to one User Connector
* encrypted at rest
* may have refresh/renewal workflow
* tracks credential health status

MVP: OAuth tokens and API keys

**Connector Sync State**

Tracking data and state for connector synchronization operations.

Represents:

* Last successful sync timestamp
* Provider-specific sync cursors
* Incremental sync state
* Error/retry state and backoff
* Sync performance metrics

Relationships:

* belongs to one User Connector
* updated by sync operations
* may trigger sync health alerts
* used for incremental sync optimization

MVP: email sync cursors, calendar sync state

**Capability Execution Log**

Audit trail and logging for all capability executions.

Represents:

* Email sent via Gmail connector
* Calendar event created via Google Calendar
* Discovery crawl executed via Firecrawl
* SMS sent via Twilio connector

Relationships:

* belongs to one User Connector
* belongs to one Workspace Command (origin)
* may link to business entities (Opportunity, Activity, Person)
* stores execution outcome and provider response
* may have retry/failure tracking

MVP: email and calendar execution logs

**Connector Configuration**

Schema and configuration data for capability providers.

Represents:

* Required OAuth scopes
* Supported features and limitations
* Rate limiting configuration
* Provider-specific settings

Relationships:

* belongs to one Capability Provider
* defines connector setup requirements
* may vary by provider version
* used for connector validation

MVP: basic provider configurations

---

### O. Growth, Referrals, and Rewards

This domain represents product-native growth loops and reward credits. It should support sharing and referrals early without becoming a full billing or payout system.

It answers:

* how did this user arrive?
* who referred whom?
* did the referred user reach a meaningful milestone?
* what reward or credit should be granted?
* how can rewards extend useful free usage without losing cost control?

#### Main Entities

**Referral Link**

A shareable referral handle or URL owned by a User.

Represents:

* user-specific invitation link
* campaign/source metadata
* active or revoked sharing channel

Relationships:

* belongs to one User
* may create many Referral Invites or Referral Attributions

MVP: V1 logical modeling

**Referral Invite**

A sent or shared invitation event.

Represents:

* a user shared Opportunity OS with someone
* channel/source metadata
* invite lifecycle before signup

Relationships:

* belongs to one referring User
* may be tied to one Referral Link
* may become one Referral Attribution

MVP: later

**Referral Attribution**

The durable relationship between a referrer and a referred user.

Represents:

* who referred the new user
* when attribution was established
* attribution source and confidence

Relationships:

* belongs to one referrer User
* belongs to one referred User
* has many Referral Milestones
* may create Referral Rewards

MVP: V1 logical modeling

**Referral Milestone**

A meaningful product milestone used to decide whether a referral reward is earned.

Represents:

* signup plus onboarding completion
* first completed OpportunityCycle
* first sent outreach
* paid conversion later

Relationships:

* belongs to one Referral Attribution
* may produce one or more Referral Rewards

MVP: V1 logical modeling

**Referral Reward**

A granted reward earned from a referral milestone.

Represents:

* additional AI usage
* additional cycles
* additional discovery scans
* connector slot increase
* premium trial unlock
* subscription credit later

Relationships:

* belongs to a rewarded User
* may be produced by a Referral Milestone
* may create Growth Credits or Usage Credits

MVP: V1 logical modeling

**Growth Credit / Usage Credit**

A non-billing credit that extends or unlocks bounded product usage.

Represents:

* bonus AI requests
* bonus opportunity cycles
* bonus discovery scans
* short premium trial unlocks

Relationships:

* belongs to one User
* may originate from Referral Reward, promotion, internal grant, or support adjustment
* may be consumed by Usage Counters through Capability Gate decisions

MVP: V1 logical modeling

**Share Event**

A lightweight event representing a product share action.

Represents:

* copied referral link
* shared invite
* shared result or milestone

Relationships:

* belongs to one User
* may reference a Referral Link or Referral Invite

MVP: later

---

### P. Coaching, Momentum, and Engagement

This domain represents product-native nudges that help users keep moving through opportunity cycles.

It answers:

* is the user building momentum?
* what target is the user trying to hit this week?
* what should the system nudge next?
* when should the system celebrate progress?
* when should stalled users be reactivated?

#### Main Entities

**Goal Progress**

The measurable progress state for a Goal.

Represents:

* cycles completed toward a goal
* outreach sent toward a target
* meetings booked
* opportunities advanced

Relationships:

* belongs to one Goal
* is derived from Activities, Tasks, Opportunities, and OpportunityCycles

MVP: V1 logical modeling

**Weekly Target / Outreach Quota**

A target commitment for a time window.

Represents:

* weekly outreach goal
* cycle completion target
* follow-up target
* discovery/review target

Relationships:

* belongs to one User
* may belong to one Goal or Campaign
* informs Momentum State and Coaching Nudges

MVP: V1 logical modeling

**Momentum State**

The computed state of a user's current execution rhythm.

Represents:

* on track
* behind target
* stalled
* recovering
* strong momentum

Relationships:

* belongs to one User
* derived from Goals, Weekly Targets, OpportunityCycles, Tasks, Activities, and WorkspaceSignals

MVP: computed first; persist later if useful

**Coaching Nudge**

A system-generated recommendation or reminder intended to move the user forward.

Represents:

* complete one cycle today
* send one follow-up
* review a stale opportunity
* celebrate a completed target
* restart after inactivity

Relationships:

* belongs to one User
* may reference Goal, Campaign, Opportunity, Task, OpportunityCycle, or WorkspaceSignal
* may become a notification later

MVP: V1 logical modeling

**Engagement State**

The user's recent activity and risk posture.

Represents:

* active
* quiet
* at risk
* dormant
* reactivated

Relationships:

* belongs to one User
* informed by sessions, activities, workspace commands, completed cycles, and notifications

MVP: later

**Notification Preference**

The user's preferences for reminders and coaching delivery.

Represents:

* email/push/in-app preferences
* quiet hours
* opt-in/out states
* coaching cadence

Relationships:

* belongs to one User
* controls future notification delivery

MVP: later

**Reactivation Trigger**

A condition that identifies when a user or opportunity needs a restart nudge.

Represents:

* no completed cycle today
* behind weekly outreach goal
* stale opportunity
* unused connector
* abandoned onboarding

Relationships:

* may create Coaching Nudges
* may be evaluated from Momentum State and Engagement State

MVP: later

**Motivation Event**

A positive or corrective event emitted by the product to reinforce momentum.

Represents:

* completed cycle
* weekly goal achieved
* first outreach sent
* referral milestone reached
* stalled opportunity recovered

Relationships:

* belongs to one User
* may reference Goal, OpportunityCycle, Activity, ReferralReward, or WorkspaceCommand

MVP: later

---

### Q. Browser Execution

This domain represents embedded browser sessions that enable web-based execution within the platform.

It answers:

* what browser session is active?
* what page is being viewed?
* what actions has the user performed?
* what is the AI suggesting?
* how does this connect to opportunities and tasks?

#### Main Entities

**Browser Session**

A live or completed browser interaction session.

Represents:

* one browser instance with state
* the execution context for web-based actions
* AI-guided browsing experience
* link to opportunity/task context

Relationships:

* belongs to one User
* may belong to one Opportunity
* may belong to one Task
* has many Browser Session Steps
* has many Browser Session Artifacts
* has many Browser Session Events

MVP: yes

**Browser Session Step**

A single step or action within a browser session.

Represents:

* navigation to a page
* form interaction
* content extraction
* AI analysis
* user action

Relationships:

* belongs to one Browser Session
* may produce Browser Session Artifacts
* may trigger AI analysis

MVP: yes

**Browser Session Artifact**

Captured data or content from a browser session.

Represents:

* screenshots
* extracted text
* form data
* page summaries
* AI insights

Relationships:

* belongs to one Browser Session
* may belong to one Browser Session Step

MVP: yes

**Browser Session Event**

An audit log of all actions and events in a browser session.

Represents:

* user actions
* AI suggestions
* system events
* errors and recoveries
* security events

Relationships:

* belongs to one Browser Session
* provides audit trail

MVP: yes

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
* A Discovery Scan belongs to a User and may reference an Offering, Goal, and Campaign.
* A Discovery Scan may execute through one or more Discovery Provider Runs.
* A Discovery Scan produces many Discovery Targets.
* A Discovery Target has many Discovery Evidence records.
* A Discovery Target may match existing Company, Person, Opportunity, or prior Discovery Target records before promotion.
* A Discovery Target may be accepted, rejected, marked duplicate, or promoted.
* A promoted Discovery Target may link to Company, Person, and Opportunity records.

### Commercial Relationships

* A Plan has many Plan Features.
* A Subscription links a User to a Plan.
* A Plan controls which features and AI model tiers are available.
* Plan Features define Entitlements that can be evaluated by the Capability Gate.
* Usage Counters track metered feature consumption in usage windows.
* Growth Credits or Usage Credits may extend a User's effective allowance.
* Capability Check Results explain allowed/blocked decisions to backend services and frontend clients.

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
* A User has many OfferingProposals.
* An OfferingProposal may belong to one AIConversation.
* An OfferingProposal may be confirmed into one Offering.
* An Offering may be confirmed from OfferingProposals.
* An Offering has many OfferingPositionings.
* An Offering has many OfferingAssets.
* An Offering may have many Goals.
* An Offering may have many Campaigns.
* An Offering may have many OpportunityCycles.
* An Offering can be matched to many Opportunities.
* An OfferingPositioning may be linked to specific Opportunity types.
* OfferingAssets may be associated with OfferingPositionings.

### Goals and Campaigns Relationships

* A Goal belongs to one User when authenticated and may belong to one Offering.
* A Campaign belongs to one Goal and may belong to one Offering.
* A Campaign has many Opportunities.
* Goals and Campaigns provide the strategic context that explains why an OpportunityCycle matters.
* When an Offering is known, Goals, Campaigns, and OpportunityCycles should preserve that Offering context.

### AI Conversation / Context Relationships

* A User has many AIConversations.
* An AIConversation has many AIConversationMessages.
* An AIConversation may be linked to structured entities (Offerings, Opportunities).
* AIContextSummaries belong to one User and may be derived from AIConversations.
* AITasks belong to one User and may be triggered by AIConversations.
* AIContextSummaries can be referenced in future conversations.
* AITasks may produce AIContextSummaries.

### Workspace Orchestration Relationships

* A WorkspaceSignal belongs to one User and may reference a source entity such as DiscoveredOpportunity, Opportunity, Task, Campaign, Activity, or AIConversation.
* A WorkspaceSignal may create or activate one OpportunityCycle.
* An OpportunityCycle belongs to one User and may reference one Offering, Goal, Campaign, Opportunity, Task, DiscoveredOpportunity, and AIConversation.
* An OpportunityCycle has a current phase and active workspace mode that guide the right-pane web experience.
* Every orchestrated cycle should know which Offering it is advancing whenever that context is available.
* A WorkspaceCommand belongs to one User and may belong to one OpportunityCycle.
* A WorkspaceCommand records structured execution intent and may create or update CRM, Discovery, Outreach, Asset, Campaign, or AI records.
* WorkspaceState is composed from the active OpportunityCycle, meaningful WorkspaceSignals, AI context, next-action ranking, and velocity metrics.

### Capability Integration Relationships

* A User has many User Connectors for different capabilities and providers.
* A User Connector links one Capability to one Capability Provider.
* A Capability has many Capability Providers implementing the same interface.
* Capability services should consult Capability Gate before executing cost-bearing or premium operations.
* Workspace Commands execute through User Connectors via Capability routing.
* Capability Execution Logs belong to both User Connectors and Workspace Commands.
* Activities may be created from Capability Executions (e.g., email sent, meeting scheduled).
* AI Conversations may recommend Capability actions and generate Workspace Commands.
* Discovery capabilities may create Discovered Opportunities through content ingestion.
* Connector Sync State tracks incremental synchronization for provider data.
* Connector Credentials provide secure authentication for User Connectors.

### Growth, Referrals, and Rewards Relationships

* A User may own many Referral Links.
* A Referral Link may produce Referral Invites and Referral Attributions.
* A Referral Attribution connects one referrer User to one referred User.
* Referral Milestones belong to a Referral Attribution and represent meaningful product progress.
* Referral Rewards are granted only after meaningful milestones, not simple clicks.
* Referral Rewards may create Growth Credits or Usage Credits.
* Growth Credits may be considered by Capability Gate when evaluating usage allowance.

### Coaching, Momentum, and Engagement Relationships

* Goal Progress belongs to one Goal and is derived from cycles, activities, tasks, and opportunity movement.
* Weekly Targets may belong to a User, Goal, or Campaign.
* Momentum State is computed from progress, targets, activities, tasks, signals, and cycles.
* Coaching Nudges belong to one User and may reference Goals, Campaigns, Opportunities, Tasks, Signals, or Cycles.
* Engagement State is informed by user sessions, completed cycles, activities, and workspace commands.
* Notification Preferences control future nudge delivery channels and cadence.
* Reactivation Triggers may create Coaching Nudges.
* Motivation Events record meaningful positive or corrective product moments.

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

### Upgrade Reason

Examples:

* Plan Does Not Include Capability
* Usage Limit Reached
* Connector Limit Reached
* Premium Model Required
* Trial Expired
* Feature Disabled

### Referral Milestone Type

Examples:

* Signup
* Onboarding Completed
* First Cycle Completed
* First Outreach Sent
* Paid Conversion

### Reward Type

Examples:

* AI Usage Credit
* Cycle Credit
* Discovery Scan Credit
* Connector Slot Credit
* Premium Trial Unlock
* Subscription Credit

### Momentum State

Examples:

* On Track
* Behind
* Stalled
* Recovering
* Strong Momentum

### Coaching Nudge Type

Examples:

* Complete Cycle
* Send Follow-Up
* Review Signal
* Celebrate Progress
* Reactivate Opportunity
* Resume Onboarding

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

### Opportunity Cycle Phase

Examples:

* Surfaced
* Interpreted
* Proposed
* Drafting
* Awaiting Confirmation
* Executed
* Confirmed
* Completed
* Dismissed

### Workspace Mode

Examples:

* Empty
* Signal Review
* Goal Planning
* Campaign Review
* Opportunity Review
* Draft Edit
* Asset Review
* Execution Confirm
* Progress Summary

### Workspace Signal Status

Examples:

* New
* Surfaced
* Active
* Consumed
* Dismissed
* Archived

### Workspace Command Status

Examples:

* Pending
* Running
* Succeeded
* Failed
* Cancelled

### Capability Type

Examples:

* Email
* Calendar
* Messaging
* Calling
* Contacts
* Storage
* Discovery

### Connector Status

Examples:

* Connected
* Disconnected
* Error
* Expired
* Syncing

### Capability Execution Status

Examples:

* Succeeded
* Failed
* Retrying
* Cancelled
* RateLimited

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
* Capability Gate
* Capability Check Result
* Upgrade Reason
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
* Discovery Scan
* Discovery Target
* Discovery Evidence
* OfferingProposal
* Offering
* Goal
* Campaign
* Capability (core types)
* Capability Provider (Gmail, Outlook, Google Calendar, Twilio, Firecrawl)
* User Connector (email, calendar)
* Connector Credential
* Connector Sync State

### MVP Maybe, if you move fast

* AI Summary
* Opportunity Recommendation
* Feature Flag / Capability Flag
* Momentum State
* Coaching Nudge

### V1 Logical Modeling

* OfferingPositioning
* OfferingAsset
* AIConversation
* AIConversationMessage
* AIContextSummary
* AITask
* OpportunityCycle
* WorkspaceSignal
* WorkspaceCommand
* WorkspaceState API contract
* Capability Execution Log
* Connector Configuration
* Referral Link
* Referral Attribution
* Referral Milestone
* Referral Reward
* Growth Credit / Usage Credit
* Goal Progress
* Weekly Target / Outreach Quota

### Later Phase

* Referral Invite
* Share Event
* Engagement State
* Notification Preference
* Reactivation Trigger
* Motivation Event
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
* Persisted WorkspaceRecommendation

---

## 6. Conceptual Model Summary

The platform revolves around a **User** who owns a set of **Companies**, **People**, **Opportunities**, and **Offerings** inside a commercially controlled workspace defined by **Plan**, **Subscription/User Plan**, **Plan Feature/Entitlement**, **Usage Counter**, and **Capability Gate**. That ownership is accessed through explicit authentication concepts: **Authentication Identity**, **Credential**, **Verification Token**, and **Authentication Session**.

The platform operates through a **capability-first, provider-abstracted integration architecture** where **User Connectors** link **Capabilities** (Email, Calendar, Messaging, Discovery) to **Capability Providers** (Gmail, Outlook, Twilio, Firecrawl). Capability services consult the **Capability Gate** before executing cost-bearing or premium operations, returning structured **Capability Check Results** and **Upgrade Reasons** that frontend clients can use for plan-aware experiences.

New potential opportunities enter the system through **Discovery Scans**, **Discovery Targets**, **Discovery Evidence**, and the legacy **Search Profiles/Search Runs/Discovered Opportunities** path. Discovery is its own provider-abstracted intelligence module: it researches targets, stores evidence, scores relevance, supports accept/reject review, and only promotes accepted targets into the CRM core. The **Offerings** domain represents the user's marketable value propositions. **Goals** define the outcomes the user wants for those offerings, and **Campaigns** define the tactical motions used to advance them. Persistent **AI Conversation/Context** maintains working memory across sessions and may recommend capability-based actions.

The **Workspace Orchestration** domain turns CRM records, discovery results, AI insight, tasks, activities, offerings, goals, and campaigns into focused **Opportunity Cycles** so the web app can show what matters now, why it matters, which offering is being advanced, what the AI recommends, what the active workspace should display, and which execution actions are allowed. **Coaching, Momentum, and Engagement** concepts turn those cycles into targets, nudges, progress, and reactivation moments.

Around that core, layers support **Outreach**, **Resume Tailoring**, **GitHub Evidence**, **Application Assistance**, **AI Recommendations**, and **Growth/Referral Rewards**, while keeping CRM as the main system of record and maintaining clean separation between business domains, functional capabilities, entitlement enforcement, and provider implementations.
