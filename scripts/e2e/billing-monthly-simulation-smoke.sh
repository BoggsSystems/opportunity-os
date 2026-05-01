#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3002}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/opportunity_os}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d%H%M%S)}"
PASSWORD="${PASSWORD:-Password123!}"
PROFILE="${PROFILE:-smoke}"

# Define profiles
case "$PROFILE" in
  smoke)
    BILLING_MONTHS=1
    USERS_PER_MONTH=10
    ;;
  standard)
    BILLING_MONTHS=6
    USERS_PER_MONTH=50
    ;;
  heavy)
    BILLING_MONTHS=12
    USERS_PER_MONTH=500
    ;;
  *)
    echo "Unknown profile: $PROFILE. Using environment variables."
    BILLING_MONTHS="${BILLING_MONTHS:-6}"
    USERS_PER_MONTH="${USERS_PER_MONTH:-50}"
    ;;
esac

# Force Mock AI for simulation
export MOCK_AI=true

TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

require_non_negative_int() {
  local name="$1"
  local value="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "$name must be a non-negative integer. Received: $value" >&2
    exit 1
  fi
}

require_tool curl
require_tool jq
require_tool psql
require_non_negative_int BILLING_MONTHS "$BILLING_MONTHS"
require_non_negative_int USERS_PER_MONTH "$USERS_PER_MONTH"

if (( BILLING_MONTHS < 1 || USERS_PER_MONTH < 1 )); then
  echo "BILLING_MONTHS and USERS_PER_MONTH must both be greater than zero." >&2
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body_file="${4:-}"
  local output_file="$TMP_DIR/response.json"
  local status_file="$TMP_DIR/status.txt"

  if [[ -n "$body_file" ]]; then
    curl -sS -X "$method" "$API_URL$path" \
      -H "content-type: application/json" \
      ${token:+-H "authorization: Bearer $token"} \
      --data-binary "@$body_file" \
      -o "$output_file" \
      -w "%{http_code}" > "$status_file"
  else
    curl -sS -X "$method" "$API_URL$path" \
      ${token:+-H "authorization: Bearer $token"} \
      -o "$output_file" \
      -w "%{http_code}" > "$status_file"
  fi

  local status
  status="$(cat "$status_file")"
  if [[ "$status" -lt 200 || "$status" -gt 299 ]]; then
    echo "HTTP $status $method $path failed" >&2
    cat "$output_file" >&2
    echo >&2
    exit 1
  fi

  cat "$output_file"
}

write_json() {
  local file="$1"
  shift
  jq -n "$@" > "$file"
}

signup_admin() {
  local payload="$TMP_DIR/admin-signup.json"
  write_json "$payload" \
    --arg email "billing-sim-admin-$RUN_ID@example.com" \
    --arg password "$PASSWORD" \
    --arg fullName "Billing Simulation Admin $RUN_ID" \
    '{email:$email,password:$password,fullName:$fullName}'
  api POST /auth/signup "" "$payload"
}

psql_exec() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@" >/dev/null
}

echo "Billing monthly simulation smoke"
echo "API_URL=$API_URL"
echo "RUN_ID=$RUN_ID"
echo "BILLING_MONTHS=$BILLING_MONTHS"
echo "USERS_PER_MONTH=$USERS_PER_MONTH"

curl -sS "$API_URL/health" >/dev/null || {
  echo "API is not reachable at $API_URL. Start the backend first." >&2
  exit 1
}

admin_json="$(signup_admin)"
admin_token="$(echo "$admin_json" | jq -r '.accessToken')"
admin_user_id="$(echo "$admin_json" | jq -r '.user.id')"

echo "Created simulation admin user"

psql_exec \
  -v run_id="$RUN_ID" \
  -v billing_months="$BILLING_MONTHS" \
  -v users_per_month="$USERS_PER_MONTH" \
  -v admin_user_id="$admin_user_id" <<'SQL'
WITH settings AS (
  SELECT
    :'run_id'::text AS run_id,
    :'billing_months'::int AS billing_months,
    :'users_per_month'::int AS users_per_month,
    :'admin_user_id'::uuid AS admin_user_id,
    date_trunc('month', now())::date AS current_month
), months AS (
  SELECT
    month_index,
    (settings.current_month - ((settings.billing_months - 1 - month_index) || ' months')::interval)::timestamp AS month_start
  FROM settings
  CROSS JOIN generate_series(0, settings.billing_months - 1) AS month_index
), created_users AS (
  INSERT INTO users (id, email, "fullName", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid(),
    'billing-sim-' || settings.run_id || '-m' || months.month_index || '-u' || user_number || '@example.com',
    'Billing Sim User ' || months.month_index || '-' || user_number,
    months.month_start + ((user_number % 20) || ' days')::interval,
    months.month_start + ((user_number % 20) || ' days')::interval
  FROM settings
  JOIN months ON true
  CROSS JOIN generate_series(1, (SELECT users_per_month FROM settings)) AS user_number
  RETURNING id, email, "createdAt"
), numbered_users AS (
  SELECT
    created_users.*,
    row_number() OVER (ORDER BY "createdAt", email) AS global_number
  FROM created_users
), free_plan AS (
  SELECT id FROM plans WHERE code = 'free_explorer' LIMIT 1
), inserted_free_subscriptions AS (
  INSERT INTO subscriptions (
    id,
    "userId",
    "planId",
    status,
    provider,
    "billingInterval",
    "startedAt",
    "currentPeriodStart",
    "currentPeriodEnd",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    numbered_users.id,
    free_plan.id,
    'active',
    'e2e-billing-sim-free',
    'monthly',
    numbered_users."createdAt",
    date_trunc('month', numbered_users."createdAt"),
    date_trunc('month', numbered_users."createdAt") + interval '1 month',
    numbered_users."createdAt",
    numbered_users."createdAt"
  FROM numbered_users
  CROSS JOIN free_plan
), visits AS (
  INSERT INTO referral_visits (
    id, "referralLinkId", "referrerUserId", "visitorId", "guestSessionId", "landingPath", "createdAt"
  )
  SELECT
    gen_random_uuid(),
    referral_links.id,
    referral_links."userId",
    'visitor-' || settings.run_id || '-' || months.month_index || '-' || visit_number,
    'gs-' || settings.run_id || '-' || months.month_index || '-' || visit_number,
    '/',
    months.month_start + ((visit_number % 28) || ' days')::interval
  FROM settings
  JOIN months ON true
  CROSS JOIN referral_links
  CROSS JOIN generate_series(1, (SELECT (users_per_month * 3) FROM settings)) AS visit_number
), referred_users AS (
  SELECT numbered_users.*
  FROM numbered_users
  WHERE numbered_users.global_number % 5 != 0
), attributions AS (
  INSERT INTO referral_attributions (
    id,
    "referralLinkId",
    "referrerUserId",
    "referredUserId",
    "attributionSource",
    "attributedAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    referral_links.id,
    referral_links."userId",
    referred_users.id,
    'billing_simulation',
    referred_users."createdAt",
    referred_users."createdAt",
    referred_users."createdAt"
  FROM referred_users
  CROSS JOIN referral_links
  RETURNING id, "referredUserId", "attributedAt"
), inserted_milestones AS (
  INSERT INTO referral_milestones (
    id,
    "referralAttributionId",
    "milestoneType",
    "occurredAt",
    "sourceEntityType",
    "metadataJson",
    "createdAt"
  )
  SELECT
    gen_random_uuid(),
    attributions.id,
    'signup',
    attributions."attributedAt",
    'billing_simulation',
    jsonb_build_object('runId', (SELECT run_id FROM settings)),
    attributions."attributedAt"
  FROM attributions
), inserted_lifecycle AS (
  INSERT INTO user_lifecycle_snapshots (
    id,
    "userId",
    "currentStage",
    "furthestStage",
    "activatedAt",
    "lastActivityAt",
    "metadataJson",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    numbered_users.id,
    CASE 
      WHEN numbered_users.global_number % 10 <= 2 THEN 'activated'::"UserLifecycleStage"
      WHEN numbered_users.global_number % 10 <= 5 THEN 'first_action_completed'::"UserLifecycleStage"
      WHEN numbered_users.global_number % 10 <= 7 THEN 'action_lanes_selected'::"UserLifecycleStage"
      ELSE 'account_created'::"UserLifecycleStage"
    END,
    CASE 
      WHEN numbered_users.global_number % 10 <= 2 THEN 'activated'::"UserLifecycleStage"
      WHEN numbered_users.global_number % 10 <= 5 THEN 'first_action_completed'::"UserLifecycleStage"
      WHEN numbered_users.global_number % 10 <= 7 THEN 'action_lanes_selected'::"UserLifecycleStage"
      ELSE 'account_created'::"UserLifecycleStage"
    END,
    CASE WHEN numbered_users.global_number % 10 <= 2 THEN numbered_users."createdAt" + interval '5 days' ELSE null END,
    numbered_users."createdAt",
    jsonb_build_object('runId', settings.run_id, 'source', 'billing_simulation'),
    numbered_users."createdAt",
    numbered_users."createdAt"
  FROM numbered_users
  CROSS JOIN settings
), inserted_engagement_logs AS (
  INSERT INTO user_engagement_logs (
    id, "userId", "nudgeType", "sentAt", "metadataJson", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    numbered_users.id,
    'ghost_campaign',
    numbered_users."createdAt" + interval '2 days',
    jsonb_build_object('runId', settings.run_id, 'simulated', true),
    now(),
    now()
  FROM numbered_users
  CROSS JOIN settings
  WHERE numbered_users.global_number % 10 > 7 -- Matches 'account_created' stage in simulation
), inserted_external_mappings AS (
  INSERT INTO external_mappings (
    id, "userId", "localEntityType", "localEntityId", "remoteProvider", "remoteEntityId", "syncStatus", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    numbered_users.id,
    'Person',
    gen_random_uuid(), -- Synthetic person ID for simulation
    CASE WHEN numbered_users.global_number % 2 = 0 THEN 'hubspot' ELSE 'salesforce' END,
    'ext-' || gen_random_uuid(),
    'synced',
    now(),
    now()
  FROM numbered_users
  WHERE numbered_users.global_number % 10 <= 2 -- Matches 'activated' stage in simulation
)
SELECT 1;

SQL

echo "Seeded synthetic users, lifecycle snapshots, free subscriptions, and referral signups"

declare -a months=()
while IFS= read -r month; do
  months+=("$month")
done < <(
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At \
    -c "SELECT to_char(date_trunc('month', now())::date - (($BILLING_MONTHS - 1 - month_index) || ' months')::interval, 'YYYY-MM') FROM generate_series(0, $BILLING_MONTHS - 1) AS month_index ORDER BY month_index;"
)

month_number=0
for month in "${months[@]}"; do
  month_number=$((month_number + 1))
  paid_users=$((USERS_PER_MONTH + month_number * USERS_PER_MONTH / 2))
  failed_users=$((month_number * USERS_PER_MONTH / 20))
  churned_users=$((month_number * USERS_PER_MONTH / 25))
  usage_users=$((USERS_PER_MONTH + month_number * USERS_PER_MONTH / 2))

  psql_exec \
    -v run_id="$RUN_ID" \
    -v month="$month" \
    -v paid_users="$paid_users" \
    -v failed_users="$failed_users" \
    -v churned_users="$churned_users" \
    -v usage_users="$usage_users" <<'SQL'
DELETE FROM subscriptions WHERE provider = 'e2e-billing-sim';

WITH period AS (
  SELECT
    to_date(:'month', 'YYYY-MM')::timestamp AS period_start,
    (to_date(:'month', 'YYYY-MM') + interval '1 month')::timestamp AS period_end
), builder_plan AS (
  SELECT id FROM plans WHERE code = 'builder' LIMIT 1
), eligible_users AS (
  SELECT
    users.id,
    users."createdAt",
    row_number() OVER (ORDER BY users."createdAt", users.email) AS rn
  FROM users
  CROSS JOIN period
  WHERE users.email LIKE ('billing-sim-' || :'run_id' || '-%')
    AND users."createdAt" < period.period_end
), paid AS (
  INSERT INTO subscriptions (
    id,
    "userId",
    "planId",
    status,
    provider,
    "billingInterval",
    "startedAt",
    "currentPeriodStart",
    "currentPeriodEnd",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    eligible_users.id,
    builder_plan.id,
    'active',
    'e2e-billing-sim',
    'monthly',
    greatest(eligible_users."createdAt" + interval '14 days', period.period_start),
    period.period_start,
    period.period_end,
    period.period_start,
    period.period_start
  FROM eligible_users
  CROSS JOIN builder_plan
  CROSS JOIN period
  WHERE eligible_users.rn <= :'paid_users'::int
  RETURNING "userId"
), failed AS (
  INSERT INTO subscriptions (
    id,
    "userId",
    "planId",
    status,
    provider,
    "billingInterval",
    "startedAt",
    "currentPeriodStart",
    "currentPeriodEnd",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    eligible_users.id,
    builder_plan.id,
    'past_due',
    'e2e-billing-sim',
    'monthly',
    greatest(eligible_users."createdAt" + interval '14 days', period.period_start),
    period.period_start,
    period.period_end,
    period.period_start,
    period.period_start + interval '20 days'
  FROM eligible_users
  CROSS JOIN builder_plan
  CROSS JOIN period
  WHERE eligible_users.rn > :'paid_users'::int
    AND eligible_users.rn <= :'paid_users'::int + :'failed_users'::int
  RETURNING "userId"
), churned AS (
  INSERT INTO subscriptions (
    id,
    "userId",
    "planId",
    status,
    provider,
    "billingInterval",
    "startedAt",
    "currentPeriodStart",
    "currentPeriodEnd",
    "endedAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    eligible_users.id,
    builder_plan.id,
    'canceled',
    'e2e-billing-sim',
    'monthly',
    greatest(eligible_users."createdAt" + interval '14 days', period.period_start - interval '1 month'),
    period.period_start,
    period.period_end,
    period.period_start + interval '24 days',
    period.period_start,
    period.period_start + interval '24 days'
  FROM eligible_users
  CROSS JOIN builder_plan
  CROSS JOIN period
  WHERE eligible_users.rn > :'paid_users'::int + :'failed_users'::int
    AND eligible_users.rn <= :'paid_users'::int + :'failed_users'::int + :'churned_users'::int
  RETURNING "userId"
), paid_attributions AS (
  SELECT referral_attributions.id, referral_attributions."referredUserId"
  FROM referral_attributions
  JOIN paid ON paid."userId" = referral_attributions."referredUserId"
), inserted_paid_milestones AS (
  INSERT INTO referral_milestones (
    id,
    "referralAttributionId",
    "milestoneType",
    "occurredAt",
    "sourceEntityType",
    "metadataJson",
    "createdAt"
  )
  SELECT
    gen_random_uuid(),
    paid_attributions.id,
    'paid_conversion',
    period.period_start + interval '15 days',
    'billing_simulation',
    jsonb_build_object('runId', :'run_id', 'month', :'month'),
    period.period_start + interval '15 days'
  FROM paid_attributions
  CROSS JOIN period
  ON CONFLICT ("referralAttributionId", "milestoneType") DO NOTHING
  RETURNING id
), usage_users AS (
  SELECT
    eligible_users.id,
    eligible_users.rn
  FROM eligible_users
  WHERE eligible_users.rn <= :'usage_users'::int
), inserted_campaigns AS (
  INSERT INTO campaigns (
    id,
    "userId",
    title,
    description,
    objective,
    "targetSegment",
    status,
    "priorityScore",
    "metadataJson",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    usage_users.id,
    'Billing Sim Campaign ' || :'month' || ' #' || usage_users.rn,
    'Synthetic campaign usage for admin analytics simulation.',
    'Drive qualified conversations through monthly action cycles.',
    'Synthetic growth audience',
    CASE WHEN usage_users.rn % 11 = 0 THEN 'COMPLETED'::"CampaignStatus" ELSE 'ACTIVE'::"CampaignStatus" END,
    50 + (usage_users.rn % 40),
    jsonb_build_object('runId', :'run_id', 'month', :'month', 'usageRank', usage_users.rn),
    period.period_start + ((usage_users.rn % 18) || ' days')::interval,
    period.period_start + ((usage_users.rn % 18) || ' days')::interval
  FROM usage_users
  CROSS JOIN period
  RETURNING id, "userId", "createdAt", "metadataJson"
), inserted_lanes AS (
  INSERT INTO action_lanes (
    id,
    "campaignId",
    "laneType",
    title,
    description,
    strategy,
    status,
    "priorityScore",
    "metadataJson",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_campaigns.id,
    CASE
      WHEN (inserted_campaigns."metadataJson"->>'usageRank')::int % 5 = 0 THEN 'linkedin_dm'::"ActionLaneType"
      WHEN (inserted_campaigns."metadataJson"->>'usageRank')::int % 5 = 1 THEN 'email'::"ActionLaneType"
      WHEN (inserted_campaigns."metadataJson"->>'usageRank')::int % 5 = 2 THEN 'linkedin_content'::"ActionLaneType"
      WHEN (inserted_campaigns."metadataJson"->>'usageRank')::int % 5 = 3 THEN 'warm_intro'::"ActionLaneType"
      ELSE 'linkedin_commenting'::"ActionLaneType"
    END,
    'Simulation lane ' || :'month',
    'Synthetic lane for campaign analytics.',
    'Execute targeted outreach.',
    'ACTIVE'::"ActionLaneStatus",
    60,
    inserted_campaigns."metadataJson",
    inserted_campaigns."createdAt",
    inserted_campaigns."createdAt"
  FROM inserted_campaigns
  RETURNING id, "campaignId", "laneType", "createdAt", "metadataJson"
), inserted_cycles AS (
  INSERT INTO action_cycles (
    id,
    "campaignId",
    "actionLaneId",
    "cycleNumber",
    title,
    objective,
    "actionType",
    status,
    "priorityScore",
    "startsAt",
    "endsAt",
    "executedAt",
    "confirmedAt",
    "metadataJson",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_lanes."campaignId",
    inserted_lanes.id,
    1,
    'Monthly cycle ' || :'month',
    'Simulation action cycle.',
    CASE
      WHEN inserted_lanes."laneType" = 'linkedin_dm' THEN 'linkedin_dm'
      WHEN inserted_lanes."laneType" = 'email' THEN 'email'
      WHEN inserted_lanes."laneType" = 'linkedin_content' THEN 'linkedin_post'
      ELSE 'other'
    END,
    CASE
      WHEN (inserted_lanes."metadataJson"->>'usageRank')::int % 7 = 0 THEN 'active'::"ActionCycleStatus"
      WHEN (inserted_lanes."metadataJson"->>'usageRank')::int % 6 = 0 THEN 'executed'::"ActionCycleStatus"
      ELSE 'completed'::"ActionCycleStatus"
    END,
    70,
    inserted_lanes."createdAt",
    inserted_lanes."createdAt" + interval '7 days',
    CASE
      WHEN (inserted_lanes."metadataJson"->>'usageRank')::int % 7 = 0 THEN null
      ELSE inserted_lanes."createdAt" + interval '2 days'
    END,
    CASE
      WHEN (inserted_lanes."metadataJson"->>'usageRank')::int % 7 = 0 THEN null
      ELSE inserted_lanes."createdAt" + interval '3 days'
    END,
    inserted_lanes."metadataJson",
    inserted_lanes."createdAt",
    inserted_lanes."createdAt" + interval '3 days'
  FROM inserted_lanes
  RETURNING id, "campaignId", "actionLaneId", "actionType", "createdAt", "metadataJson"
), inserted_items AS (
  INSERT INTO action_items (
    id,
    "userId",
    "campaignId",
    "actionLaneId",
    "actionCycleId",
    "actionType",
    title,
    instructions,
    status,
    "priorityScore",
    "dueAt",
    "completedAt",
    "respondedAt",
    "metadataJson",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_campaigns."userId",
    inserted_cycles."campaignId",
    inserted_cycles."actionLaneId",
    inserted_cycles.id,
    inserted_cycles."actionType",
    'Sim Action ' || action_template.item_number,
    'Simulated action.',
    CASE
      WHEN ((inserted_cycles."metadataJson"->>'usageRank')::int + action_template.item_number) % 15 = 0 THEN 'converted'::"ActionItemStatus"
      WHEN ((inserted_cycles."metadataJson"->>'usageRank')::int + action_template.item_number) % 8 = 0 THEN 'responded'::"ActionItemStatus"
      WHEN ((inserted_cycles."metadataJson"->>'usageRank')::int + action_template.item_number) % 4 != 0 THEN 'sent_confirmed'::"ActionItemStatus"
      ELSE 'suggested'::"ActionItemStatus"
    END,
    60 + action_template.item_number,
    inserted_cycles."createdAt" + (action_template.item_number || ' days')::interval,
    CASE
      WHEN ((inserted_cycles."metadataJson"->>'usageRank')::int + action_template.item_number) % 15 = 0
        OR ((inserted_cycles."metadataJson"->>'usageRank')::int + action_template.item_number) % 4 != 0
      THEN inserted_cycles."createdAt" + (action_template.item_number || ' days')::interval
      ELSE null
    END,
    CASE
      WHEN ((inserted_cycles."metadataJson"->>'usageRank')::int + action_template.item_number) % 8 = 0
      THEN inserted_cycles."createdAt" + ((action_template.item_number + 2) || ' days')::interval
      ELSE null
    END,
    jsonb_build_object('runId', :'run_id', 'month', :'month'),
    inserted_cycles."createdAt",
    inserted_cycles."createdAt" + (action_template.item_number || ' days')::interval
  FROM inserted_cycles
  JOIN inserted_campaigns ON inserted_campaigns.id = inserted_cycles."campaignId"
  CROSS JOIN (VALUES (1), (2), (3)) AS action_template(item_number)
  RETURNING id, "userId", "campaignId", "actionLaneId", "completedAt", "respondedAt"
), inserted_threads AS (
  INSERT INTO conversation_threads (
    id, "userId", "campaignId", "actionLaneId", "actionItemId", "channel", "status", "lastMessageAt", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_items."userId",
    inserted_items."campaignId",
    inserted_items."actionLaneId",
    inserted_items.id,
    'linkedin',
    'active',
    inserted_items."respondedAt",
    COALESCE(inserted_items."respondedAt", now()),
    COALESCE(inserted_items."respondedAt", now())
  FROM inserted_items
  WHERE inserted_items."respondedAt" IS NOT NULL
  RETURNING id, "userId", "lastMessageAt"
), inserted_messages AS (
  INSERT INTO conversation_thread_messages (
    id, "userId", "threadId", "direction", "source", "bodyText", "attachmentUrls", "attachmentMimeTypes", "occurredAt", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_threads."userId",
    inserted_threads.id,
    'inbound'::"ConversationMessageDirection",
    'manual_paste'::"ConversationMessageSource",
    'I am interested in your offering. Can we hop on a call?',
    '{}'::text[],
    '{}'::text[],
    inserted_threads."lastMessageAt",
    inserted_threads."lastMessageAt",
    inserted_threads."lastMessageAt"
  FROM inserted_threads
)
SELECT
  (SELECT count(*) FROM inserted_paid_milestones) AS paid_milestones,
  (SELECT count(*) FROM inserted_campaigns) AS campaigns,
  (SELECT count(*) FROM inserted_cycles) AS cycles,
  (SELECT count(*) FROM inserted_items) AS actions,
  (SELECT count(*) FROM inserted_threads) AS threads;
SQL

  payload="$TMP_DIR/snapshot-$month.json"
  write_json "$payload" --arg month "$month" '{month:$month}'
  snapshot_json="$(api POST /admin/metrics/snapshots/monthly "$admin_token" "$payload")"
  snapshot_count="$(echo "$snapshot_json" | jq -r '.count')"
  last_snapshot_count="$snapshot_count"
  echo "Snapshot $month: paid=$paid_users failed=$failed_users churned=$churned_users usageUsers=$usage_users rows=$snapshot_count"
done

history_json="$(api GET "/admin/metrics/snapshots?metricKey=billing.mrr_cents&limit=100" "$admin_token")"
history_count="$(echo "$history_json" | jq -r '.count')"
if [[ "$history_count" -lt "$BILLING_MONTHS" ]]; then
  echo "Expected at least $BILLING_MONTHS billing.mrr_cents snapshots, got $history_count" >&2
  exit 1
fi

echo "Verified monthly billing snapshot history with $history_count billing.mrr_cents rows"

last_month="${months[$((BILLING_MONTHS - 1))]}"
payload="$TMP_DIR/snapshot-idempotency-$last_month.json"
write_json "$payload" --arg month "$last_month" '{month:$month}'
api POST /admin/metrics/snapshots/monthly "$admin_token" "$payload" >/dev/null
last_month_rows="$(
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At -v month="$last_month" <<'SQL'
SELECT count(*)
FROM admin_metric_snapshots
WHERE "periodStart" = to_date(:'month', 'YYYY-MM')::timestamp;
SQL
)"
if [[ "$last_month_rows" != "$last_snapshot_count" ]]; then
  echo "Expected idempotent recompute to leave $last_snapshot_count rows for $last_month, got $last_month_rows" >&2
  exit 1
fi
echo "Verified idempotent monthly recompute for $last_month"

echo "Billing monthly simulation smoke completed for RUN_ID=$RUN_ID"
