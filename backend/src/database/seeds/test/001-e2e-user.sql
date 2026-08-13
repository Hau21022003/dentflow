-- Browser E2E-only synthetic account.
-- Email: e2e.user@dentflow.test
-- Password: synthetic-e2e-password
INSERT INTO "users" (
  "email",
  "email_normalized",
  "full_name",
  "status",
  "password_hash",
  "password_changed_at",
  "email_verified_at"
)
VALUES (
  'e2e.user@dentflow.test',
  'e2e.user@dentflow.test',
  'Synthetic E2E User',
  'ACTIVE',
  '$2b$12$9TVrvA.5WfoLh9cUjXPDlu/d6VsByMV2w32ssWulIrfl1K6Zq2Lpm',
  NOW(),
  NOW()
);
