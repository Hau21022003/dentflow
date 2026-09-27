-- Synthetic BrightSmile appointment fixture. Dates are relative to the branch's operating timezone.
WITH "config" AS (
  SELECT
    "tenant"."id" AS "tenant_id",
    "branch"."id" AS "branch_id",
    COALESCE("branch"."timezone", "tenant"."default_timezone") AS "time_zone",
    "assignment"."user_id" AS "actor_user_id"
  FROM "tenants" AS "tenant"
  INNER JOIN "branches" AS "branch" ON "branch"."tenant_id" = "tenant"."id"
  INNER JOIN "role_assignments" AS "assignment"
    ON "assignment"."tenant_id" = "tenant"."id"
    AND "assignment"."branch_id" = "branch"."id"
    AND "assignment"."role_code" = 'BRANCH_ADMIN'
    AND "assignment"."revoked_at" IS NULL
  WHERE "tenant"."slug" = 'test-brightsmile' AND "branch"."slug" = 'central'
),
"calendar" AS (
  SELECT
    "config".*,
    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE "time_zone")::date AS "current_month_start",
    (CURRENT_TIMESTAMP AT TIME ZONE "time_zone")::date AS "today"
  FROM "config"
),
"schedule" AS (
  SELECT
    "calendar".*,
    "n",
    CASE
      WHEN "n" <= 20 THEN ("current_month_start" - INTERVAL '1 month')::date + ("n" - 1)
      WHEN "n" <= 32 THEN "today"
      WHEN "n" <= 60 THEN "current_month_start" + (("today" - "current_month_start" + "n" - 33) % (("current_month_start" + INTERVAL '1 month')::date - "current_month_start"))
      ELSE ("current_month_start" + INTERVAL '1 month')::date + ("n" - 61)
    END AS "scheduled_date",
    CASE
      WHEN "n" <= 10 OR "n" BETWEEN 17 AND 20 THEN 'COMPLETED'
      WHEN "n" BETWEEN 11 AND 13 THEN 'CANCELLED'
      WHEN "n" BETWEEN 14 AND 16 THEN 'NO_SHOW'
      WHEN "n" BETWEEN 21 AND 24 THEN 'IN_PROGRESS'
      WHEN "n" BETWEEN 25 AND 28 THEN 'CHECKED_IN'
      WHEN "n" BETWEEN 29 AND 34 OR "n" BETWEEN 51 AND 60 THEN 'CONFIRMED'
      ELSE 'BOOKED'
    END::"appointment_status_enum" AS "status"
  FROM "calendar"
  CROSS JOIN generate_series(1, 80) AS "n"
),
"dentists" AS (
  SELECT
    ROW_NUMBER() OVER (ORDER BY "user"."full_name") AS "position",
    "user"."id" AS "user_id"
  FROM "config"
  INNER JOIN "role_assignments" AS "assignment"
    ON "assignment"."tenant_id" = "config"."tenant_id"
    AND "assignment"."branch_id" = "config"."branch_id"
    AND "assignment"."role_code" = 'DENTIST'
    AND "assignment"."revoked_at" IS NULL
  INNER JOIN "users" AS "user" ON "user"."id" = "assignment"."user_id"
  WHERE "user"."full_name" IN ('BS. Nguyễn Minh Tuấn', 'BS. Trần Ngọc Mai', 'BS. Lê Hoàng Phúc')
),
"seed_appointments" AS (
  SELECT
    md5('brightsmile-appointment-' || "schedule"."n")::uuid AS "id",
    "schedule"."tenant_id",
    "schedule"."branch_id",
    "patient"."id" AS "patient_id",
    "schedule"."status",
    (ARRAY['PHONE', 'ONLINE', 'WALK_IN', 'OTHER'])[1 + ("schedule"."n" - 1) % 4]::"appointment_source_enum" AS "source",
    (("schedule"."scheduled_date"::timestamp + TIME '08:00' + (("schedule"."n" - 1) / 3 % 6) * INTERVAL '2 hours') AT TIME ZONE "schedule"."time_zone") AS "start_at",
    "service"."duration_minutes",
    "dentists"."user_id" AS "assigned_dentist_user_id",
    "service"."id" AS "service_id",
    "service"."code" AS "service_code",
    "service"."name" AS "service_name",
    "service"."amount" AS "service_amount",
    "service"."currency" AS "service_currency"
  FROM "schedule"
  INNER JOIN "dentists" ON "dentists"."position" = 1 + ("schedule"."n" - 1) % 3
  INNER JOIN "patients" AS "patient"
    ON "patient"."tenant_id" = "schedule"."tenant_id"
    AND "patient"."id" = ('22000000-0000-4000-8000-' || lpad((1 + ("schedule"."n" - 1) % 22)::text, 12, '0'))::uuid
  INNER JOIN "services" AS "service"
    ON "service"."tenant_id" = "schedule"."tenant_id"
    AND "service"."code" = (ARRAY['consultation-new', 'scaling-polishing', 'composite-filling-1-surface', 'simple-extraction'])[1 + ("schedule"."n" - 1) % 4]
    AND "service"."is_active" = true
)
INSERT INTO "appointments" (
  "id", "tenant_id", "branch_id", "patient_id", "status", "source", "start_at", "end_at",
  "assigned_dentist_user_id", "service_id", "service_code", "service_name", "service_amount",
  "service_currency", "service_duration_minutes", "visit_reason", "operational_note", "created_at", "updated_at"
)
SELECT
  "id", "tenant_id", "branch_id", "patient_id", "status", "source", "start_at", "start_at" + "duration_minutes" * INTERVAL '1 minute',
  "assigned_dentist_user_id", "service_id", "service_code", "service_name", "service_amount",
  "service_currency", "duration_minutes", NULL, 'Synthetic appointment fixture for calendar testing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "seed_appointments"
ON CONFLICT ("id") DO UPDATE SET
  "patient_id" = EXCLUDED."patient_id", "status" = EXCLUDED."status", "source" = EXCLUDED."source",
  "start_at" = EXCLUDED."start_at", "end_at" = EXCLUDED."end_at", "assigned_dentist_user_id" = EXCLUDED."assigned_dentist_user_id",
  "service_id" = EXCLUDED."service_id", "service_code" = EXCLUDED."service_code", "service_name" = EXCLUDED."service_name",
  "service_amount" = EXCLUDED."service_amount", "service_currency" = EXCLUDED."service_currency",
  "service_duration_minutes" = EXCLUDED."service_duration_minutes", "visit_reason" = EXCLUDED."visit_reason",
  "operational_note" = EXCLUDED."operational_note", "updated_at" = CURRENT_TIMESTAMP;

WITH "config" AS (
  SELECT "tenant"."id" AS "tenant_id", "branch"."id" AS "branch_id", "assignment"."user_id" AS "actor_user_id"
  FROM "tenants" AS "tenant"
  INNER JOIN "branches" AS "branch" ON "branch"."tenant_id" = "tenant"."id"
  INNER JOIN "role_assignments" AS "assignment" ON "assignment"."tenant_id" = "tenant"."id" AND "assignment"."branch_id" = "branch"."id" AND "assignment"."role_code" = 'BRANCH_ADMIN' AND "assignment"."revoked_at" IS NULL
  WHERE "tenant"."slug" = 'test-brightsmile' AND "branch"."slug" = 'central'
)
INSERT INTO "appointment_status_transitions" ("id", "appointment_id", "tenant_id", "branch_id", "from_status", "to_status", "reason_code", "changed_by_user_id", "occurred_at")
SELECT
  md5('brightsmile-transition-' || "appointment"."id"::text || '-' || "transition"."step")::uuid,
  "appointment"."id", "config"."tenant_id", "config"."branch_id", "transition"."from_status", "transition"."to_status", "transition"."reason_code", "config"."actor_user_id",
  LEAST(CURRENT_TIMESTAMP, "appointment"."start_at" - INTERVAL '2 hours' + "transition"."step" * INTERVAL '15 minutes')
FROM "config"
INNER JOIN "appointments" AS "appointment" ON "appointment"."tenant_id" = "config"."tenant_id" AND "appointment"."branch_id" = "config"."branch_id"
CROSS JOIN LATERAL (
  VALUES
    (1, NULL::"appointment_status_enum", 'BOOKED'::"appointment_status_enum", NULL::varchar, true),
    (2, 'BOOKED'::"appointment_status_enum", 'CONFIRMED'::"appointment_status_enum", NULL::varchar, "appointment"."status" IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')),
    (3, 'CONFIRMED'::"appointment_status_enum", 'CHECKED_IN'::"appointment_status_enum", NULL::varchar, "appointment"."status" IN ('CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')),
    (4, 'CHECKED_IN'::"appointment_status_enum", 'IN_PROGRESS'::"appointment_status_enum", NULL::varchar, "appointment"."status" IN ('IN_PROGRESS', 'COMPLETED')),
    (5, 'IN_PROGRESS'::"appointment_status_enum", 'COMPLETED'::"appointment_status_enum", NULL::varchar, "appointment"."status" = 'COMPLETED'),
    (6, 'BOOKED'::"appointment_status_enum", 'CANCELLED'::"appointment_status_enum", 'PATIENT_CANCELLED'::varchar, "appointment"."status" = 'CANCELLED'),
    (7, 'BOOKED'::"appointment_status_enum", 'NO_SHOW'::"appointment_status_enum", 'PATIENT_NO_SHOW'::varchar, "appointment"."status" = 'NO_SHOW')
) AS "transition"("step", "from_status", "to_status", "reason_code", "applies")
WHERE "appointment"."id" IN (SELECT md5('brightsmile-appointment-' || "n")::uuid FROM generate_series(1, 80) AS "n")
  AND "transition"."applies"
ON CONFLICT ("id") DO NOTHING;

WITH "config" AS (
  SELECT "tenant"."id" AS "tenant_id", "branch"."id" AS "branch_id"
  FROM "tenants" AS "tenant"
  INNER JOIN "branches" AS "branch" ON "branch"."tenant_id" = "tenant"."id"
  WHERE "tenant"."slug" = 'test-brightsmile' AND "branch"."slug" = 'central'
)
INSERT INTO "visits" (
  "id", "tenant_id", "branch_id", "appointment_id", "opened_by_user_id", "status",
  "symptoms", "relevant_history", "examination", "diagnosis", "clinical_note", "created_at", "updated_at"
)
SELECT
  md5('brightsmile-visit-' || "appointment"."id"::text)::uuid,
  "config"."tenant_id", "config"."branch_id", "appointment"."id", "appointment"."assigned_dentist_user_id",
  CASE WHEN "appointment"."status" = 'COMPLETED' THEN 'COMPLETED' ELSE 'OPEN' END::"visit_status_enum",
  'Synthetic sensitivity follow-up', 'Synthetic history reviewed', 'Synthetic examination completed',
  CASE WHEN "appointment"."status" = 'COMPLETED' THEN 'Synthetic completed diagnosis' ELSE NULL END,
  CASE WHEN "appointment"."status" = 'COMPLETED' THEN 'Synthetic completed clinical note' ELSE 'Synthetic visit in progress' END,
  "appointment"."start_at", LEAST(CURRENT_TIMESTAMP, "appointment"."end_at")
FROM "config"
INNER JOIN "appointments" AS "appointment" ON "appointment"."tenant_id" = "config"."tenant_id" AND "appointment"."branch_id" = "config"."branch_id"
WHERE "appointment"."id" IN (SELECT md5('brightsmile-appointment-' || "n")::uuid FROM generate_series(1, 80) AS "n")
  AND "appointment"."status" IN ('IN_PROGRESS', 'COMPLETED')
ON CONFLICT ("appointment_id") DO UPDATE SET
  "status" = EXCLUDED."status", "symptoms" = EXCLUDED."symptoms", "relevant_history" = EXCLUDED."relevant_history",
  "examination" = EXCLUDED."examination", "diagnosis" = EXCLUDED."diagnosis", "clinical_note" = EXCLUDED."clinical_note",
  "updated_at" = EXCLUDED."updated_at";
