-- Development-only synthetic tenant fixtures.
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
    '10000000-0000-4000-8000-000000000001',
    'BrightSmile Dental Company Limited',
    'BrightSmile Dental',
    'brightsmile-dental',
    'billing@brightsmile.dentflow.local',
    'contact@brightsmile.dentflow.local',
    '+842800000001',
    'vi',
    'Asia/Ho_Chi_Minh',
    'ACTIVE'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Harmony Dental Services Company Limited',
    'Harmony Dental',
    'harmony-dental',
    'billing@harmony.dentflow.local',
    'contact@harmony.dentflow.local',
    '+842800000002',
    'vi',
    'Asia/Ho_Chi_Minh',
    'TRIAL'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Riverfront Dental Clinic Company Limited',
    'Riverfront Dental',
    'riverfront-dental',
    'billing@riverfront.dentflow.local',
    'contact@riverfront.dentflow.local',
    '+842800000003',
    'vi',
    'Asia/Ho_Chi_Minh',
    'ACTIVE'
  )
ON CONFLICT ("id") DO NOTHING;
