-- Test-only synthetic tenant owners.
-- An owner is assigned only when the matching active tenant-level TENANT_ADMIN role exists.
UPDATE "tenants" AS "tenant"
SET "owner_user_id" = "owner"."id"
FROM (
  VALUES
    ('11000000-0000-4000-8000-000000000001'::uuid, 'e2e.user@dentflow.test'),
    ('11000000-0000-4000-8000-000000000002'::uuid, 'harmony.admin@dentflow.test')
) AS "expected_owner" ("tenant_id", "email_normalized")
JOIN "users" AS "owner"
  ON "owner"."email_normalized" = "expected_owner"."email_normalized"
JOIN "role_assignments" AS "assignment"
  ON "assignment"."user_id" = "owner"."id"
  AND "assignment"."tenant_id" = "expected_owner"."tenant_id"
  AND "assignment"."branch_id" IS NULL
  AND "assignment"."role_code" = 'TENANT_ADMIN'
  AND "assignment"."revoked_at" IS NULL
WHERE "tenant"."id" = "expected_owner"."tenant_id"
  AND "tenant"."owner_user_id" IS NULL;
