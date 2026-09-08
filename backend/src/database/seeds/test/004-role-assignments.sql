-- Test-only synthetic authorization fixtures.
INSERT INTO "platform_role_assignments" (
  "id",
  "user_id",
  "role_code",
  "assignment_reason"
)
VALUES (
  '41000000-0000-4000-8000-000000000001',
  (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
  'PLATFORM_ADMIN',
  'Synthetic test platform operator'
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "role_assignments" (
  "id",
  "user_id",
  "tenant_id",
  "branch_id",
  "role_code",
  "assigned_by_user_id",
  "assignment_reason"
)
VALUES
  (
    '51000000-0000-4000-8000-000000000001',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'e2e.user@dentflow.test'),
    '11000000-0000-4000-8000-000000000001',
    NULL,
    'TENANT_ADMIN',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
    'Synthetic E2E tenant administrator'
  ),
  (
    '51000000-0000-4000-8000-000000000002',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'branch.admin@dentflow.test'),
    '11000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'BRANCH_ADMIN',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
    'Synthetic test branch administrator'
  ),
  (
    '51000000-0000-4000-8000-000000000003',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'branch.admin@dentflow.test'),
    '11000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'RECEPTIONIST',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
    'Synthetic test receptionist role'
  ),
  (
    '51000000-0000-4000-8000-000000000004',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'dentist@dentflow.test'),
    '11000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000003',
    'DENTIST',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
    'Synthetic test dentist'
  ),
  (
    '51000000-0000-4000-8000-000000000005',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'branch.admin@dentflow.test'),
    '11000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000002',
    'BRANCH_ADMIN',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
    'Synthetic test branch administrator for a second branch'
  ),
  (
    '51000000-0000-4000-8000-000000000006',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'branch.admin@dentflow.test'),
    '11000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000002',
    'RECEPTIONIST',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
    'Synthetic test receptionist role for a second branch'
  ),
  (
    '51000000-0000-4000-8000-000000000007',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'harmony.admin@dentflow.test'),
    '11000000-0000-4000-8000-000000000002',
    NULL,
    'TENANT_ADMIN',
    (SELECT "id" FROM "users" WHERE "email_normalized" = 'platform.admin@dentflow.test'),
    'Synthetic Harmony test tenant administrator'
  )
ON CONFLICT ("id") DO NOTHING;
