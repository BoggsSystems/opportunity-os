# Logical Relational Model

## V1 Entity Definitions

### Offerings Domain

#### offerings

**Purpose:** Core table representing structured packages of value that users can take to market.

**Table Name:** `offerings`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Foreign Key to users, Required) - Owner
- `title` (VARCHAR(255), Required) - Offering name/title
- `description` (TEXT, Optional) - Detailed description
- `offering_type` (VARCHAR(50), Required) - Type classification
- `status` (VARCHAR(50), Required) - Current status
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `offering_type`: 'product', 'service', 'consulting', 'job_profile', 'contract', 'founder_pursuit', 'other'
- `status`: 'draft', 'active', 'inactive', 'archived'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_offerings_user_id` (`user_id`)
- INDEX `idx_offerings_type_status` (`offering_type`, `status`)
- INDEX `idx_offerings_created_at` (`created_at`)

---

#### offering_positionings

**Purpose:** Different ways the same offering can be framed for different contexts.

**Table Name:** `offering_positionings`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `offering_id` (UUID, Foreign Key to offerings, Required) - Parent offering
- `title` (VARCHAR(255), Required) - Positioning title
- `description` (TEXT, Optional) - Positioning description
- `target_audience` (VARCHAR(255), Optional) - Target audience description
- `value_proposition` (TEXT, Optional) - Value proposition statement
- `messaging_angle` (VARCHAR(100), Optional) - Messaging approach
- `priority` (INTEGER, Optional) - Priority order
- `status` (VARCHAR(50), Required) - Current status
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `status`: 'draft', 'active', 'inactive', 'archived'
- `messaging_angle`: 'technical', 'business', 'cost_focused', 'value_focused', 'other'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_offering_positionings_offering_id` (`offering_id`)
- INDEX `idx_offering_positionings_status_priority` (`status`, `priority`)
- INDEX `idx_offering_positionings_created_at` (`created_at`)

---

#### offering_assets

**Purpose:** Supporting proof and packaging materials for offerings.

**Table Name:** `offering_assets`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `offering_id` (UUID, Foreign Key to offerings, Required) - Parent offering
- `offering_positioning_id` (UUID, Foreign Key to offering_positionings, Optional) - Associated positioning
- `title` (VARCHAR(255), Required) - Asset title
- `description` (TEXT, Optional) - Asset description
- `asset_type` (VARCHAR(50), Required) - Type of asset
- `content_url` (VARCHAR(500), Optional) - URL to asset content
- `content_text` (TEXT, Optional) - Text content for text-based assets
- `file_path` (VARCHAR(500), Optional) - File system path
- `file_size` (INTEGER, Optional) - File size in bytes
- `mime_type` (VARCHAR(100), Optional) - MIME type for files
- `is_public` (BOOLEAN, Required, Default: false) - Public visibility
- `status` (VARCHAR(50), Required) - Current status
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `asset_type`: 'portfolio_piece', 'case_study', 'testimonial', 'technical_documentation', 'pricing_sheet', 'demo_material', 'image', 'video', 'document', 'other'
- `status`: 'draft', 'active', 'inactive', 'archived'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_offering_assets_offering_id` (`offering_id`)
- INDEX `idx_offering_assets_positioning_id` (`offering_positioning_id`)
- INDEX `idx_offering_assets_type_status` (`asset_type`, `status`)
- INDEX `idx_offering_assets_is_public` (`is_public`)

---

### AI Conversation / Context Domain

#### ai_conversations

**Purpose:** Bounded discussion threads for specific purposes with persistent context.

**Table Name:** `ai_conversations`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Foreign Key to users, Required) - Owner
- `title` (VARCHAR(255), Required) - Conversation title
- `purpose` (VARCHAR(100), Required) - Conversation purpose
- `offering_id` (UUID, Foreign Key to offerings, Optional) - Related offering
- `opportunity_id` (UUID, Foreign Key to opportunities, Optional) - Related opportunity
- `status` (VARCHAR(50), Required) - Current status
- `message_count` (INTEGER, Required, Default: 0) - Number of messages
- `last_message_at` (TIMESTAMP, Optional) - Last message timestamp
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `purpose`: 'offering_strategy', 'opportunity_analysis', 'resume_tailoring', 'outreach_planning', 'general_chat', 'other'
- `status`: 'active', 'paused', 'completed', 'archived'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_ai_conversations_user_id` (`user_id`)
- INDEX `idx_ai_conversations_offering_id` (`offering_id`)
- INDEX `idx_ai_conversations_opportunity_id` (`opportunity_id`)
- INDEX `idx_ai_conversations_status_updated` (`status`, `updated_at`)
- INDEX `idx_ai_conversations_last_message` (`last_message_at`)

---

#### ai_conversation_messages

**Purpose:** Individual turns in AI conversation threads.

**Table Name:** `ai_conversation_messages`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `conversation_id` (UUID, Foreign Key to ai_conversations, Required) - Parent conversation
- `message_type` (VARCHAR(50), Required) - Type of message
- `content` (TEXT, Required) - Message content
- `metadata_json` (JSON, Optional) - Additional metadata
- `token_count` (INTEGER, Optional) - Token usage for this message
- `model_used` (VARCHAR(100), Optional) - AI model used for response
- `processing_time_ms` (INTEGER, Optional) - Processing time in milliseconds
- `created_at` (TIMESTAMP, Required) - Creation timestamp

**Enums:**
- `message_type`: 'user', 'assistant', 'system', 'function_call', 'function_result'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_ai_conversation_messages_conversation_id` (`conversation_id`)
- INDEX `idx_ai_conversation_messages_type_created` (`message_type`, `created_at`)
- INDEX `idx_ai_conversation_messages_created_at` (`created_at`)

---

#### ai_context_summaries

**Purpose:** Reusable condensed summaries of conversations or entities.

**Table Name:** `ai_context_summaries`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Foreign Key to users, Required) - Owner
- `title` (VARCHAR(255), Required) - Summary title
- `summary_type` (VARCHAR(50), Required) - Type of summary
- `content` (TEXT, Required) - Summary content
- `source_type` (VARCHAR(50), Required) - Source entity type
- `source_id` (UUID, Optional) - Source entity ID
- `ai_conversation_id` (UUID, Foreign Key to ai_conversations, Optional) - Source conversation
- `offering_id` (UUID, Foreign Key to offerings, Optional) - Related offering
- `opportunity_id` (UUID, Foreign Key to opportunities, Optional) - Related opportunity
- `token_count` (INTEGER, Optional) - Token count of summary
- `model_used` (VARCHAR(100), Optional) - AI model used
- `expires_at` (TIMESTAMP, Optional) - Expiration timestamp
- `usage_count` (INTEGER, Required, Default: 0) - Number of times used
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `summary_type`: 'offering_summary', 'opportunity_insight', 'user_preference', 'conversation_highlights', 'entity_overview', 'other'
- `source_type`: 'ai_conversation', 'offering', 'opportunity', 'user', 'other'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_ai_context_summaries_user_id` (`user_id`)
- INDEX `idx_ai_context_summaries_source` (`source_type`, `source_id`)
- INDEX `idx_ai_context_summaries_conversation_id` (`ai_conversation_id`)
- INDEX `idx_ai_context_summaries_offering_id` (`offering_id`)
- INDEX `idx_ai_context_summaries_opportunity_id` (`opportunity_id`)
- INDEX `idx_ai_context_summaries_expires_at` (`expires_at`)
- INDEX `idx_ai_context_summaries_usage_count` (`usage_count`)

---

#### ai_tasks

**Purpose:** Specific AI jobs performed by the platform.

**Table Name:** `ai_tasks`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Foreign Key to users, Required) - Owner
- `task_type` (VARCHAR(50), Required) - Type of AI task
- `title` (VARCHAR(255), Required) - Task title
- `description` (TEXT, Optional) - Task description
- `ai_conversation_id` (UUID, Foreign Key to ai_conversations, Optional) - Triggering conversation
- `ai_context_summary_id` (UUID, Foreign Key to ai_context_summaries, Optional) - Input summary
- `offering_id` (UUID, Foreign Key to offerings, Optional) - Related offering
- `opportunity_id` (UUID, Foreign Key to opportunities, Optional) - Related opportunity
- `input_data_json` (JSON, Optional) - Input parameters
- `output_data_json` (JSON, Optional) - Output results
- `status` (VARCHAR(50), Required) - Current status
- `error_message` (TEXT, Optional) - Error details
- `token_count` (INTEGER, Optional) - Total tokens used
- `processing_time_ms` (INTEGER, Optional) - Total processing time
- `model_used` (VARCHAR(100), Optional) - AI model used
- `started_at` (TIMESTAMP, Optional) - Task start timestamp
- `completed_at` (TIMESTAMP, Optional) - Task completion timestamp
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `task_type`: 'resume_generation', 'outreach_message_creation', 'opportunity_analysis', 'offering_positioning_suggestion', 'context_summary', 'other'
- `status`: 'pending', 'running', 'completed', 'failed', 'cancelled'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_ai_tasks_user_id` (`user_id`)
- INDEX `idx_ai_tasks_type_status` (`task_type`, `status`)
- INDEX `idx_ai_tasks_conversation_id` (`ai_conversation_id`)
- INDEX `idx_ai_tasks_summary_id` (`ai_context_summary_id`)
- INDEX `idx_ai_tasks_offering_id` (`offering_id`)
- INDEX `idx_ai_tasks_opportunity_id` (`opportunity_id`)
- INDEX `idx_ai_tasks_created_at` (`created_at`)
- INDEX `idx_ai_tasks_completed_at` (`completed_at`)

---

### Workspace Orchestration Domain

#### workspace_signals

**Purpose:** Meaningful user-attention items promoted from raw events, AI insight, discovery results, stale opportunities, or task/campaign state.

**Table Name:** `workspace_signals`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Foreign Key to users, Required) - Owner
- `source_type` (VARCHAR(100), Required) - Source entity category
- `source_id` (UUID, Optional) - Source entity id when applicable
- `title` (VARCHAR(255), Required) - Signal title
- `summary` (TEXT, Optional) - Brief explanation
- `importance` (VARCHAR(50), Required, Default: medium) - Importance tier
- `status` (VARCHAR(50), Required, Default: new) - Signal lifecycle status
- `priority_score` (INTEGER, Required, Default: 50) - Ranking score
- `reason` (TEXT, Optional) - Why the signal matters
- `recommended_action` (TEXT, Optional) - Suggested next move
- `recommended_workspace_mode` (VARCHAR(50), Required, Default: signal_review) - Preferred active workspace mode
- `evidence_json` (JSONB, Optional) - Supporting facts/snippets
- `metadata_json` (JSONB, Optional) - Flexible source metadata
- `surfaced_at` (TIMESTAMP, Optional) - When presented to the user
- `consumed_at` (TIMESTAMP, Optional) - When activated or resolved
- `dismissed_at` (TIMESTAMP, Optional) - When dismissed
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `importance`: 'low', 'medium', 'high', 'critical'
- `status`: 'new', 'surfaced', 'active', 'consumed', 'dismissed', 'archived'
- `recommended_workspace_mode`: 'empty', 'signal_review', 'goal_planning', 'campaign_review', 'opportunity_review', 'draft_edit', 'asset_review', 'execution_confirm', 'progress_summary'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_workspace_signals_user_id` (`user_id`)
- INDEX `idx_workspace_signals_source` (`source_type`, `source_id`)
- INDEX `idx_workspace_signals_status` (`status`)
- INDEX `idx_workspace_signals_importance` (`importance`)
- INDEX `idx_workspace_signals_priority_score` (`priority_score`)
- INDEX `idx_workspace_signals_user_status_priority` (`user_id`, `status`, `priority_score`)
- OPTIONAL UNIQUE INDEX `idx_workspace_signals_user_source_unique` (`user_id`, `source_type`, `source_id`) where `source_id` is not null

---

#### opportunity_cycles

**Purpose:** The active unit of web workflow momentum, connecting a signal or recommendation to a focused workspace and execution path.

**Table Name:** `opportunity_cycles`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Foreign Key to users, Required) - Owner
- `workspace_signal_id` (UUID, Foreign Key to workspace_signals, Optional) - Originating signal
- `goal_id` (UUID, Foreign Key to goals, Optional) - Related goal
- `strategic_campaign_id` (UUID, Foreign Key to strategic_campaigns, Optional) - Related campaign
- `opportunity_id` (UUID, Foreign Key to opportunities, Optional) - Related opportunity
- `task_id` (UUID, Foreign Key to tasks, Optional) - Related task
- `discovered_opportunity_id` (UUID, Foreign Key to discovered_opportunities, Optional) - Related discovered item
- `ai_conversation_id` (UUID, Foreign Key to ai_conversations, Optional) - Related conductor conversation
- `phase` (VARCHAR(50), Required, Default: surfaced) - Current cycle phase
- `status` (VARCHAR(50), Required, Default: active) - Cycle lifecycle status
- `workspace_mode` (VARCHAR(50), Required, Default: signal_review) - Current Active Workspace mode
- `title` (VARCHAR(255), Required) - Cycle title
- `why_it_matters` (TEXT, Optional) - User-facing rationale
- `recommended_action` (TEXT, Optional) - Recommended next action
- `priority_score` (INTEGER, Required, Default: 50) - Ranking score
- `confidence` (INTEGER, Optional) - Recommendation confidence
- `allowed_actions_json` (JSONB, Optional) - Valid actions from this state
- `state_json` (JSONB, Optional) - Workspace-specific state such as draft details or selected assets
- `started_at` (TIMESTAMP, Required) - Cycle start timestamp
- `last_advanced_at` (TIMESTAMP, Optional) - Most recent phase movement
- `completed_at` (TIMESTAMP, Optional) - Completion timestamp
- `dismissed_at` (TIMESTAMP, Optional) - Dismissal timestamp
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `phase`: 'surfaced', 'interpreted', 'proposed', 'drafting', 'awaiting_confirmation', 'executed', 'confirmed', 'completed', 'dismissed'
- `status`: 'active', 'paused', 'completed', 'dismissed', 'archived'
- `workspace_mode`: 'empty', 'signal_review', 'goal_planning', 'campaign_review', 'opportunity_review', 'draft_edit', 'asset_review', 'execution_confirm', 'progress_summary'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_opportunity_cycles_user_id` (`user_id`)
- INDEX `idx_opportunity_cycles_signal_id` (`workspace_signal_id`)
- INDEX `idx_opportunity_cycles_goal_id` (`goal_id`)
- INDEX `idx_opportunity_cycles_campaign_id` (`strategic_campaign_id`)
- INDEX `idx_opportunity_cycles_opportunity_id` (`opportunity_id`)
- INDEX `idx_opportunity_cycles_task_id` (`task_id`)
- INDEX `idx_opportunity_cycles_discovered_id` (`discovered_opportunity_id`)
- INDEX `idx_opportunity_cycles_conversation_id` (`ai_conversation_id`)
- INDEX `idx_opportunity_cycles_phase` (`phase`)
- INDEX `idx_opportunity_cycles_status` (`status`)
- INDEX `idx_opportunity_cycles_user_status_priority` (`user_id`, `status`, `priority_score`)
- INDEX `idx_opportunity_cycles_user_status_updated` (`user_id`, `status`, `updated_at`)

---

#### workspace_commands

**Purpose:** Structured execution intents from the Conductor or Active Workspace, with auditability around inputs, results, and domain mutations.

**Table Name:** `workspace_commands`

**Key Columns:**
- `id` (UUID, Primary Key) - Unique identifier
- `user_id` (UUID, Foreign Key to users, Required) - Owner
- `opportunity_cycle_id` (UUID, Foreign Key to opportunity_cycles, Optional) - Related cycle
- `ai_conversation_id` (UUID, Foreign Key to ai_conversations, Optional) - Related conductor conversation
- `command_type` (VARCHAR(100), Required) - Command identifier
- `status` (VARCHAR(50), Required, Default: pending) - Command lifecycle status
- `input_json` (JSONB, Optional) - Input payload
- `result_json` (JSONB, Optional) - Result payload
- `error_message` (TEXT, Optional) - Error details
- `started_at` (TIMESTAMP, Optional) - Execution start timestamp
- `completed_at` (TIMESTAMP, Optional) - Execution completion timestamp
- `created_at` (TIMESTAMP, Required) - Creation timestamp
- `updated_at` (TIMESTAMP, Required) - Last update timestamp

**Enums:**
- `status`: 'pending', 'running', 'succeeded', 'failed', 'cancelled'
- `command_type` examples: 'activate_signal', 'generate_draft', 'revise_draft', 'approve_draft', 'send_outreach', 'create_task', 'advance_opportunity', 'dismiss_cycle', 'complete_cycle', 'summarize_progress'

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX `idx_workspace_commands_user_id` (`user_id`)
- INDEX `idx_workspace_commands_cycle_id` (`opportunity_cycle_id`)
- INDEX `idx_workspace_commands_conversation_id` (`ai_conversation_id`)
- INDEX `idx_workspace_commands_type` (`command_type`)
- INDEX `idx_workspace_commands_status` (`status`)
- INDEX `idx_workspace_commands_created_at` (`created_at`)
- INDEX `idx_workspace_commands_user_status_created` (`user_id`, `status`, `created_at`)

---

## Key Relationships

### Offerings Domain Relationships
```
users (1) -----> (N) offerings
offerings (1) -> (N) offering_positionings
offerings (1) -> (N) offering_assets
offering_positionings (1) -> (N) offering_assets (optional)
```

### AI Conversation / Context Domain Relationships
```
users (1) -----> (N) ai_conversations
ai_conversations (1) -> (N) ai_conversation_messages
users (1) -----> (N) ai_context_summaries
users (1) -----> (N) ai_tasks

ai_conversations (1) -> (N) ai_context_summaries (derived)
ai_conversations (1) -> (N) ai_tasks (triggered)

Cross-domain relationships:
ai_conversations (N) -> (1) offerings (optional)
ai_conversations (N) -> (1) opportunities (optional)
ai_context_summaries (N) -> (1) offerings (optional)
ai_context_summaries (N) -> (1) opportunities (optional)
ai_tasks (N) -> (1) offerings (optional)
ai_tasks (N) -> (1) opportunities (optional)
```

### Workspace Orchestration Relationships
```
users (1) ---------------------> (N) workspace_signals
users (1) ---------------------> (N) opportunity_cycles
users (1) ---------------------> (N) workspace_commands

workspace_signals (1) ---------> (N) opportunity_cycles (optional origin)
opportunity_cycles (1) --------> (N) workspace_commands

opportunity_cycles (N) --------> (1) goals (optional)
opportunity_cycles (N) --------> (1) strategic_campaigns (optional)
opportunity_cycles (N) --------> (1) opportunities (optional)
opportunity_cycles (N) --------> (1) tasks (optional)
opportunity_cycles (N) --------> (1) discovered_opportunities (optional)
opportunity_cycles (N) --------> (1) ai_conversations (optional)
workspace_commands (N) --------> (1) ai_conversations (optional)
```

## Design Decisions Needed

### 1. JSON vs Structured Columns
- **Decision needed:** Whether to use JSON columns for flexible metadata vs structured columns
- **Impact:** Affects queryability and schema evolution
- **Current choice:** Mixed approach - JSON for flexible metadata, structured for core fields

### 2. Content Storage Strategy
- **Decision needed:** How to store asset content (database vs file storage vs CDN)
- **Impact:** Performance, scalability, and cost considerations
- **Current choice:** Hybrid - text content in database, file references for large assets

### 3. Context Summary Expiration
- **Decision needed:** Whether AI context summaries should expire and retention policy
- **Impact:** Storage costs and relevance of historical context
- **Current choice:** Optional expiration with usage tracking

### 4. Task Result Storage
- **Decision needed:** How much AI task result detail to store vs regenerate
- **Impact:** Storage costs vs performance and auditability
- **Current choice:** Store key results in JSON, with metadata for regeneration

### 5. Cross-Entity Referencing
- **Decision needed:** Whether to allow multiple entity references in single records
- **Impact:** Query complexity vs flexibility
- **Current choice:** Optional single references per record for clarity

### 6. Index Granularity
- **Decision needed:** How many indexes to create for query optimization
- **Impact:** Query performance vs storage and write performance
- **Current choice:** Targeted indexes for common query patterns

## Extensibility Considerations

### Future Opportunity Matching
- `offerings` table ready for matching relationships to `opportunities`
- `offering_positionings` can be linked to specific opportunity types
- `ai_context_summaries` can store compatibility insights

### AI Model Evolution
- `model_used` columns support multiple AI models
- Token tracking supports cost management
- Processing time tracking supports performance optimization

### Asset Management Evolution
- `asset_type` enum extensible for new asset categories
- `content_url` and `file_path` support multiple storage strategies
- `is_public` flag supports sharing features

### Conversation Evolution
- `purpose` enum extensible for new conversation types
- Optional entity references support new integration patterns
- Message metadata supports rich conversation features
