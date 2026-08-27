-- Test-only synthetic tenant fixtures.
INSERT INTO "tenants" (
  "id",
  "legal_name",
  "display_name",
  "slug",
  "billing_email",
  "contact_email",
  "contact_phone",
  "default_locale",
  "default_timezone",
  "status"
)
VALUES
  (
    '11000000-0000-4000-8000-000000000001',
    'Synthetic BrightSmile Test Company Limited',
    'BrightSmile Test',
    'test-brightsmile',
    'billing@brightsmile.dentflow.test',
    'contact@brightsmile.dentflow.test',
    '+842811000001',
    'vi',
    'Asia/Ho_Chi_Minh',
    'ACTIVE'
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    'Synthetic Harmony Test Company Limited',
    'Harmony Test',
    'test-harmony',
    'billing@harmony.dentflow.test',
    'contact@harmony.dentflow.test',
    '+842811000002',
    'vi',
    'Asia/Ho_Chi_Minh',
    'TRIAL'
  )
ON CONFLICT ("id") DO NOTHING;
