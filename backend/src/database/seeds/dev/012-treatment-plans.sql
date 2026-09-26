-- Representative synthetic treatment-plan lifecycle data. Execution events use a later OPEN visit for the same patient.
WITH "seed_plans" ("plan_key", "origin_n", "status", "accepted") AS (
  VALUES
    ('draft', 21, 'DRAFT', false), ('draft-01', 3, 'DRAFT', false), ('draft-02', 4, 'DRAFT', false),
    ('draft-03', 5, 'DRAFT', false), ('draft-04', 6, 'DRAFT', false),
    ('cancelled', 21, 'CANCELLED', false), ('cancelled-01', 3, 'CANCELLED', false), ('cancelled-02', 4, 'CANCELLED', false),
    ('cancelled-03', 5, 'CANCELLED', false), ('cancelled-04', 6, 'CANCELLED', false),
    ('proposed', 22, 'PROPOSED', false), ('proposed-01', 7, 'PROPOSED', false), ('proposed-02', 8, 'PROPOSED', false),
    ('proposed-03', 9, 'PROPOSED', false), ('proposed-04', 10, 'PROPOSED', false),
    ('accepted', 23, 'ACCEPTED', true), ('accepted-01', 21, 'ACCEPTED', true), ('accepted-02', 22, 'ACCEPTED', true),
    ('accepted-03', 23, 'ACCEPTED', true), ('accepted-04', 24, 'ACCEPTED', true),
    ('partially-completed', 2, 'PARTIALLY_COMPLETED', true), ('partially-completed-01', 1, 'PARTIALLY_COMPLETED', true),
    ('partially-completed-02', 2, 'PARTIALLY_COMPLETED', true), ('partially-completed-03', 21, 'PARTIALLY_COMPLETED', true),
    ('partially-completed-04', 22, 'PARTIALLY_COMPLETED', true),
    ('completed', 1, 'COMPLETED', true), ('completed-01', 1, 'COMPLETED', true), ('completed-02', 2, 'COMPLETED', true),
    ('completed-03', 21, 'COMPLETED', true), ('completed-04', 22, 'COMPLETED', true)
), "sources" AS (
  SELECT "seed_plans".*, "appointment"."tenant_id", "appointment"."branch_id", "appointment"."patient_id", "visit"."id" AS "origin_visit_id",
         "appointment"."assigned_dentist_user_id" AS "created_by_user_id", "appointment"."start_at", "receptionist"."user_id" AS "accepted_by_user_id"
  FROM "seed_plans"
  JOIN "appointments" AS "appointment" ON "appointment"."id" = md5('brightsmile-appointment-' || "seed_plans"."origin_n")::uuid
  JOIN "visits" AS "visit" ON "visit"."appointment_id" = "appointment"."id"
  CROSS JOIN LATERAL (SELECT "assignment"."user_id" FROM "role_assignments" AS "assignment"
    WHERE "assignment"."tenant_id" = "appointment"."tenant_id" AND "assignment"."branch_id" = "appointment"."branch_id"
      AND "assignment"."role_code" = 'RECEPTIONIST' AND "assignment"."revoked_at" IS NULL ORDER BY "assignment"."id" LIMIT 1) AS "receptionist"
)
INSERT INTO "treatment_plans" ("id", "tenant_id", "branch_id", "patient_id", "origin_visit_id", "created_by_user_id", "status", "accepted_by_user_id", "accepted_at", "created_at", "updated_at")
SELECT md5('brightsmile-treatment-plan-' || "plan_key")::uuid, "tenant_id", "branch_id", "patient_id", "origin_visit_id", "created_by_user_id", "status"::"treatment_plan_status_enum",
       CASE WHEN "accepted" THEN "accepted_by_user_id" END, CASE WHEN "accepted" THEN LEAST(CURRENT_TIMESTAMP, "start_at" + INTERVAL '15 minutes') END,
       LEAST(CURRENT_TIMESTAMP, "start_at" + INTERVAL '5 minutes'), LEAST(CURRENT_TIMESTAMP, "start_at" + INTERVAL '45 minutes')
FROM "sources"
ON CONFLICT ("id") DO UPDATE SET "tenant_id" = EXCLUDED."tenant_id", "branch_id" = EXCLUDED."branch_id", "patient_id" = EXCLUDED."patient_id", "origin_visit_id" = EXCLUDED."origin_visit_id", "created_by_user_id" = EXCLUDED."created_by_user_id", "status" = EXCLUDED."status", "accepted_by_user_id" = EXCLUDED."accepted_by_user_id", "accepted_at" = EXCLUDED."accepted_at", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";

WITH "seed_items" ("plan_key", "item_key", "service_code", "quantity", "discount", "tooth", "indication", "status") AS (
  VALUES
    ('draft', 'filling', 'composite-filling-1-surface', 1, 0, '16', 'Synthetic draft restoration', 'PENDING'),
    ('cancelled', 'extraction', 'simple-extraction', 1, 0, '48', 'Synthetic treatment cancelled before execution', 'CANCELLED'),
    ('proposed', 'scaling', 'scaling-polishing', 1, 0, NULL, 'Synthetic preventive treatment proposal', 'PENDING'),
    ('accepted', 'filling', 'composite-filling-1-surface', 1, 50000, '26', 'Synthetic accepted restoration', 'PENDING'),
    ('partially-completed', 'completed-filling', 'composite-filling-1-surface', 1, 0, '36', 'Synthetic completed item in a staged plan', 'COMPLETED'),
    ('partially-completed', 'root-canal', 'root-canal-premolar', 1, 0, '35', 'Synthetic treatment currently in progress', 'IN_PROGRESS'),
    ('completed', 'completed-extraction', 'simple-extraction', 1, 0, '18', 'Synthetic completed extraction', 'COMPLETED'),
    ('completed', 'cancelled-scaling', 'scaling-polishing', 1, 0, NULL, 'Synthetic item cancelled during an otherwise completed plan', 'CANCELLED'),
    ('draft-01', 'consultation-new', 'consultation-new', 1, 0, NULL, 'Synthetic draft consultation', 'PENDING'),
    ('draft-01', 'consultation-follow-up', 'consultation-follow-up', 1, 0, NULL, 'Synthetic draft follow-up', 'PENDING'),
    ('draft-02', 'xray-periapical', 'xray-periapical', 1, 0, NULL, 'Synthetic draft periapical imaging', 'PENDING'),
    ('draft-02', 'xray-panoramic', 'xray-panoramic', 1, 0, NULL, 'Synthetic draft panoramic imaging', 'PENDING'),
    ('draft-03', 'xray-cephalometric', 'xray-cephalometric', 1, 0, NULL, 'Synthetic draft cephalometric imaging', 'PENDING'),
    ('draft-03', 'cbct-single-region', 'cbct-single-region', 1, 0, NULL, 'Synthetic draft CBCT imaging', 'PENDING'),
    ('draft-04', 'scaling-polishing', 'scaling-polishing', 1, 0, NULL, 'Synthetic draft preventive treatment', 'PENDING'),
    ('draft-04', 'fluoride-varnish', 'fluoride-varnish', 1, 0, NULL, 'Synthetic draft fluoride treatment', 'PENDING'),
    ('cancelled-01', 'fissure-sealant', 'fissure-sealant-per-tooth', 1, 0, '14', 'Synthetic cancelled fissure sealant', 'CANCELLED'),
    ('cancelled-01', 'periodontal-maintenance', 'periodontal-maintenance', 1, 0, NULL, 'Synthetic cancelled periodontal maintenance', 'CANCELLED'),
    ('cancelled-02', 'root-planing', 'root-planing-per-quadrant', 1, 0, NULL, 'Synthetic cancelled root planing', 'CANCELLED'),
    ('cancelled-02', 'periodontal-drainage', 'periodontal-abscess-drainage', 1, 0, '46', 'Synthetic cancelled periodontal drainage', 'CANCELLED'),
    ('cancelled-03', 'composite-filling-1', 'composite-filling-1-surface', 1, 0, '26', 'Synthetic cancelled one-surface restoration', 'CANCELLED'),
    ('cancelled-03', 'composite-filling-2', 'composite-filling-2-surfaces', 1, 0, '27', 'Synthetic cancelled two-surface restoration', 'CANCELLED'),
    ('cancelled-04', 'glass-ionomer-filling', 'glass-ionomer-filling', 1, 0, '15', 'Synthetic cancelled glass ionomer restoration', 'CANCELLED'),
    ('cancelled-04', 'root-canal-anterior', 'root-canal-anterior', 1, 0, '11', 'Synthetic cancelled anterior root canal', 'CANCELLED'),
    ('proposed-01', 'root-canal-premolar', 'root-canal-premolar', 1, 0, '35', 'Synthetic proposed premolar root canal', 'PENDING'),
    ('proposed-01', 'root-canal-molar', 'root-canal-molar', 1, 0, '36', 'Synthetic proposed molar root canal', 'PENDING'),
    ('proposed-02', 'fiber-post-core', 'fiber-post-core', 1, 0, '11', 'Synthetic proposed fiber post and core', 'PENDING'),
    ('proposed-02', 'simple-extraction', 'simple-extraction', 1, 0, '48', 'Synthetic proposed simple extraction', 'PENDING'),
    ('proposed-03', 'surgical-extraction', 'surgical-extraction', 1, 0, '46', 'Synthetic proposed surgical extraction', 'PENDING'),
    ('proposed-03', 'wisdom-extraction-upper', 'wisdom-extraction-upper', 1, 0, '18', 'Synthetic proposed upper wisdom extraction', 'PENDING'),
    ('proposed-04', 'wisdom-extraction-lower-simple', 'wisdom-extraction-lower-simple', 1, 0, '48', 'Synthetic proposed lower wisdom extraction', 'PENDING'),
    ('proposed-04', 'wisdom-extraction-lower-impacted', 'wisdom-extraction-lower-impacted', 1, 0, '38', 'Synthetic proposed impacted wisdom extraction', 'PENDING'),
    ('accepted-01', 'alveoloplasty', 'alveoloplasty', 1, 50000, NULL, 'Synthetic accepted alveoloplasty', 'PENDING'),
    ('accepted-01', 'zirconia-crown', 'zirconia-crown', 1, 0, '26', 'Synthetic accepted zirconia crown', 'PENDING'),
    ('accepted-02', 'ceramic-veneer', 'ceramic-veneer', 1, 50000, '21', 'Synthetic accepted ceramic veneer', 'PENDING'),
    ('accepted-02', 'zirconia-bridge-unit', 'zirconia-bridge-unit', 1, 0, '25', 'Synthetic accepted zirconia bridge', 'PENDING'),
    ('accepted-03', 'acrylic-denture', 'acrylic-denture-arch', 1, 50000, NULL, 'Synthetic accepted acrylic denture', 'PENDING'),
    ('accepted-03', 'implant-fixture', 'implant-fixture-placement', 1, 0, '16', 'Synthetic accepted implant fixture', 'PENDING'),
    ('accepted-04', 'implant-zirconia-crown', 'implant-zirconia-crown', 1, 50000, '16', 'Synthetic accepted implant crown', 'PENDING'),
    ('accepted-04', 'bone-graft', 'bone-graft', 1, 0, NULL, 'Synthetic accepted bone graft', 'PENDING'),
    ('partially-completed-01', 'completed-metal-braces', 'metal-braces-comprehensive', 1, 0, NULL, 'Synthetic completed orthodontic stage', 'COMPLETED'),
    ('partially-completed-01', 'in-progress-ceramic-braces', 'ceramic-braces-comprehensive', 1, 0, NULL, 'Synthetic orthodontic treatment in progress', 'IN_PROGRESS'),
    ('partially-completed-02', 'completed-clear-aligner', 'clear-aligner-comprehensive', 1, 0, NULL, 'Synthetic completed aligner stage', 'COMPLETED'),
    ('partially-completed-02', 'in-progress-orthodontic-adjustment', 'orthodontic-adjustment', 1, 0, NULL, 'Synthetic orthodontic adjustment in progress', 'IN_PROGRESS'),
    ('partially-completed-03', 'completed-in-office-whitening', 'in-office-whitening', 1, 0, NULL, 'Synthetic completed in-office whitening', 'COMPLETED'),
    ('partially-completed-03', 'in-progress-take-home-whitening', 'take-home-whitening', 1, 0, NULL, 'Synthetic take-home whitening in progress', 'IN_PROGRESS'),
    ('partially-completed-04', 'completed-take-home-whitening', 'orthodontic-consultation', 1, 0, NULL, 'Synthetic completed orthodontic consultation', 'COMPLETED'),
    ('partially-completed-04', 'in-progress-consultation-new', 'consultation-new', 1, 0, NULL, 'Synthetic consultation in progress', 'IN_PROGRESS'),
    ('completed-01', 'consultation-follow-up', 'consultation-follow-up', 1, 0, NULL, 'Synthetic completed follow-up', 'COMPLETED'),
    ('completed-01', 'xray-periapical', 'xray-periapical', 1, 0, NULL, 'Synthetic completed periapical imaging', 'COMPLETED'),
    ('completed-02', 'xray-panoramic', 'xray-panoramic', 1, 0, NULL, 'Synthetic completed panoramic imaging', 'COMPLETED'),
    ('completed-02', 'xray-cephalometric', 'xray-cephalometric', 1, 0, NULL, 'Synthetic completed cephalometric imaging', 'COMPLETED'),
    ('completed-03', 'cbct-single-region', 'cbct-single-region', 1, 0, NULL, 'Synthetic completed CBCT imaging', 'COMPLETED'),
    ('completed-03', 'scaling-polishing', 'scaling-polishing', 1, 0, NULL, 'Synthetic completed preventive treatment', 'COMPLETED'),
    ('completed-04', 'fluoride-varnish', 'fluoride-varnish', 1, 0, NULL, 'Synthetic completed fluoride treatment', 'COMPLETED'),
    ('completed-04', 'fissure-sealant', 'fissure-sealant-per-tooth', 1, 0, '24', 'Synthetic completed fissure sealant', 'COMPLETED')
)
INSERT INTO "treatment_items" ("id", "treatment_plan_id", "service_id", "service_code", "service_name", "list_unit_amount", "currency", "quantity", "discount_amount", "final_unit_amount", "tooth_position", "indication", "planned_dentist_user_id", "status", "created_at", "updated_at")
SELECT md5('brightsmile-treatment-item-' || "seed_items"."plan_key" || '-' || "seed_items"."item_key")::uuid, "plan"."id", "service"."id", "service"."code", "service"."name", "service"."amount", "service"."currency", "seed_items"."quantity", "seed_items"."discount", "service"."amount" - "seed_items"."discount", "seed_items"."tooth", "seed_items"."indication", "plan"."created_by_user_id", "seed_items"."status"::"treatment_item_status_enum", "plan"."created_at", "plan"."updated_at"
FROM "seed_items" JOIN "treatment_plans" AS "plan" ON "plan"."id" = md5('brightsmile-treatment-plan-' || "seed_items"."plan_key")::uuid
JOIN "services" AS "service" ON "service"."tenant_id" = "plan"."tenant_id" AND "service"."code" = "seed_items"."service_code" AND "service"."is_active" = true
ON CONFLICT ("id") DO UPDATE SET "treatment_plan_id" = EXCLUDED."treatment_plan_id", "service_id" = EXCLUDED."service_id", "service_code" = EXCLUDED."service_code", "service_name" = EXCLUDED."service_name", "list_unit_amount" = EXCLUDED."list_unit_amount", "currency" = EXCLUDED."currency", "quantity" = EXCLUDED."quantity", "discount_amount" = EXCLUDED."discount_amount", "final_unit_amount" = EXCLUDED."final_unit_amount", "tooth_position" = EXCLUDED."tooth_position", "indication" = EXCLUDED."indication", "planned_dentist_user_id" = EXCLUDED."planned_dentist_user_id", "status" = EXCLUDED."status", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at";

WITH "seed_events" ("plan_key", "item_key", "appointment_n", "event_type", "event_order") AS (
  VALUES
    ('partially-completed', 'completed-filling', 24, 'IN_PROGRESS', 1), ('partially-completed', 'completed-filling', 24, 'COMPLETED', 2), ('partially-completed', 'root-canal', 24, 'IN_PROGRESS', 3),
    ('completed', 'completed-extraction', 23, 'IN_PROGRESS', 1), ('completed', 'completed-extraction', 23, 'COMPLETED', 2), ('completed', 'cancelled-scaling', 23, 'CANCELLED', 3),
    ('partially-completed-01', 'completed-metal-braces', 23, 'IN_PROGRESS', 1), ('partially-completed-01', 'completed-metal-braces', 23, 'COMPLETED', 2), ('partially-completed-01', 'in-progress-ceramic-braces', 23, 'IN_PROGRESS', 3),
    ('partially-completed-02', 'completed-clear-aligner', 24, 'IN_PROGRESS', 1), ('partially-completed-02', 'completed-clear-aligner', 24, 'COMPLETED', 2), ('partially-completed-02', 'in-progress-orthodontic-adjustment', 24, 'IN_PROGRESS', 3),
    ('partially-completed-03', 'completed-in-office-whitening', 21, 'IN_PROGRESS', 1), ('partially-completed-03', 'completed-in-office-whitening', 21, 'COMPLETED', 2), ('partially-completed-03', 'in-progress-take-home-whitening', 21, 'IN_PROGRESS', 3),
    ('partially-completed-04', 'completed-take-home-whitening', 22, 'IN_PROGRESS', 1), ('partially-completed-04', 'completed-take-home-whitening', 22, 'COMPLETED', 2), ('partially-completed-04', 'in-progress-consultation-new', 22, 'IN_PROGRESS', 3),
    ('completed-01', 'consultation-follow-up', 23, 'IN_PROGRESS', 1), ('completed-01', 'consultation-follow-up', 23, 'COMPLETED', 2), ('completed-01', 'xray-periapical', 23, 'IN_PROGRESS', 3), ('completed-01', 'xray-periapical', 23, 'COMPLETED', 4),
    ('completed-02', 'xray-panoramic', 24, 'IN_PROGRESS', 1), ('completed-02', 'xray-panoramic', 24, 'COMPLETED', 2), ('completed-02', 'xray-cephalometric', 24, 'IN_PROGRESS', 3), ('completed-02', 'xray-cephalometric', 24, 'COMPLETED', 4),
    ('completed-03', 'cbct-single-region', 21, 'IN_PROGRESS', 1), ('completed-03', 'cbct-single-region', 21, 'COMPLETED', 2), ('completed-03', 'scaling-polishing', 21, 'IN_PROGRESS', 3), ('completed-03', 'scaling-polishing', 21, 'COMPLETED', 4),
    ('completed-04', 'fluoride-varnish', 22, 'IN_PROGRESS', 1), ('completed-04', 'fluoride-varnish', 22, 'COMPLETED', 2), ('completed-04', 'fissure-sealant', 22, 'IN_PROGRESS', 3), ('completed-04', 'fissure-sealant', 22, 'COMPLETED', 4)
)
INSERT INTO "treatment_item_events" ("id", "treatment_item_id", "treatment_plan_id", "visit_id", "performed_by_user_id", "event_type", "created_at")
SELECT md5('brightsmile-treatment-event-' || "seed_events"."plan_key" || '-' || "seed_events"."item_key" || '-' || "seed_events"."event_order")::uuid, "item"."id", "plan"."id", "visit"."id", "appointment"."assigned_dentist_user_id", "seed_events"."event_type"::"treatment_item_event_type_enum", LEAST(CURRENT_TIMESTAMP, "appointment"."start_at" + "seed_events"."event_order" * INTERVAL '10 minutes')
FROM "seed_events" JOIN "treatment_plans" AS "plan" ON "plan"."id" = md5('brightsmile-treatment-plan-' || "seed_events"."plan_key")::uuid
JOIN "treatment_items" AS "item" ON "item"."id" = md5('brightsmile-treatment-item-' || "seed_events"."plan_key" || '-' || "seed_events"."item_key")::uuid AND "item"."treatment_plan_id" = "plan"."id"
JOIN "appointments" AS "appointment" ON "appointment"."id" = md5('brightsmile-appointment-' || "seed_events"."appointment_n")::uuid AND "appointment"."tenant_id" = "plan"."tenant_id" AND "appointment"."branch_id" = "plan"."branch_id" AND "appointment"."patient_id" = "plan"."patient_id" AND "appointment"."status" = 'IN_PROGRESS'
JOIN "visits" AS "visit" ON "visit"."appointment_id" = "appointment"."id" AND "visit"."status" = 'OPEN'
ON CONFLICT ("id") DO NOTHING;
