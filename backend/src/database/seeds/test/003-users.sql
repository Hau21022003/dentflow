-- Test-only synthetic user fixtures.
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
    '31000000-0000-4000-8000-000000000001',
    'platform.admin@dentflow.test',
    'platform.admin@dentflow.test',
    'Synthetic Test Platform Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    'e2e.user@dentflow.test',
    'e2e.user@dentflow.test',
    'Synthetic E2E Tenant Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '31000000-0000-4000-8000-000000000003',
    'branch.admin@dentflow.test',
    'branch.admin@dentflow.test',
    'Synthetic Test Branch Admin',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  ),
  (
    '31000000-0000-4000-8000-000000000004',
    'dentist@dentflow.test',
    'dentist@dentflow.test',
    'Synthetic Test Dentist',
    'ACTIVE',
    '$2b$12$OFMsdYjCNgdKETLPShvBzunCfOVlqDxCpQp2Rw0J4YTTjb3RHFu3K',
    NOW(),
    NOW()
  )
ON CONFLICT ("email_normalized") DO UPDATE
SET
  "email" = EXCLUDED."email",
  "full_name" = EXCLUDED."full_name",
  "status" = EXCLUDED."status",
  "password_hash" = EXCLUDED."password_hash",
  "password_changed_at" = EXCLUDED."password_changed_at",
  "failed_login_attempts" = 0,
  "locked_until" = NULL,
  "email_verified_at" = EXCLUDED."email_verified_at",
  "deleted_at" = NULL,
  "updated_at" = NOW();
