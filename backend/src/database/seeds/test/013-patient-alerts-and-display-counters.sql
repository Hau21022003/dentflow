-- Representative synthetic Patient Alert fixtures backed by assigned, in-progress cases.
WITH "seed_alerts" (
  "alert_key",
  "appointment_number",
  "category",
  "severity",
  "message",
  "created_days_ago",
  "resolved_days_ago"
) AS (
  VALUES
    ('latex-allergy', 23, 'ALLERGY', 'CRITICAL', 'Synthetic allergy alert: latex sensitivity.', 14, NULL),
    ('medication-review', 24, 'MEDICATION', 'WARNING', 'Synthetic medication alert: verify current medication history.', 10, NULL),
    ('medical-history', 21, 'MEDICAL_CONDITION', 'INFO', 'Synthetic medical alert: review medical history before treatment.', 7, NULL),
    ('communication-support', 22, 'OTHER', 'WARNING', 'Synthetic care alert: confirm communication support before treatment.', 5, NULL),
    ('resolved-follow-up', 23, 'OTHER', 'INFO', 'Synthetic resolved alert: previous follow-up precaution.', 30, 2)
),
"alert_sources" AS (
  SELECT
    "seed_alerts".*,
    "appointment"."tenant_id",
    "appointment"."patient_id",
    "appointment"."assigned_dentist_user_id" AS "actor_user_id"
  FROM "seed_alerts"
  INNER JOIN "appointments" AS "appointment"
    ON "appointment"."id" = md5('brightsmile-appointment-' || "seed_alerts"."appointment_number")::uuid
    AND "appointment"."status" = 'IN_PROGRESS'
)
INSERT INTO "patient_alerts" (
  "id",
  "tenant_id",
  "patient_id",
  "category",
  "severity",
  "message",
  "created_by_user_id",
  "updated_by_user_id",
  "resolved_by_user_id",
  "resolved_at",
  "created_at",
  "updated_at"
)
SELECT
  md5('brightsmile-patient-alert-' || "alert_key")::uuid,
  "tenant_id",
  "patient_id",
  "category"::"patient_alert_category_enum",
  "severity"::"patient_alert_severity_enum",
  "message",
  "actor_user_id",
  "actor_user_id",
  CASE WHEN "resolved_days_ago" IS NOT NULL THEN "actor_user_id" END,
  CASE WHEN "resolved_days_ago" IS NOT NULL
    THEN CURRENT_TIMESTAMP - "resolved_days_ago" * INTERVAL '1 day'
  END,
  CURRENT_TIMESTAMP - "created_days_ago" * INTERVAL '1 day',
  CURRENT_TIMESTAMP - COALESCE("resolved_days_ago", "created_days_ago") * INTERVAL '1 day'
FROM "alert_sources"
ON CONFLICT ("id") DO UPDATE SET
  "tenant_id" = EXCLUDED."tenant_id",
  "patient_id" = EXCLUDED."patient_id",
  "category" = EXCLUDED."category",
  "severity" = EXCLUDED."severity",
  "message" = EXCLUDED."message",
  "created_by_user_id" = EXCLUDED."created_by_user_id",
  "updated_by_user_id" = EXCLUDED."updated_by_user_id",
  "resolved_by_user_id" = EXCLUDED."resolved_by_user_id",
  "resolved_at" = EXCLUDED."resolved_at",
  "created_at" = EXCLUDED."created_at",
  "updated_at" = EXCLUDED."updated_at";

-- Keep a counter row for every tenant after deterministic display numbers are seeded.
INSERT INTO "tenant_display_counters" (
  "tenant_id",
  "next_patient_number",
  "next_treatment_plan_number"
)
SELECT
  "tenant"."id",
  COALESCE((
    SELECT MAX("patient"."display_number") + 1
    FROM "patients" AS "patient"
    WHERE "patient"."tenant_id" = "tenant"."id"
  ), 1),
  COALESCE((
    SELECT MAX("plan"."display_number") + 1
    FROM "treatment_plans" AS "plan"
    WHERE "plan"."tenant_id" = "tenant"."id"
  ), 1)
FROM "tenants" AS "tenant"
ON CONFLICT ("tenant_id") DO UPDATE SET
  "next_patient_number" = GREATEST(
    "tenant_display_counters"."next_patient_number",
    EXCLUDED."next_patient_number"
  ),
  "next_treatment_plan_number" = GREATEST(
    "tenant_display_counters"."next_treatment_plan_number",
    EXCLUDED."next_treatment_plan_number"
  );
