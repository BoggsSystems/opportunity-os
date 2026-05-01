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
  nexus)
    BILLING_MONTHS=24
    USERS_PER_MONTH=200
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

if [[ -z "${JEFF_POWER_USER:-}" ]]; then
  if [[ "$PROFILE" == "nexus" ]]; then
    JEFF_POWER_USER=true
  else
    JEFF_POWER_USER=false
  fi
fi
JEFF_EMAIL="${JEFF_EMAIL:-jeff_boggs@hotmail.com}"
JEFF_ACTIONS_PER_DAY="${JEFF_ACTIONS_PER_DAY:-100}"

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
require_non_negative_int JEFF_ACTIONS_PER_DAY "$JEFF_ACTIONS_PER_DAY"

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
echo "JEFF_POWER_USER=$JEFF_POWER_USER"
echo "JEFF_ACTIONS_PER_DAY=$JEFF_ACTIONS_PER_DAY"

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

if [[ "$JEFF_POWER_USER" == "true" ]]; then
  psql_exec \
    -v run_id="$RUN_ID" \
    -v jeff_email="$JEFF_EMAIL" <<'SQL'
DELETE FROM subscriptions
WHERE provider = 'e2e-jeff-power-user'
  AND "userId" IN (SELECT id FROM users WHERE email = :'jeff_email');

WITH settings AS (
  SELECT
    :'run_id'::text AS run_id,
    :'jeff_email'::text AS jeff_email,
    (date_trunc('month', now())::date - interval '11 months')::timestamp AS start_at
), jeff_user AS (
  INSERT INTO users (id, email, "fullName", timezone, "createdAt", "updatedAt")
  SELECT
    gen_random_uuid(),
    settings.jeff_email,
    'Jeff Boggs',
    'America/Toronto',
    settings.start_at,
    settings.start_at
  FROM settings
  ON CONFLICT (email) DO UPDATE SET
    "fullName" = EXCLUDED."fullName",
    timezone = EXCLUDED.timezone,
    "updatedAt" = now()
  RETURNING id, email, "createdAt"
), builder_plan AS (
  SELECT id FROM plans WHERE code = 'builder' LIMIT 1
), jeff_subscription AS (
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
    jeff_user.id,
    builder_plan.id,
    'active',
    'e2e-jeff-power-user',
    'monthly',
    settings.start_at,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month',
    settings.start_at,
    now()
  FROM jeff_user
  CROSS JOIN builder_plan
  CROSS JOIN settings
), jeff_lifecycle AS (
  INSERT INTO user_lifecycle_snapshots (
    id,
    "userId",
    "currentStage",
    "furthestStage",
    "onboardingStartedAt",
    "onboardingCompletedAt",
    "firstCampaignGeneratedAt",
    "actionLanesSelectedAt",
    "connectorReadyAt",
    "firstActionPrimedAt",
    "firstActionCompletedAt",
    "activatedAt",
    "paidAt",
    "lastActivityAt",
    "metadataJson",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    jeff_user.id,
    'paid'::"UserLifecycleStage",
    'paid'::"UserLifecycleStage",
    settings.start_at,
    settings.start_at + interval '1 day',
    settings.start_at + interval '1 day',
    settings.start_at + interval '1 day',
    settings.start_at + interval '1 day',
    settings.start_at + interval '2 days',
    settings.start_at + interval '2 days',
    settings.start_at + interval '2 days',
    settings.start_at + interval '2 days',
    now(),
    jsonb_build_object('runId', settings.run_id, 'source', 'nexus_jeff_power_user', 'targetActionsPerDay', 100),
    settings.start_at,
    now()
  FROM jeff_user
  CROSS JOIN settings
  ON CONFLICT ("userId") DO UPDATE SET
    "currentStage" = EXCLUDED."currentStage",
    "furthestStage" = EXCLUDED."furthestStage",
    "firstActionCompletedAt" = EXCLUDED."firstActionCompletedAt",
    "activatedAt" = EXCLUDED."activatedAt",
    "paidAt" = EXCLUDED."paidAt",
    "lastActivityAt" = EXCLUDED."lastActivityAt",
    "metadataJson" = EXCLUDED."metadataJson",
    "updatedAt" = now()
), offering_seed (
  title,
  offering_type,
  summary,
  target_audience,
  positioning,
  price_range,
  primary_channels,
  assets
) AS (
  VALUES
    ('AI-Native SDLC Audit', 'consulting', 'A high-value consulting audit that evaluates software delivery and identifies where AI-native engineering can improve velocity, team structure, quality, and cost.', 'CTOs, CIOs, VPs of Engineering, Heads of Product, PE operating partners, and enterprise software leaders.', 'Find out where your software organization is leaking velocity and how AI-native engineering can transform delivery.', '$25,000-$150,000', ARRAY['LinkedIn','Email','Executive referrals','Webinars'], ARRAY['Audit overview PDF','AI-native SDLC maturity model','Velocity baseline worksheet','Executive briefing deck','Discovery call script','ROI calculator','Sample audit report']),
    ('AI-Native SDLC Transformation', 'consulting', 'A larger implementation offering that redesigns delivery around AI-native workflows, orchestration, decomposition, verification, and governance.', 'Enterprise technology leaders, private equity portfolio companies, financial firms, SaaS companies, and software organizations under pressure to do more with smaller teams.', 'Move from traditional software delivery to an AI-native operating model.', '$150,000-$500,000+', ARRAY['LinkedIn','Email','Executive referrals','Workshops'], ARRAY['Transformation roadmap','Executive proposal','Before/after team model diagrams','AI-native pod structure','Governance framework','Implementation plan','Case study template']),
    ('AI-Native Software Engineering Book', 'book', 'A thought-leadership product explaining the new physics of software velocity when AI collapses execution cost.', 'Software engineers, architects, CTOs, founders, recruiters, engineering managers, consultants, and leaders studying the future of software work.', 'The book for leaders trying to understand what software engineering becomes when AI collapses execution cost.', 'Low-ticket product with high strategic authority value', ARRAY['LinkedIn','Email','YouTube Shorts','Recruiter conversations'], ARRAY['Amazon book link','LinkedIn launch posts','Chapter excerpts','Executive briefing version','Recruiter outreach message','Quote cards','Book-to-consulting bridge copy']),
    ('Executive AI-Native Engineering Briefing', 'advisory_program', 'A 60-minute to full-day leadership briefing on AI-native software engineering, maturity, and practical next steps.', 'CTOs, software executives, PE portfolio leaders, innovation teams, engineering directors, and transformation leaders.', 'Bring your leadership team up to speed on what AI-native software engineering means for velocity, cost, quality, and team structure.', '$2,500-$25,000', ARRAY['LinkedIn','Email','Executive referrals','Webinars'], ARRAY['Workshop landing page','Briefing deck','Agenda','Booking page','Readiness checklist','Workshop proposal','Post-workshop action plan']),
    ('Opportunity OS / Opportunity Platform', 'platform', 'An AI-powered revenue operating system for consultants, founders, creators, authors, and business builders.', 'Independent consultants, freelancers, small agencies, founders, authors, coaches, B2B service providers, and solo operators.', 'Your AI-powered operating system for finding, shaping, and executing revenue opportunities.', '$49-$299/month and higher team tiers', ARRAY['LinkedIn','Email','Founder communities','Demo calls','Referrals'], ARRAY['Product landing page','Onboarding flow','Daily action dashboard','CRM pipeline','Outreach generator','Demo video','Founder story']),
    ('AI-First MVP App Development', 'service', 'A product development service for rapidly building MVPs and working software using an AI-native development process.', 'Startup founders, solo entrepreneurs, small business owners, product managers, local businesses, and non-technical founders.', 'Get from idea to working software faster using an AI-native development process.', '$2,500-$25,000+', ARRAY['LinkedIn','Email','Founder communities','Local business outreach'], ARRAY['MVP package page','Portfolio examples','App screenshots','Pricing packages','Discovery questionnaire','Proposal template','Case study template']),
    ('Capital Markets Software Architecture', 'consulting', 'AI-native software architecture and development for trading tools, WPF applications, risk systems, analytics dashboards, and capital markets modernization.', 'Trading firms, hedge funds, banks, fintech companies, risk teams, front-office technology groups, and recruiters seeking senior engineering talent.', 'AI-native software architecture and development for trading, risk, and capital markets systems.', 'Contract, fractional architecture, project consulting, or role pursuit', ARRAY['LinkedIn','Email','Recruiter conversations','Technical content'], ARRAY['Capital markets resume version','Trading systems portfolio page','WPF demo','Options pricing architecture','Monte Carlo / Ray architecture','Recruiter outreach messages','Technical case study']),
    ('Robot Fleet Platform', 'platform', 'A future-facing platform for orchestrating fleets of robots, humanoids, drones, and autonomous machines through simulation, digital twins, telemetry, and workflow integration.', 'Warehouses, malls, resorts, property managers, logistics companies, industrial operators, security firms, and robotics-adjacent organizations.', 'Lower your labor costs with fleets of autonomous robots.', '$25,000-$250,000+ pilots', ARRAY['LinkedIn','Email','Industry outreach','Pilot proposals','Investor conversations'], ARRAY['Simulation demo','Digital twin architecture','Azure architecture diagram','Fleet dashboard','ROI model','Industry pitch decks','Pilot proposal','Robot task library'])
), inserted_offerings AS (
  INSERT INTO offerings (
    id,
    "userId",
    title,
    description,
    "offeringType",
    status,
    "externalId",
    source,
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    jeff_user.id,
    offering_seed.title,
    concat(
      offering_seed.summary,
      E'\n\nTarget audience: ', offering_seed.target_audience,
      E'\n\nPositioning: ', offering_seed.positioning,
      E'\n\nPrice range: ', offering_seed.price_range,
      E'\n\nPrimary channels: ', array_to_string(offering_seed.primary_channels, ', ')
    ),
    offering_seed.offering_type::"OfferingType",
    'active'::"OfferingStatus",
    'nexus-jeff-' || lower(regexp_replace(offering_seed.title, '[^a-zA-Z0-9]+', '-', 'g')),
    'nexus_jeff_power_user',
    settings.start_at,
    now()
  FROM offering_seed
  CROSS JOIN jeff_user
  CROSS JOIN settings
  RETURNING id, title, description, "createdAt"
), inserted_positioning AS (
  INSERT INTO offering_positionings (id, "offeringId", title, description, status, "createdAt", "updatedAt")
  SELECT
    gen_random_uuid(),
    inserted_offerings.id,
    inserted_offerings.title || ' - Primary Positioning',
    split_part(inserted_offerings.description, E'\n\nPrice range:', 1),
    'active'::"OfferingPositioningStatus",
    inserted_offerings."createdAt",
    now()
  FROM inserted_offerings
  RETURNING id
), asset_seed AS (
  SELECT
    inserted_offerings.id AS offering_id,
    inserted_offerings.title AS offering_title,
    unnest(offering_seed.assets) AS asset_title
  FROM inserted_offerings
  JOIN offering_seed ON offering_seed.title = inserted_offerings.title
)
INSERT INTO offering_assets (
  id,
  "offeringId",
  title,
  description,
  "assetType",
  "contentText",
  "isPublic",
  status,
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  asset_seed.offering_id,
  asset_seed.asset_title,
  'Seeded support asset for ' || asset_seed.offering_title,
  CASE
    WHEN asset_seed.asset_title ILIKE '%deck%' THEN 'document'::"OfferingAssetType"
    WHEN asset_seed.asset_title ILIKE '%video%' THEN 'video'::"OfferingAssetType"
    WHEN asset_seed.asset_title ILIKE '%case study%' THEN 'case_study'::"OfferingAssetType"
    ELSE 'document'::"OfferingAssetType"
  END,
  'Synthetic Nexus Audit asset context for ' || asset_seed.asset_title,
  false,
  'active'::"OfferingStatus",
  now(),
  now()
FROM asset_seed;
SQL
  echo "Seeded Jeff power-user profile and offerings"
fi

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

  if [[ "$JEFF_POWER_USER" == "true" ]]; then
    psql_exec \
      -v run_id="$RUN_ID" \
      -v month="$month" \
      -v jeff_email="$JEFF_EMAIL" \
      -v jeff_actions_per_day="$JEFF_ACTIONS_PER_DAY" <<'SQL'
WITH settings AS (
  SELECT
    :'run_id'::text AS run_id,
    :'jeff_email'::text AS jeff_email,
    :'jeff_actions_per_day'::int AS actions_per_day,
    to_date(:'month', 'YYYY-MM')::timestamp AS period_start,
    (to_date(:'month', 'YYYY-MM') + interval '1 month')::timestamp AS period_end
), jeff_user AS (
  SELECT users.id
  FROM users
  JOIN settings ON users.email = settings.jeff_email
), jeff_offerings AS (
  SELECT
    offerings.id,
    offerings.title,
    row_number() OVER (ORDER BY offerings.title) AS offering_rank
  FROM offerings
  JOIN jeff_user ON jeff_user.id = offerings."userId"
  WHERE offerings.source = 'nexus_jeff_power_user'
), campaign_seed AS (
  SELECT
    jeff_offerings.id AS offering_id,
    jeff_offerings.title AS offering_title,
    jeff_offerings.offering_rank,
    campaign_template.campaign_rank,
    campaign_template.angle,
    campaign_template.target_segment
  FROM jeff_offerings
  CROSS JOIN (VALUES
    (1, 'greenfield-outreach', 'High-intent prospects and executive buyers'),
    (2, 'authority-content', 'LinkedIn audience and warm network'),
    (3, 'warm-network-reactivation', 'Existing contacts and weak ties'),
    (4, 'booking-and-follow-up', 'Prospects ready for calls and next steps')
  ) AS campaign_template(campaign_rank, angle, target_segment)
), inserted_campaigns AS (
  INSERT INTO campaigns (
    id,
    "userId",
    "offeringId",
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
    jeff_user.id,
    campaign_seed.offering_id,
    campaign_seed.offering_title || ' - ' || campaign_seed.angle || ' - ' || :'month',
    'Jeff Nexus Audit power-user campaign for ' || campaign_seed.offering_title || '.',
    'Generate high-velocity revenue actions across email, LinkedIn, content, comments, calls, and follow-up.',
    campaign_seed.target_segment,
    'ACTIVE'::"CampaignStatus",
    80 + campaign_seed.campaign_rank,
    jsonb_build_object(
      'runId', settings.run_id,
      'month', :'month',
      'source', 'nexus_jeff_power_user',
      'offeringTitle', campaign_seed.offering_title,
      'campaignRank', campaign_seed.campaign_rank
    ),
    settings.period_start + ((campaign_seed.offering_rank + campaign_seed.campaign_rank) || ' hours')::interval,
    settings.period_start + ((campaign_seed.offering_rank + campaign_seed.campaign_rank) || ' hours')::interval
  FROM campaign_seed
  CROSS JOIN jeff_user
  CROSS JOIN settings
  RETURNING id, "userId", "offeringId", title, "metadataJson", "createdAt"
), lane_seed AS (
  SELECT
    inserted_campaigns.id AS campaign_id,
    inserted_campaigns."userId" AS user_id,
    inserted_campaigns."metadataJson",
    inserted_campaigns."createdAt",
    lane_template.lane_rank,
    lane_template.lane_type,
    lane_template.action_type,
    lane_template.title,
    lane_template.description
  FROM inserted_campaigns
  CROSS JOIN (VALUES
    (1, 'email'::"ActionLaneType", 'email', 'Email Outreach', 'Targeted outbound emails and follow-ups.'),
    (2, 'linkedin_dm'::"ActionLaneType", 'linkedin_dm', 'LinkedIn DM Outreach', 'Direct messages and reply handling.'),
    (3, 'linkedin_content'::"ActionLaneType", 'linkedin_post', 'LinkedIn Content', 'Posts, article snippets, quote cards, and launch content.'),
    (4, 'linkedin_commenting'::"ActionLaneType", 'linkedin_comment', 'LinkedIn Commenting', 'Comments and replies on relevant posts.'),
    (5, 'call_outreach'::"ActionLaneType", 'book_call', 'Call Booking', 'Call booking, prep, and follow-up motions.')
  ) AS lane_template(lane_rank, lane_type, action_type, title, description)
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
    lane_seed.campaign_id,
    lane_seed.lane_type,
    lane_seed.title,
    lane_seed.description,
    'Power-user daily execution lane for Jeff Nexus Audit simulation.',
    'ACTIVE'::"ActionLaneStatus",
    85,
    lane_seed."metadataJson" || jsonb_build_object('laneRank', lane_seed.lane_rank, 'actionType', lane_seed.action_type),
    lane_seed."createdAt",
    lane_seed."createdAt"
  FROM lane_seed
  RETURNING id, "campaignId", "laneType", title, "metadataJson", "createdAt"
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
    inserted_lanes.title || ' cycle ' || :'month',
    'Sustain approximately ' || settings.actions_per_day || ' daily revenue actions for Jeff.',
    inserted_lanes."metadataJson"->>'actionType',
    'completed'::"ActionCycleStatus",
    90,
    settings.period_start,
    settings.period_end - interval '1 second',
    settings.period_start + interval '2 days',
    settings.period_end - interval '1 day',
    inserted_lanes."metadataJson" || jsonb_build_object('source', 'nexus_jeff_power_user', 'month', :'month'),
    settings.period_start,
    settings.period_end - interval '1 day'
  FROM inserted_lanes
  CROSS JOIN settings
  RETURNING id, "campaignId", "actionLaneId", "actionType", "metadataJson"
), day_slots AS (
  SELECT
    generate_series(settings.period_start, settings.period_end - interval '1 day', interval '1 day')::timestamp AS action_day,
    settings.actions_per_day
  FROM settings
), daily_actions AS (
  SELECT
    day_slots.action_day,
    action_number,
    row_number() OVER (ORDER BY day_slots.action_day, action_number) AS action_rank
  FROM day_slots
  CROSS JOIN LATERAL generate_series(1, day_slots.actions_per_day) AS action_number
), cycle_pool AS (
  SELECT
    inserted_cycles.*,
    inserted_lanes."laneType",
    inserted_campaigns."offeringId",
    row_number() OVER (ORDER BY (inserted_cycles."metadataJson"->>'campaignRank')::int, (inserted_cycles."metadataJson"->>'laneRank')::int) AS cycle_rank,
    count(*) OVER () AS cycle_count
  FROM inserted_cycles
  JOIN inserted_lanes ON inserted_lanes.id = inserted_cycles."actionLaneId"
  JOIN inserted_campaigns ON inserted_campaigns.id = inserted_cycles."campaignId"
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
    "draftContent",
    status,
    "confirmationRequired",
    "priorityScore",
    "dueAt",
    "preparedAt",
    "completedAt",
    "respondedAt",
    "metadataJson",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    jeff_user.id,
    cycle_pool."campaignId",
    cycle_pool."actionLaneId",
    cycle_pool.id,
    cycle_pool."actionType",
    CASE cycle_pool."actionType"
      WHEN 'email' THEN 'Send targeted email outreach'
      WHEN 'linkedin_dm' THEN 'Send LinkedIn DM or follow-up'
      WHEN 'linkedin_post' THEN 'Generate and publish LinkedIn content'
      WHEN 'linkedin_comment' THEN 'Comment or reply on relevant LinkedIn post'
      WHEN 'book_call' THEN 'Book, prep, or follow up on a call'
      ELSE 'Execute revenue action'
    END || ' #' || daily_actions.action_rank || ' for ' || :'month',
    'Jeff power-user simulated action at roughly 100 actions per day across offerings and channels.',
    'Synthetic draft content for ' || cycle_pool."actionType" || ' tied to ' || (cycle_pool."metadataJson"->>'offeringTitle') || '.',
    CASE
      WHEN daily_actions.action_rank % 97 = 0 THEN 'converted'::"ActionItemStatus"
      WHEN daily_actions.action_rank % 13 = 0 THEN 'responded'::"ActionItemStatus"
      WHEN daily_actions.action_rank % 17 = 0 THEN 'published_confirmed'::"ActionItemStatus"
      ELSE 'sent_confirmed'::"ActionItemStatus"
    END,
    true,
    80 + (daily_actions.action_number % 20),
    daily_actions.action_day + ((daily_actions.action_number % 10) || ' hours')::interval,
    daily_actions.action_day,
    daily_actions.action_day + ((daily_actions.action_number % 10) || ' hours')::interval,
    CASE
      WHEN daily_actions.action_rank % 13 = 0 THEN daily_actions.action_day + interval '2 days'
      ELSE null
    END,
    jsonb_build_object(
      'runId', settings.run_id,
      'source', 'nexus_jeff_power_user',
      'month', :'month',
      'targetActionsPerDay', settings.actions_per_day,
      'offeringTitle', cycle_pool."metadataJson"->>'offeringTitle',
      'campaignRank', cycle_pool."metadataJson"->>'campaignRank',
      'laneRank', cycle_pool."metadataJson"->>'laneRank',
      'actionRank', daily_actions.action_rank
    ),
    daily_actions.action_day,
    daily_actions.action_day + ((daily_actions.action_number % 10) || ' hours')::interval
  FROM daily_actions
  JOIN cycle_pool ON cycle_pool.cycle_rank = ((daily_actions.action_rank - 1) % cycle_pool.cycle_count) + 1
  CROSS JOIN jeff_user
  CROSS JOIN settings
  RETURNING id, "userId", "campaignId", "actionLaneId", "actionCycleId", "priorityScore", "dueAt", "completedAt", "respondedAt", "metadataJson", "title", "createdAt"
), inserted_queues AS (
  INSERT INTO daily_command_queues (
    id, "userId", "queueDate", status, title, summary, "targetActionCount", "completedActionCount", "generatedAt", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    jeff_user.id,
    day_slots.action_day::date,
    'active'::"DailyCommandQueueStatus",
    'Conductor Daily Loop - ' || to_char(day_slots.action_day, 'Mon DD'),
    'High-velocity revenue loop for Jeff.',
    settings.actions_per_day,
    settings.actions_per_day,
    day_slots.action_day,
    day_slots.action_day,
    day_slots.action_day
  FROM day_slots
  CROSS JOIN jeff_user
  CROSS JOIN settings
  ON CONFLICT ("userId", "queueDate") DO NOTHING
  RETURNING id, "userId", "queueDate"
), inserted_queue_items AS (
  INSERT INTO command_queue_items (
    id, "commandQueueId", "userId", "actionItemId", "offeringId", "campaignId", "actionLaneId", "actionCycleId", 
    position, status, title, "priorityScore", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_queues.id,
    jeff_user.id,
    inserted_items.id,
    cycle_pool."offeringId",
    inserted_items."campaignId",
    inserted_items."actionLaneId",
    inserted_items."actionCycleId",
    ((inserted_items."metadataJson"->>'actionRank')::int % settings.actions_per_day) + 1,
    'completed'::"CommandQueueItemStatus",
    inserted_items.title,
    inserted_items."priorityScore",
    inserted_items."createdAt",
    inserted_items."createdAt"
  FROM inserted_items
  JOIN inserted_queues ON inserted_queues."userId" = inserted_items."userId" AND inserted_queues."queueDate" = inserted_items."dueAt"::date
  JOIN cycle_pool ON cycle_pool.id = inserted_items."actionCycleId"
  CROSS JOIN jeff_user
  CROSS JOIN settings
  ON CONFLICT ("commandQueueId", position) DO NOTHING
), inserted_threads AS (
  INSERT INTO conversation_threads (
    id,
    "userId",
    "campaignId",
    "actionLaneId",
    "actionItemId",
    channel,
    status,
    "lastMessageAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_items."userId",
    inserted_items."campaignId",
    inserted_items."actionLaneId",
    inserted_items.id,
    CASE
      WHEN inserted_items."metadataJson"->>'laneRank' = '1' THEN 'email'
      WHEN inserted_items."metadataJson"->>'laneRank' IN ('2', '4') THEN 'linkedin'
      ELSE 'content'
    END,
    'active'::"ConversationThreadStatus",
    inserted_items."respondedAt",
    inserted_items."respondedAt",
    inserted_items."respondedAt"
  FROM inserted_items
  WHERE inserted_items."respondedAt" IS NOT NULL
  RETURNING id, "userId", "lastMessageAt", "metadataJson"
), inserted_messages AS (
  INSERT INTO conversation_thread_messages (
    id,
    "userId",
    "threadId",
    direction,
    source,
    "bodyText",
    "attachmentUrls",
    "attachmentMimeTypes",
    "occurredAt",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    inserted_threads."userId",
    inserted_threads.id,
    'inbound'::"ConversationMessageDirection",
    CASE WHEN row_number() OVER (ORDER BY inserted_threads.id) % 6 = 0 THEN 'screenshot'::"ConversationMessageSource" ELSE 'manual_paste'::"ConversationMessageSource" END,
    'Interested. Can you send more detail or suggest a time to talk?',
    CASE WHEN row_number() OVER (ORDER BY inserted_threads.id) % 6 = 0 THEN ARRAY['nexus://jeff/reply-screenshot.png'] ELSE '{}'::text[] END,
    CASE WHEN row_number() OVER (ORDER BY inserted_threads.id) % 6 = 0 THEN ARRAY['image/png'] ELSE '{}'::text[] END,
    inserted_threads."lastMessageAt",
    inserted_threads."lastMessageAt",
    inserted_threads."lastMessageAt"
  FROM inserted_threads
)
SELECT
  (SELECT count(*) FROM inserted_campaigns) AS campaigns,
  (SELECT count(*) FROM inserted_lanes) AS lanes,
  (SELECT count(*) FROM inserted_cycles) AS cycles,
  (SELECT count(*) FROM inserted_items) AS actions,
  (SELECT count(*) FROM inserted_queues) AS queues,
  (SELECT count(*) FROM inserted_threads) AS threads;
SQL
  fi

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
