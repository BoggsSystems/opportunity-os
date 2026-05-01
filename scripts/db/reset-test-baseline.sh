#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/opportunity_os}"
ALLOW_DB_RESET="${ALLOW_DB_RESET:-false}"
ALLOW_REMOTE_DB_RESET="${ALLOW_REMOTE_DB_RESET:-false}"

if [[ "$ALLOW_DB_RESET" != "true" ]]; then
  echo "Refusing to reset DB. Set ALLOW_DB_RESET=true to confirm this destructive local/test operation." >&2
  exit 1
fi

if [[ "$DATABASE_URL" != *"localhost"* && "$DATABASE_URL" != *"127.0.0.1"* && "$ALLOW_REMOTE_DB_RESET" != "true" ]]; then
  echo "Refusing to reset a non-local DATABASE_URL without ALLOW_REMOTE_DB_RESET=true." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Missing required tool: psql" >&2
  exit 1
fi

db_name="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "SELECT current_database();")"
case "$db_name" in
  opportunity_os|opportunity_os_dev|opportunity_os_test)
    ;;
  *)
    echo "Refusing to reset unexpected database '$db_name'." >&2
    echo "Allowed database names: opportunity_os, opportunity_os_dev, opportunity_os_test." >&2
    exit 1
    ;;
esac

echo "Resetting runtime/test data in database '$db_name'. Static plan/capability configuration will be preserved."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE TABLE
  action_cycles,
  action_items,
  action_lanes,
  activities,
  admin_metric_snapshots,
  admin_operational_issues,
  ai_context_summaries,
  ai_conversation_messages,
  ai_conversations,
  ai_tasks,
  asset_deployment_rules,
  asset_interactions,
  asset_narratives,
  authentication_identities,
  authentication_sessions,
  billing_customers,
  billing_events,
  browser_session_artifacts,
  browser_session_events,
  browser_session_steps,
  browser_sessions,
  calendar_events,
  campaign_assets,
  campaign_connectors,
  campaign_metrics,
  campaigns,
  capability_execution_logs,
  coaching_nudges,
  companies,
  connection_import_batches,
  connection_records,
  connection_segment_members,
  connection_segments,
  connector_credentials,
  connector_sync_states,
  conversation_thread_insights,
  conversation_thread_messages,
  conversation_threads,
  credentials,
  discovered_opportunities,
  discovery_evidence,
  discovery_provider_runs,
  discovery_scans,
  discovery_targets,
  entitlement_overrides,
  entity_tags,
  goal_progress,
  goals,
  growth_credits,
  momentum_states,
  notes,
  offering_assets,
  offering_positionings,
  offering_proposals,
  offering_thesis_mappings,
  offerings,
  opportunities,
  opportunity_cycles,
  opportunity_people,
  people,
  referral_attributions,
  referral_links,
  referral_milestones,
  referral_rewards,
  referral_visits,
  search_profiles,
  search_runs,
  strategic_theses,
  subscriptions,
  tags,
  tasks,
  technical_profiles,
  usage_counters,
  usage_records,
  user_assets,
  user_connectors,
  user_lifecycle_events,
  user_lifecycle_snapshots,
  user_postures,
  users,
  verification_tokens,
  weekly_targets,
  workspace_commands,
  workspace_signals
RESTART IDENTITY CASCADE;
SQL

echo "Baseline reset complete."
