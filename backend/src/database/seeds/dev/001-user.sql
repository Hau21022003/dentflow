-- Development-only synthetic account.
-- Email: demo.user@dentflow.local
-- Password: synthetic-demo-password
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
  'demo.user@dentflow.local',
  'demo.user@dentflow.local',
  'Synthetic Demo User',
  'ACTIVE',
  '$2b$10$A3Fr8y4niOdo2xy6SLso8ux7zE9w.7surwofntbzsR9iHH1qLUJYe',
  NOW(),
  NOW()
)
ON CONFLICT ("email_normalized") DO NOTHING;
