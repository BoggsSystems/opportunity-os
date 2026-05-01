#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3002}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/opportunity_os}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d%H%M%S)}"
PASSWORD="${PASSWORD:-Password123!}"
DIRECT_USERS="${DIRECT_USERS:-2}"
REFERRED_USERS="${REFERRED_USERS:-4}"
REFERRAL_VISITS="${REFERRAL_VISITS:-10}"
ONBOARDED_USERS="${ONBOARDED_USERS:-4}"
FIRST_ACTION_USERS="${FIRST_ACTION_USERS:-3}"
CONNECTED_CONNECTOR_USERS="${CONNECTED_CONNECTOR_USERS:-2}"
FAILED_CONNECTOR_USERS="${FAILED_CONNECTOR_USERS:-1}"
PAID_USERS="${PAID_USERS:-2}"
ADMIN_USERS_LIMIT="${ADMIN_USERS_LIMIT:-20}"
PRINT_ADMIN_RESPONSES="${PRINT_ADMIN_RESPONSES:-true}"
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

require_tool curl
require_tool jq

require_non_negative_int() {
  local name="$1"
  local value="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "$name must be a non-negative integer. Received: $value" >&2
    exit 1
  fi
}

for setting_name in \
  DIRECT_USERS \
  REFERRED_USERS \
  REFERRAL_VISITS \
  ONBOARDED_USERS \
  FIRST_ACTION_USERS \
  CONNECTED_CONNECTOR_USERS \
  FAILED_CONNECTOR_USERS \
  PAID_USERS \
  ADMIN_USERS_LIMIT; do
  require_non_negative_int "$setting_name" "${!setting_name}"
done

TOTAL_SIMULATED_USERS=$((DIRECT_USERS + REFERRED_USERS))
if (( TOTAL_SIMULATED_USERS < 1 )); then
  echo "At least one simulated user is required." >&2
  exit 1
fi

if (( REFERRAL_VISITS < REFERRED_USERS )); then
  echo "REFERRAL_VISITS must be >= REFERRED_USERS so every referred signup can attach to a visit." >&2
  exit 1
fi

if (( ONBOARDED_USERS > TOTAL_SIMULATED_USERS )); then
  ONBOARDED_USERS="$TOTAL_SIMULATED_USERS"
fi

if (( FIRST_ACTION_USERS > ONBOARDED_USERS )); then
  FIRST_ACTION_USERS="$ONBOARDED_USERS"
fi

if (( CONNECTED_CONNECTOR_USERS > TOTAL_SIMULATED_USERS )); then
  CONNECTED_CONNECTOR_USERS="$TOTAL_SIMULATED_USERS"
fi

remaining_for_failed_connectors=$((TOTAL_SIMULATED_USERS - CONNECTED_CONNECTOR_USERS))
if (( FAILED_CONNECTOR_USERS > remaining_for_failed_connectors )); then
  FAILED_CONNECTOR_USERS="$remaining_for_failed_connectors"
fi

if (( PAID_USERS > TOTAL_SIMULATED_USERS )); then
  PAID_USERS="$TOTAL_SIMULATED_USERS"
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

signup() {
  local email="$1"
  local name="$2"
  local referral_code="${3:-}"
  local referral_visit_id="${4:-}"
  local visitor_id="${5:-}"
  local payload="$TMP_DIR/signup-$email.json"

  if [[ -n "$referral_code" ]]; then
    write_json "$payload" \
      --arg email "$email" \
      --arg password "$PASSWORD" \
      --arg fullName "$name" \
      --arg referralCode "$referral_code" \
      --arg referralVisitId "$referral_visit_id" \
      --arg referralVisitorId "$visitor_id" \
      '{email:$email,password:$password,fullName:$fullName,referralCode:$referralCode,referralVisitId:$referralVisitId,referralVisitorId:$referralVisitorId}'
  else
    write_json "$payload" \
      --arg email "$email" \
      --arg password "$PASSWORD" \
      --arg fullName "$name" \
      '{email:$email,password:$password,fullName:$fullName}'
  fi

  api POST /auth/signup "" "$payload"
}

record_visit() {
  local referral_code="$1"
  local visitor_id="$2"
  local payload="$TMP_DIR/visit-$visitor_id.json"
  write_json "$payload" \
    --arg referralCode "$referral_code" \
    --arg visitorId "$visitor_id" \
    --arg runId "$RUN_ID" \
    '{
      referralCode:$referralCode,
      visitorId:$visitorId,
      landingPath:"/",
      landingUrl:("http://localhost:5174/?ref=" + $referralCode + "&utm_campaign=" + $runId),
      referrerUrl:"https://example.com/e2e",
      utmSource:"e2e",
      utmMedium:"simulation",
      utmCampaign:$runId,
      metadata:{runId:$runId}
    }'
  api POST /me/referrals/visits "" "$payload"
}

finalize_onboarding() {
  local token="$1"
  local user_number="$2"
  local campaign_id="campaign-$RUN_ID-$user_number"
  local lane_id="lane-$RUN_ID-$user_number"
  local payload="$TMP_DIR/onboarding-$user_number.json"
  write_json "$payload" \
    --arg campaignId "$campaign_id" \
    --arg laneId "$lane_id" \
    --arg runId "$RUN_ID" \
    --arg title "Professor Outreach $user_number" \
    '{
      campaigns:[{
        id:$campaignId,
        title:$title,
        description:"Outreach to professors about the AI-Native Software Engineering book.",
        laneTitle:"AI-Native Software Engineering Book",
        targetSegment:"Software engineering and CS professors",
        goalMetric:"5 qualified academic conversations",
        messagingHook:"Connect around curriculum relevance and AI-native engineering practice.",
        duration:"30 days",
        channel:"linkedin"
      }],
      actionLanes:[{
        id:$laneId,
        title:"LinkedIn DM outreach to professors",
        description:"Use LinkedIn DMs to start thoughtful academic conversations.",
        type:"linkedin_dm",
        campaignIds:[$campaignId],
        tactics:["Identify professors","Draft a concise DM","Confirm sent manually"],
        requiredConnectors:["linkedin"]
      }],
      selectedCampaignIds:[$campaignId],
      selectedActionLaneIds:[$laneId],
      activationSelection:{campaignId:$campaignId,laneId:$laneId},
      comprehensiveSynthesis:("E2E admin growth-loop simulation " + $runId)
    }'
  api POST /campaign-orchestration/onboarding/finalize "$token" "$payload"
}

confirm_action_item() {
  local token="$1"
  local action_item_id="$2"
  local payload="$TMP_DIR/confirm-$action_item_id.json"
  write_json "$payload" \
    '{finalContent:"Hi Professor, I am reaching out about AI-native software engineering curriculum ideas.",confirmationSource:"user_confirmed",outcome:"sent"}'
  api POST "/campaign-orchestration/action-items/$action_item_id/confirm" "$token" "$payload" >/dev/null
}

record_paid_referral_milestone() {
  local token="$1"
  local payload="$TMP_DIR/paid-milestone.json"
  write_json "$payload" '{milestoneType:"paid_conversion",sourceEntityType:"e2e"}'
  api POST /me/referrals/milestones "$token" "$payload" >/dev/null
}

psql_exec() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql not found; skipping DB-backed connector/paid simulation" >&2
    return 0
  fi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "$1" >/dev/null
}

simulate_connector() {
  local user_id="$1"
  local provider="$2"
  local status="$3"
  psql_exec "
    WITH cap AS (
      INSERT INTO capabilities (id, \"capabilityType\", \"name\", \"isActive\", \"createdAt\", \"updatedAt\")
      VALUES (gen_random_uuid(), 'email', 'Email', true, now(), now())
      ON CONFLICT (\"capabilityType\") DO UPDATE SET \"updatedAt\" = excluded.\"updatedAt\"
      RETURNING id
    ), provider AS (
      INSERT INTO capability_providers (id, \"capabilityId\", \"providerName\", \"displayName\", \"isActive\", \"authType\", \"createdAt\", \"updatedAt\")
      SELECT gen_random_uuid(), id, '$provider', '$provider', true, 'oauth', now(), now() FROM cap
      ON CONFLICT (\"capabilityId\", \"providerName\") DO UPDATE SET \"updatedAt\" = excluded.\"updatedAt\"
      RETURNING id, \"capabilityId\"
    )
    INSERT INTO user_connectors (id, \"userId\", \"capabilityId\", \"capabilityProviderId\", \"connectorName\", status, \"createdAt\", \"updatedAt\")
    SELECT gen_random_uuid(), '$user_id'::uuid, \"capabilityId\", id, 'E2E $provider', '$status'::\"ConnectorStatus\", now(), now() FROM provider
    ON CONFLICT (\"userId\", \"capabilityId\") DO UPDATE SET status = excluded.status, \"updatedAt\" = now();
  "
}

simulate_paid_subscription() {
  local user_id="$1"
  psql_exec "
    UPDATE subscriptions
    SET status = 'canceled', \"updatedAt\" = now()
    WHERE \"userId\" = '$user_id'::uuid AND status = 'active';

    INSERT INTO subscriptions (id, \"userId\", \"planId\", status, provider, \"billingInterval\", \"startedAt\", \"currentPeriodStart\", \"currentPeriodEnd\", \"createdAt\", \"updatedAt\")
    SELECT gen_random_uuid(), '$user_id'::uuid, id, 'active', 'e2e', 'monthly', now(), date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', now(), now()
    FROM plans
    WHERE code = 'builder';
  "
}

admin_get() {
  local token="$1"
  local path="$2"
  if [[ "$PRINT_ADMIN_RESPONSES" == "true" ]]; then
    echo
    echo "### GET $path"
    api GET "$path" "$token" | jq .
  else
    api GET "$path" "$token" >/dev/null
    echo "Verified GET $path"
  fi
}

echo "Admin growth-loop smoke"
echo "API_URL=$API_URL"
echo "RUN_ID=$RUN_ID"
echo "DIRECT_USERS=$DIRECT_USERS"
echo "REFERRED_USERS=$REFERRED_USERS"
echo "REFERRAL_VISITS=$REFERRAL_VISITS"
echo "ONBOARDED_USERS=$ONBOARDED_USERS"
echo "FIRST_ACTION_USERS=$FIRST_ACTION_USERS"
echo "CONNECTED_CONNECTOR_USERS=$CONNECTED_CONNECTOR_USERS"
echo "FAILED_CONNECTOR_USERS=$FAILED_CONNECTOR_USERS"
echo "PAID_USERS=$PAID_USERS"

curl -sS "$API_URL/health" >/dev/null || {
  echo "API is not reachable at $API_URL. Start the backend first." >&2
  exit 1
}

referrer_email="e2e-referrer-$RUN_ID@example.com"
referrer_json="$(signup "$referrer_email" "E2E Referrer $RUN_ID")"
admin_token="${ADMIN_TOKEN:-$(echo "$referrer_json" | jq -r '.accessToken')}"
referrer_token="$(echo "$referrer_json" | jq -r '.accessToken')"
referrer_user_id="$(echo "$referrer_json" | jq -r '.user.id')"

echo "Created referrer: $referrer_email"
admin_get "$admin_token" /admin/overview >/dev/null

referral_link="$(api GET /me/referral-link "$referrer_token")"
referral_code="$(echo "$referral_link" | jq -r '.code')"
echo "Referral code: $referral_code"

declare -a visit_ids=()
declare -a visitor_ids=()
for ((i = 1; i <= REFERRAL_VISITS; i++)); do
  visitor_id="visitor-$RUN_ID-$i"
  visitor_ids+=("$visitor_id")
  visit_json="$(record_visit "$referral_code" "$visitor_id")"
  visit_ids+=("$(echo "$visit_json" | jq -r '.id')")
done
echo "Recorded ${#visit_ids[@]} referral visits"

declare -a user_ids=()
declare -a tokens=()
declare -a is_referred=()

for ((i = 1; i <= DIRECT_USERS; i++)); do
  email="e2e-direct-$RUN_ID-$i@example.com"
  auth_json="$(signup "$email" "E2E Direct $i")"
  user_ids+=("$(echo "$auth_json" | jq -r '.user.id')")
  tokens+=("$(echo "$auth_json" | jq -r '.accessToken')")
  is_referred+=("false")
done

for ((i = 1; i <= REFERRED_USERS; i++)); do
  email="e2e-referred-$RUN_ID-$i@example.com"
  auth_json="$(signup "$email" "E2E Referred $i" "$referral_code" "${visit_ids[$((i-1))]}" "${visitor_ids[$((i-1))]}")"
  user_ids+=("$(echo "$auth_json" | jq -r '.user.id')")
  tokens+=("$(echo "$auth_json" | jq -r '.accessToken')")
  is_referred+=("true")
done
echo "Created ${#user_ids[@]} simulated users"
admin_get "$admin_token" /admin/funnel >/dev/null

declare -a first_action_ids=()
for ((index = 0; index < ONBOARDED_USERS; index++)); do
  onboarding_json="$(finalize_onboarding "${tokens[$index]}" "$((index + 1))")"
  first_action_ids+=("$(echo "$onboarding_json" | jq -r '.firstActionItem.id')")
done
echo "Finalized onboarding for $ONBOARDED_USERS users"
admin_get "$admin_token" /admin/campaigns >/dev/null

for ((index = 0; index < FIRST_ACTION_USERS; index++)); do
  confirm_action_item "${tokens[$index]}" "${first_action_ids[$index]}"
done
echo "Confirmed first action for $FIRST_ACTION_USERS users"

for ((index = 0; index < CONNECTED_CONNECTOR_USERS; index++)); do
  simulate_connector "${user_ids[$index]}" outlook connected
done

failed_connector_start="$CONNECTED_CONNECTOR_USERS"
failed_connector_end=$((CONNECTED_CONNECTOR_USERS + FAILED_CONNECTOR_USERS))
for ((index = failed_connector_start; index < failed_connector_end; index++)); do
  simulate_connector "${user_ids[$index]}" outlook error
done
echo "Simulated connector states through DB-backed setup"

declare -a paid_indices=()
for ((index = DIRECT_USERS; index < TOTAL_SIMULATED_USERS && ${#paid_indices[@]} < PAID_USERS; index++)); do
  paid_indices+=("$index")
done
for ((index = 0; index < DIRECT_USERS && ${#paid_indices[@]} < PAID_USERS; index++)); do
  paid_indices+=("$index")
done

paid_referral_milestones=0
for index in "${paid_indices[@]}"; do
  simulate_paid_subscription "${user_ids[$index]}"
  if [[ "${is_referred[$index]}" == "true" ]]; then
    record_paid_referral_milestone "${tokens[$index]}"
    paid_referral_milestones=$((paid_referral_milestones + 1))
  fi
done
echo "Simulated ${#paid_indices[@]} paid users and $paid_referral_milestones referral paid-conversion milestones"

echo
echo "Final admin analytics"
admin_get "$admin_token" /admin/overview
admin_get "$admin_token" /admin/funnel
admin_get "$admin_token" "/admin/users?query=e2e-&limit=$ADMIN_USERS_LIMIT"
admin_get "$admin_token" /admin/connectors
admin_get "$admin_token" /admin/billing-referrals
admin_get "$admin_token" /admin/operations/issues

echo
echo "Admin growth-loop smoke completed for RUN_ID=$RUN_ID"
