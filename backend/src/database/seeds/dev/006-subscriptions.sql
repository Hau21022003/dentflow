-- Development-only synthetic SaaS subscriptions for the tenant fixtures.
-- The period values are relative so ACTIVE/TRIAL examples remain usable after reseeding.
INSERT INTO "subscriptions" (
  "id",
  "tenant_id",
  "plan_id",
  "provider_customer_id",
  "provider_subscription_id",
  "status",
  "current_period_start",
  "current_period_end",
  "canceled_at"
)
SELECT
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  "id",
  NULL,
  NULL,
  'ACTIVE',
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '25 days',
  NULL
FROM "subscription_plans"
WHERE "code" = 'enterprise-monthly'
ON CONFLICT DO NOTHING;

INSERT INTO "subscriptions" (
  "id",
  "tenant_id",
  "plan_id",
  "provider_customer_id",
  "provider_subscription_id",
  "status",
  "current_period_start",
  "current_period_end",
  "canceled_at"
)
SELECT
  '70000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  "id",
  NULL,
  NULL,
  'TRIAL',
  NOW(),
  NOW() + INTERVAL '14 days',
  NULL
FROM "subscription_plans"
WHERE "code" = 'basic-monthly'
ON CONFLICT DO NOTHING;

INSERT INTO "subscriptions" (
  "id",
  "tenant_id",
  "plan_id",
  "provider_customer_id",
  "provider_subscription_id",
  "status",
  "current_period_start",
  "current_period_end",
  "canceled_at"
)
SELECT
  '70000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003',
  "id",
  NULL,
  NULL,
  'ACTIVE',
  NOW() - INTERVAL '30 days',
  NOW() + INTERVAL '335 days',
  NULL
FROM "subscription_plans"
WHERE "code" = 'enterprise-yearly'
ON CONFLICT DO NOTHING;
