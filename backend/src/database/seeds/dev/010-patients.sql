-- Shared synthetic patient fixtures for the primary BrightSmile tenant.
-- Keep this file byte-for-byte identical in dev and test seed directories.
WITH "seed_tenant" AS (
  SELECT "id"
  FROM "tenants"
  WHERE "slug" IN ('brightsmile-dental', 'test-brightsmile')
),
"seed_patients" (
  "id",
  "full_name",
  "phone",
  "phone_normalized",
  "date_of_birth",
  "gender",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "referral_source",
  "created_at"
) AS (
  VALUES
    ('22000000-0000-4000-8000-000000000001', 'Nguyễn An Nhiên', '0939 000 001', '+84939000001', '1991-02-14', 'FEMALE', '12 Đường Mẫu, Quận 1, TP. Hồ Chí Minh', 'Nguyễn Văn Mẫu', '0939 100 001', 'Cha', 'Google Maps', '2026-01-02T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000002', 'Trần Minh Khoa', '0939 000 002', '+84939000002', '1987-09-23', 'MALE', '18 Đường Mẫu, Quận 3, TP. Hồ Chí Minh', 'Trần Thị Mẫu', '0939 100 002', 'Vợ', 'Bạn bè giới thiệu', '2026-01-03T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000003', 'Lê Bảo Ngọc', '0939 000 003', '+84939000003', '1996-05-08', 'FEMALE', '24 Đường Mẫu, Quận 7, TP. Hồ Chí Minh', NULL, NULL, NULL, 'Facebook', '2026-01-04T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000004', 'Phạm Gia Huy', '0939 000 004', '+84939000004', '1984-11-19', 'MALE', '36 Đường Mẫu, Thành phố Thủ Đức, TP. Hồ Chí Minh', 'Phạm Thị Mẫu', '0939 100 004', 'Vợ', 'Khách hàng cũ', '2026-01-05T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000005', 'Võ Khánh Linh', '0939 000 005', '+84939000005', '2000-03-27', 'FEMALE', NULL, NULL, NULL, NULL, 'Website', '2026-01-06T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000006', 'Đỗ Quang Vinh', '0939 000 006', '+84939000006', '1979-07-12', 'MALE', '52 Đường Mẫu, Quận Bình Thạnh, TP. Hồ Chí Minh', 'Đỗ Minh Mẫu', '0939 100 006', 'Con', 'Google Maps', '2026-01-07T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000007', 'Bùi Thảo Vy', '0939 000 007', '+84939000007', '1993-12-01', 'FEMALE', '68 Đường Mẫu, Quận Gò Vấp, TP. Hồ Chí Minh', 'Bùi Văn Mẫu', '0939 100 007', 'Anh trai', 'Facebook', '2026-01-08T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000008', 'Hoàng Đức Anh', '0939 000 008', '+84939000008', '1989-06-30', 'MALE', '72 Đường Mẫu, Quận Phú Nhuận, TP. Hồ Chí Minh', NULL, NULL, NULL, 'Đi ngang qua phòng khám', '2026-01-09T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000009', 'Ngô Mỹ Duyên', '0939 000 009', '+84939000009', '1998-01-16', 'FEMALE', '86 Đường Mẫu, Quận Tân Bình, TP. Hồ Chí Minh', 'Ngô Thị Mẫu', '0939 100 009', 'Mẹ', 'Bạn bè giới thiệu', '2026-01-10T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000010', 'Dương Nhật Nam', '0939 000 010', '+84939000010', '1976-08-04', 'MALE', '94 Đường Mẫu, Quận 10, TP. Hồ Chí Minh', 'Dương Thanh Mẫu', '0939 100 010', 'Vợ', 'Khách hàng cũ', '2026-01-11T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000011', 'Lý Thanh Hà', '0939 000 011', '+84939000011', '1994-10-21', 'FEMALE', NULL, NULL, NULL, NULL, 'Zalo', '2026-01-12T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000012', 'Đặng Hoài Phương', '0939 000 012', '+84939000012', '1982-04-11', 'OTHER', '108 Đường Mẫu, Quận 4, TP. Hồ Chí Minh', 'Đặng Mai Mẫu', '0939 100 012', 'Chị gái', 'Google Maps', '2026-01-13T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000013', 'Vũ Thành Đạt', '0939 000 013', '+84939000013', '1990-09-05', 'MALE', '116 Đường Mẫu, Quận 5, TP. Hồ Chí Minh', 'Vũ Thị Mẫu', '0939 100 013', 'Mẹ', 'Website', '2026-01-14T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000014', 'Mai Diễm My', '0939 000 014', '+84939000014', '1997-02-28', 'FEMALE', '124 Đường Mẫu, Quận 6, TP. Hồ Chí Minh', NULL, NULL, NULL, 'Facebook', '2026-01-15T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000015', 'Cao Quốc Bảo', '0939 000 015', '+84939000015', '1985-12-17', 'MALE', '132 Đường Mẫu, Quận 8, TP. Hồ Chí Minh', 'Cao Kim Mẫu', '0939 100 015', 'Vợ', 'Khách hàng cũ', '2026-01-16T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000016', 'Hồ Yến Nhi', '0939 000 016', '+84939000016', '2001-07-09', 'FEMALE', NULL, 'Hồ Văn Mẫu', '0939 100 016', 'Cha', 'Bạn bè giới thiệu', '2026-01-17T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000017', 'Chu Hải Long', '0939 000 017', '+84939000017', '1978-03-18', 'MALE', '148 Đường Mẫu, Quận 11, TP. Hồ Chí Minh', NULL, NULL, NULL, 'Google Maps', '2026-01-18T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000018', 'Tô Minh Châu', '0939 000 018', '+84939000018', '1995-06-25', 'FEMALE', '156 Đường Mẫu, Quận 12, TP. Hồ Chí Minh', 'Tô Thành Mẫu', '0939 100 018', 'Anh trai', 'Zalo', '2026-01-19T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000019', 'La Khả Hân', '0939 000 019', '+84939000019', '1999-11-07', 'FEMALE', '164 Đường Mẫu, Thành phố Thủ Đức, TP. Hồ Chí Minh', NULL, NULL, NULL, 'Website', '2026-01-20T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000020', 'Kiều Trọng Nhân', '0939 000 020', '+84939000020', '1981-05-22', 'MALE', '172 Đường Mẫu, Quận Tân Phú, TP. Hồ Chí Minh', 'Kiều Bích Mẫu', '0939 100 020', 'Vợ', 'Khách hàng cũ', '2026-01-21T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000021', 'Tạ Phúc An', '0939 000 021', '+84939000021', '1992-08-15', 'OTHER', NULL, 'Tạ Thu Mẫu', '0939 100 021', 'Chị gái', 'Facebook', '2026-01-22T08:00:00Z'),
    ('22000000-0000-4000-8000-000000000022', 'Quách Bích Ngân', '0939 000 022', '+84939000022', '1988-01-29', 'FEMALE', '188 Đường Mẫu, Quận Bình Tân, TP. Hồ Chí Minh', NULL, NULL, NULL, 'Google Maps', '2026-01-23T08:00:00Z')
)
INSERT INTO "patients" (
  "id",
  "tenant_id",
  "full_name",
  "phone",
  "phone_normalized",
  "date_of_birth",
  "gender",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "referral_source",
  "created_at",
  "updated_at"
)
SELECT
  "seed_patients"."id"::uuid,
  "seed_tenant"."id",
  "seed_patients"."full_name",
  "seed_patients"."phone",
  "seed_patients"."phone_normalized",
  "seed_patients"."date_of_birth"::date,
  "seed_patients"."gender"::"patient_gender_enum",
  "seed_patients"."address",
  "seed_patients"."emergency_contact_name",
  "seed_patients"."emergency_contact_phone",
  "seed_patients"."emergency_contact_relationship",
  "seed_patients"."referral_source",
  "seed_patients"."created_at"::timestamptz,
  "seed_patients"."created_at"::timestamptz
FROM "seed_tenant"
CROSS JOIN "seed_patients"
ON CONFLICT ("id") DO NOTHING;
