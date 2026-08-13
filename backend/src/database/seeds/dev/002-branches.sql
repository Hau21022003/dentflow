-- Development-only synthetic branch fixtures.
INSERT INTO "branches" (
  "id",
  "tenant_id",
  "name",
  "address",
  "phone",
  "timezone",
  "status"
)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'BrightSmile Quận 1',
    '101 Đường Mẫu, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    '+842800000101',
    NULL,
    'ACTIVE'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'BrightSmile Thủ Đức',
    '202 Đường Mẫu, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    '+842800000102',
    NULL,
    'ACTIVE'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'Harmony Quận 7',
    '303 Đường Mẫu, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
    '+842800000103',
    NULL,
    'ACTIVE'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000003',
    'Riverfront Bình Thạnh',
    '404 Đường Mẫu, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh',
    '+842800000104',
    NULL,
    'ACTIVE'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000003',
    'Riverfront Gò Vấp',
    '505 Đường Mẫu, Phường 5, Quận Gò Vấp, TP. Hồ Chí Minh',
    '+842800000105',
    NULL,
    'INACTIVE'
  )
ON CONFLICT ("id") DO NOTHING;
