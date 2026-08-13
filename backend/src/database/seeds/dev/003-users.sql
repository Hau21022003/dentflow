-- Development-only synthetic user fixtures.
-- Every account in this directory uses password: 12345
INSERT INTO "users" (
  "id",
  "email",
  "email_normalized",
  "full_name",
  "status",
  "password_hash",
  "password_changed_at",
  "email_verified_at"
)
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    'platform.admin@dentflow.local',
    'platform.admin@dentflow.local',
    'Synthetic Platform Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'brightsmile.admin@dentflow.local',
    'brightsmile.admin@dentflow.local',
    'Synthetic BrightSmile Tenant Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'brightsmile.ops@dentflow.local',
    'brightsmile.ops@dentflow.local',
    'Synthetic BrightSmile Branch Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'brightsmile.reception@dentflow.local',
    'brightsmile.reception@dentflow.local',
    'Synthetic BrightSmile Receptionist',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'brightsmile.dentist@dentflow.local',
    'brightsmile.dentist@dentflow.local',
    'Synthetic BrightSmile Dentist',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    'harmony.admin@dentflow.local',
    'harmony.admin@dentflow.local',
    'Synthetic Harmony Tenant Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    'harmony.reception@dentflow.local',
    'harmony.reception@dentflow.local',
    'Synthetic Harmony Receptionist',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '30000000-0000-4000-8000-000000000008',
    'riverfront.admin@dentflow.local',
    'riverfront.admin@dentflow.local',
    'Synthetic Riverfront Tenant Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;
