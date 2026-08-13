-- Test-only synthetic branch fixtures.
INSERT INTO "branches" (
  "id",
  "tenant_id",
  "name",
  "address",
  "phone",
  "timezone",
  "status"
)
VALUES
  (
    '21000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'BrightSmile Test Central',
    '101 Test Street, District 1, Ho Chi Minh City',
    '+842811000101',
    NULL,
    'ACTIVE'
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000001',
    'BrightSmile Test West',
    '202 Test Street, Thu Duc City, Ho Chi Minh City',
    '+842811000102',
    NULL,
    'ACTIVE'
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    '11000000-0000-4000-8000-000000000002',
    'Harmony Test City',
    '303 Test Street, District 7, Ho Chi Minh City',
    '+842811000103',
    NULL,
    'ACTIVE'
  )
ON CONFLICT ("id") DO NOTHING;
