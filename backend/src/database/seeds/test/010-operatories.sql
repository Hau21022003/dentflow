-- Shared synthetic Operatory fixtures for every branch.
WITH "seed_operatories" ("code", "name", "type", "is_active") AS (
  VALUES
    ('CHAIR-01', 'Synthetic Treatment Chair 01', 'CHAIR'::"operatory_type_enum", true),
    ('CHAIR-02', 'Synthetic Treatment Chair 02', 'CHAIR'::"operatory_type_enum", true),
    ('CHAIR-03', 'Synthetic Treatment Chair 03', 'CHAIR'::"operatory_type_enum", true),
    ('FLEX-01', 'Synthetic Flexible Room', 'ROOM'::"operatory_type_enum", false)
)
INSERT INTO "operatories" (
  "id",
  "tenant_id",
  "branch_id",
  "code",
  "name",
  "type",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  md5('dentflow-operatory-' || "branch"."id"::text || '-' || "seed_operatories"."code")::uuid,
  "branch"."tenant_id",
  "branch"."id",
  "seed_operatories"."code",
  "seed_operatories"."name",
  "seed_operatories"."type",
  "seed_operatories"."is_active" AND "branch"."status" = 'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "branches" AS "branch"
CROSS JOIN "seed_operatories"
ON CONFLICT ("id") DO UPDATE SET
  "code" = EXCLUDED."code",
  "name" = EXCLUDED."name",
  "type" = EXCLUDED."type",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = CURRENT_TIMESTAMP;
