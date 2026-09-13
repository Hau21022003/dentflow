-- Development-only synthetic SaaS plan catalog.
-- These plans bill a tenant for DentFlow; they are unrelated to clinical payments.
INSERT INTO "subscription_plans" (
  "id",
  "code",
  "name",
  "description",
  "billing_interval",
  "amount",
  "currency",
  "provider_plan_id",
  "trial_days",
  "entitlements",
  "is_active"
)
VALUES
  (
    '60000000-0000-4000-8000-000000000001',
    'basic-monthly',
    'Basic Monthly',
    'For a single-branch dental clinic with up to 6 users.',
    'MONTHLY',
    499000,
    'VND',
    NULL,
    14,
    '{"analytics": false, "maxBranches": 1, "maxUsers": 6}'::jsonb,
    true
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'pro-monthly',
    'Pro Monthly',
    'For a single-branch dental clinic with up to 12 users and analytics.',
    'MONTHLY',
    999000,
    'VND',
    NULL,
    14,
    '{"analytics": true, "maxBranches": 1, "maxUsers": 12}'::jsonb,
    true
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    'enterprise-monthly',
    'Enterprise Monthly',
    'For a multi-branch dental group with up to 20 branches and 100 users.',
    'MONTHLY',
    2499000,
    'VND',
    NULL,
    14,
    '{"analytics": true, "maxBranches": 20, "maxUsers": 100}'::jsonb,
    true
  ),
  (
    '60000000-0000-4000-8000-000000000004',
    'basic-yearly',
    'Basic Yearly',
    'Annual Basic plan for a single-branch dental clinic with up to 6 users.',
    'YEARLY',
    4990000,
    'VND',
    NULL,
    14,
    '{"analytics": false, "maxBranches": 1, "maxUsers": 6}'::jsonb,
    true
  ),
  (
    '60000000-0000-4000-8000-000000000005',
    'pro-yearly',
    'Pro Yearly',
    'Annual Pro plan for a single-branch dental clinic with up to 12 users and analytics.',
    'YEARLY',
    9990000,
    'VND',
    NULL,
    14,
    '{"analytics": true, "maxBranches": 1, "maxUsers": 12}'::jsonb,
    true
  ),
  (
    '60000000-0000-4000-8000-000000000006',
    'enterprise-yearly',
    'Enterprise Yearly',
    'Annual Enterprise plan for a multi-branch dental group with up to 20 branches and 100 users.',
    'YEARLY',
    24990000,
    'VND',
    NULL,
    14,
    '{"analytics": true, "maxBranches": 20, "maxUsers": 100}'::jsonb,
    true
  )
ON CONFLICT ("code") DO NOTHING;
