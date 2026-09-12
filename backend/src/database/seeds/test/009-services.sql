-- Test-only synthetic dental service fixtures.
-- Amounts are reference list prices in VND; duration is the estimated chair time for one booking.
WITH "catalog" (
  "group_key",
  "code",
  "name",
  "amount",
  "currency",
  "duration_minutes"
) AS (
  VALUES
    ('diagnostics', 'consultation-new', 'Khám tổng quát', 250000, 'VND', 30),
    ('diagnostics', 'consultation-follow-up', 'Tái khám', 150000, 'VND', 20),
    ('diagnostics', 'xray-periapical', 'X-quang quanh chóp', 80000, 'VND', 10),
    ('diagnostics', 'xray-panoramic', 'X-quang toàn cảnh', 250000, 'VND', 15),
    ('diagnostics', 'xray-cephalometric', 'X-quang sọ nghiêng', 300000, 'VND', 15),
    ('diagnostics', 'cbct-single-region', 'CBCT một vùng', 1200000, 'VND', 30),
    ('preventive-periodontal', 'scaling-polishing', 'Cạo vôi, đánh bóng', 400000, 'VND', 45),
    ('preventive-periodontal', 'fluoride-varnish', 'Bôi fluor', 250000, 'VND', 20),
    ('preventive-periodontal', 'fissure-sealant-per-tooth', 'Trám bít hố rãnh/răng', 200000, 'VND', 15),
    ('preventive-periodontal', 'periodontal-maintenance', 'Duy trì nha chu', 600000, 'VND', 45),
    ('preventive-periodontal', 'root-planing-per-quadrant', 'Cạo láng gốc răng/một cung phần tư', 900000, 'VND', 60),
    ('preventive-periodontal', 'periodontal-abscess-drainage', 'Dẫn lưu áp-xe nha chu', 800000, 'VND', 45),
    ('restorative-endodontic', 'composite-filling-1-surface', 'Trám composite 1 mặt', 350000, 'VND', 30),
    ('restorative-endodontic', 'composite-filling-2-surfaces', 'Trám composite từ 2 mặt', 500000, 'VND', 45),
    ('restorative-endodontic', 'glass-ionomer-filling', 'Trám GIC', 300000, 'VND', 30),
    ('restorative-endodontic', 'root-canal-anterior', 'Điều trị tủy răng cửa/nanh', 1500000, 'VND', 60),
    ('restorative-endodontic', 'root-canal-premolar', 'Điều trị tủy răng tiền cối', 2200000, 'VND', 75),
    ('restorative-endodontic', 'root-canal-molar', 'Điều trị tủy răng cối', 3200000, 'VND', 90),
    ('restorative-endodontic', 'fiber-post-core', 'Chốt sợi và tái tạo cùi', 1000000, 'VND', 45),
    ('oral-surgery', 'simple-extraction', 'Nhổ răng thường', 500000, 'VND', 30),
    ('oral-surgery', 'surgical-extraction', 'Nhổ răng tiểu phẫu', 1500000, 'VND', 60),
    ('oral-surgery', 'wisdom-extraction-upper', 'Nhổ răng khôn hàm trên', 2000000, 'VND', 60),
    ('oral-surgery', 'wisdom-extraction-lower-simple', 'Nhổ răng khôn hàm dưới mọc thẳng', 3000000, 'VND', 75),
    ('oral-surgery', 'wisdom-extraction-lower-impacted', 'Nhổ răng khôn hàm dưới mọc ngầm/lệch', 5000000, 'VND', 120),
    ('oral-surgery', 'alveoloplasty', 'Chỉnh hình xương ổ răng', 2000000, 'VND', 60),
    ('prosthodontics-implant', 'zirconia-crown', 'Mão sứ zirconia/răng', 6000000, 'VND', 90),
    ('prosthodontics-implant', 'ceramic-veneer', 'Mặt dán sứ veneer/răng', 7000000, 'VND', 90),
    ('prosthodontics-implant', 'zirconia-bridge-unit', 'Cầu sứ zirconia/đơn vị', 6000000, 'VND', 90),
    ('prosthodontics-implant', 'acrylic-denture-arch', 'Hàm tháo lắp acrylic/một hàm', 4000000, 'VND', 120),
    ('prosthodontics-implant', 'implant-fixture-placement', 'Cấy trụ implant', 15000000, 'VND', 90),
    ('prosthodontics-implant', 'implant-zirconia-crown', 'Mão sứ trên implant', 8000000, 'VND', 90),
    ('prosthodontics-implant', 'bone-graft', 'Ghép xương implant', 5000000, 'VND', 90),
    ('orthodontics-aesthetics', 'orthodontic-consultation', 'Khám tư vấn chỉnh nha', 300000, 'VND', 45),
    ('orthodontics-aesthetics', 'metal-braces-comprehensive', 'Niềng răng mắc cài kim loại toàn diện', 35000000, 'VND', 120),
    ('orthodontics-aesthetics', 'ceramic-braces-comprehensive', 'Niềng răng mắc cài sứ toàn diện', 45000000, 'VND', 120),
    ('orthodontics-aesthetics', 'clear-aligner-comprehensive', 'Chỉnh nha khay trong suốt toàn diện', 70000000, 'VND', 90),
    ('orthodontics-aesthetics', 'orthodontic-adjustment', 'Tái khám điều chỉnh chỉnh nha', 600000, 'VND', 30),
    ('orthodontics-aesthetics', 'in-office-whitening', 'Tẩy trắng tại phòng khám', 4000000, 'VND', 90),
    ('orthodontics-aesthetics', 'take-home-whitening', 'Tẩy trắng tại nhà', 2500000, 'VND', 30)
),
"seed_tenants" ("tenant_id") AS (
  VALUES
    ('11000000-0000-4000-8000-000000000001'::uuid),
    ('11000000-0000-4000-8000-000000000002'::uuid)
)
INSERT INTO "services" (
  "tenant_id",
  "code",
  "name",
  "service_group_id",
  "amount",
  "currency",
  "duration_minutes",
  "is_active"
)
SELECT
  "seed_tenants"."tenant_id",
  "catalog"."code",
  "catalog"."name",
  "service_group"."id",
  "catalog"."amount",
  "catalog"."currency",
  "catalog"."duration_minutes",
  true
FROM "seed_tenants"
CROSS JOIN "catalog"
INNER JOIN "service_groups" AS "service_group"
  ON "service_group"."tenant_id" = "seed_tenants"."tenant_id"
  AND "service_group"."name" = CASE "catalog"."group_key"
    WHEN 'diagnostics' THEN 'Khám & chẩn đoán'
    WHEN 'preventive-periodontal' THEN 'Phòng ngừa & nha chu'
    WHEN 'restorative-endodontic' THEN 'Phục hồi & nội nha'
    WHEN 'oral-surgery' THEN 'Nhổ răng & tiểu phẫu'
    WHEN 'prosthodontics-implant' THEN 'Phục hình & implant'
    WHEN 'orthodontics-aesthetics' THEN 'Chỉnh nha & thẩm mỹ'
  END
ORDER BY "seed_tenants"."tenant_id", "catalog"."code"
ON CONFLICT ("tenant_id", "code") DO NOTHING;
