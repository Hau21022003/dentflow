# DentFlow — Role Workflows

## 1. Mục tiêu

Tài liệu này xác định quyền theo vai trò và các điểm bàn giao trong quy trình vận hành. Role là một quyền nghiệp vụ, còn phạm vi dữ liệu được xác định độc lập bởi `tenantId` và danh sách `branchId` được gán cho người dùng.

```text
Tenant Admin → Branch Admin → Receptionist → Dental Assistant → Dentist → Receptionist
                                      ↖────────────── tái khám ──────────────┘
```

`Platform Admin` vận hành DentFlow SaaS và được mô tả riêng tại [02-platform-admin.md](./02-platform-admin.md). Dòng tiền SaaS và tiền điều trị được mô tả tại [01-payment-model.md](./01-payment-model.md).

## 2. Ma trận role và phạm vi

| Vai trò | Phạm vi mặc định | Trách nhiệm chính | Ranh giới bắt buộc |
| --- | --- | --- | --- |
| Tenant Admin | Toàn bộ branch trong tenant | Cấu hình chuỗi, người dùng, plan SaaS, báo cáo tổng hợp | Không ghi clinical note nếu không có thêm role Dentist |
| Branch Admin | Một hoặc nhiều branch được gán | Điều phối vận hành và nhân sự tại branch | Không truy cập branch ngoài assignment |
| Receptionist | Một hoặc nhiều branch được gán | Tiếp nhận, lịch hẹn, invoice và thu tiền | Không chẩn đoán hay sửa clinical note |
| Dentist | Một hoặc nhiều branch được gán, ca được phân công | Khám, chẩn đoán, điều trị và tái khám | Không chỉnh sửa payment hoặc ca không được gán |
| Dental Assistant | Một hoặc nhiều branch được gán, ca được phân công | Chuẩn bị/ghi nhận hỗ trợ ghế nha khoa | Không kết luận chẩn đoán hoặc duyệt điều trị |

MVP triển khai bốn role tenant-facing: `TENANT_ADMIN`, `BRANCH_ADMIN`, `RECEPTIONIST`, `DENTIST`. `DENTAL_ASSISTANT` là milestone ngay sau MVP để phản ánh hoạt động chairside thực tế. Một user có thể có nhiều role, ví dụ `TENANT_ADMIN` đồng thời là `DENTIST`; API phải kiểm tra role cần thiết cho từng hành động, không suy luận quyền lâm sàng từ role quản trị.

## 3. Tenant Admin: quản trị tenant

Tenant Admin quản lý cấu hình tenant, branch, danh mục dịch vụ, user/role assignment, báo cáo toàn chuỗi, audit log và SaaS billing. Role này có scope toàn tenant nhưng không tự cấp quyền lâm sàng, không sửa payment điều trị đã ghi nhận và không truy cập tenant khác.

Một Tenant Admin đồng thời là Dentist chỉ có clinical permission khi role `DENTIST`, branch scope và assignment ca đều hợp lệ. Trạng thái thanh toán SaaS chỉ được đồng bộ từ Stripe webhook, không được đánh dấu thủ công từ UI Tenant Admin.

Chi tiết nghiệp vụ, cài đặt tenant, luồng onboarding, API định hướng và acceptance criteria được quy định tại [04-tenant-admin.md](./04-tenant-admin.md).

## 4. Branch Admin: điều phối một phòng khám

### Đầu ngày

1. Mở danh sách lịch hẹn hôm nay, ca chưa xác nhận, lịch trùng và bác sĩ vắng mặt.
2. Điều chỉnh phân công bác sĩ hoặc slot lịch hẹn trong branch được gán; thay đổi phải lưu lý do/audit log nếu ca đã confirmed.
3. Theo dõi trạng thái bệnh nhân chờ và cân bằng tải lịch cho nhân sự.

### Trong ngày

- Hỗ trợ Receptionist xử lý lịch hủy, no-show, walk-in và chuyển ca.
- Mời/điều chỉnh nhân sự chỉ trong branch scope; không cấp Tenant Admin hoặc mở rộng scope của chính mình.
- Theo dõi dashboard branch: lịch theo trạng thái, ca đang diễn ra, doanh thu đã thu trong ngày và treatment plan cần follow-up.

### Cuối ngày

- Rà soát lịch chưa hoàn tất, no-show và các invoice chưa thanh toán.
- Ghi nhận vấn đề vận hành và xem audit log liên quan.
- Không sửa giao dịch payment để "khớp sổ"; chỉ tạo adjustment/refund theo quyền và quy trình sau này.

## 5. Receptionist: tiếp nhận đến thu tiền và tái khám

### Luồng bệnh nhân mới hoặc quay lại

1. Tìm kiếm bệnh nhân theo số điện thoại trong tenant để tránh tạo trùng.
2. Tạo hoặc cập nhật thông tin hành chính được phép: liên hệ, ngày sinh, địa chỉ, người liên hệ khẩn cấp và nguồn giới thiệu.
3. Tạo appointment với branch, dịch vụ/lý do khám, bác sĩ dự kiến, thời gian và ghi chú.
4. Khi bệnh nhân đến, xác minh thông tin và chuyển appointment sang `CHECKED_IN`.
5. Khi bác sĩ hoàn tất, lập `PatientInvoice` từ treatment plan/hạng mục được chấp nhận.
6. Ghi nhận một hoặc nhiều payment tại quầy: `CASH`, `BANK_TRANSFER`, `CARD` hoặc `OTHER`; lưu mã tham chiếu và người thu.
7. Đặt lịch tái khám theo chỉ định, chuyển appointment sang `COMPLETED` hoặc ghi `NO_SHOW`/`CANCELLED` kèm lý do.

### Ranh giới bắt buộc

- Không tạo chẩn đoán, treatment plan hoặc clinical note.
- Không xóa/sửa payment đã ghi nhận; refund hoặc adjustment là bản ghi mới có audit log.
- Không xem/sửa appointment, payment hoặc patient thuộc branch ngoài scope, trừ patient profile tenant-wide ở mức thông tin hành chính được cho phép.

## 6. Dentist: khám và điều trị

### Luồng một ca điều trị

1. Xem danh sách appointment được phân công tại branch của mình.
2. Khi bệnh nhân đã check-in, bắt đầu appointment và mở `Visit`.
3. Ghi triệu chứng, thông tin khám, chẩn đoán và clinical note.
4. Tạo `TreatmentPlan` gồm hạng mục, dịch vụ, vị trí/răng, số lượng, đơn giá dự kiến, chỉ định và bác sĩ thực hiện.
5. Chuyển kế hoạch sang `PROPOSED`; Receptionist ghi nhận sự chấp thuận của bệnh nhân trước khi tạo invoice.
6. Thực hiện từng treatment item, cập nhật tiến độ và ghi diễn biến điều trị.
7. Hoàn tất visit, đề xuất tái khám hoặc chuyển chuyên khoa; Receptionist tạo appointment tái khám.

### Ranh giới bắt buộc

- Chỉ truy cập ca được phân công hoặc ca được Branch Admin chuyển giao có audit trail.
- Không tự đánh dấu invoice là paid, tạo refund hay sửa payment.
- Không truy cập clinical notes của bác sĩ khác ngoài chính sách tenant/branch đã cấp.

## 7. Dental Assistant: hỗ trợ ghế nha khoa (sau MVP)

### Luồng chairside

1. Xem ca và bác sĩ được phân công trong ngày.
2. Chuẩn bị ghế/dụng cụ, đánh dấu ca sẵn sàng nếu tenant bật tính năng chair management.
3. Ghi nhận các thông tin hỗ trợ được phép như dấu hiệu sinh tồn, checklist chuẩn bị hoặc tệp ảnh được bác sĩ yêu cầu.
4. Hỗ trợ treatment item đang thực hiện; bác sĩ xác nhận tất cả thay đổi chuyên môn và trạng thái hoàn thành.
5. Chuẩn bị hướng dẫn tái khám để Dentist/Receptionist hoàn tất handoff.

### Ranh giới bắt buộc

- Không ghi chẩn đoán, không ký/xác nhận clinical note và không thay đổi giá/kế hoạch điều trị.
- Không lập invoice hoặc ghi nhận payment.

## 8. Điểm bàn giao và quyền sở hữu dữ liệu

| Sự kiện | Người tạo/cập nhật | Người nhận bàn giao | Quy tắc |
| --- | --- | --- | --- |
| Appointment `BOOKED` | Receptionist | Branch Admin, Dentist | Có branch và bác sĩ dự kiến |
| Appointment `CHECKED_IN` | Receptionist | Dentist/Dental Assistant | Không tạo clinical visit trước check-in, trừ walk-in có lý do |
| Treatment plan `PROPOSED` | Dentist | Receptionist, bệnh nhân | Receptionist không sửa nội dung chuyên môn |
| Treatment plan `ACCEPTED` | Receptionist ghi xác nhận | Dentist | Lưu thời điểm và người xác nhận |
| Treatment item `COMPLETED` | Dentist | Receptionist | Chỉ item hoàn tất mới sẵn sàng invoice theo policy |
| Payment recorded | Receptionist | Tenant/Branch reporting | Không thể sửa trực tiếp; dùng adjustment/refund |
| Tái khám | Dentist đề xuất, Receptionist tạo lịch | Patient/Dentist | Liên kết với visit/treatment plan gốc nếu có |

## 9. Acceptance criteria cho RBAC

- Receptionist tạo và check-in appointment trong branch được gán, nhưng nhận `403` khi tạo clinical note.
- Dentist được phân công có thể tạo visit/treatment plan; Dentist không được phân công nhận `403` dù biết appointment ID.
- Branch Admin có thể đổi lịch trong scope nhưng không quản lý user hoặc appointment của branch khác.
- Tenant Admin xem báo cáo tenant và billing SaaS, nhưng không có quyền clinical write nếu không có `DENTIST` role.
- Một payment đã tạo không có endpoint update/delete thông thường; mọi adjustment ghi lại actor, reason và quan hệ payment gốc.
- User có nhiều role được cấp hợp quyền của role trong đúng tenant/branch scope, không được hợp quyền qua tenant khác.

## 10. Kiến trúc entity authorization (chốt trước service)

MVP dùng **fixed-role scoped RBAC**: role là danh mục do hệ thống định nghĩa trong code/migration, còn database chỉ lưu việc một identity được cấp role nào ở tenant và branch nào. Không tạo entity `Permission`, `Role`, `RolePermission` hoặc permission override cho tenant trong MVP. Điều này ngăn Tenant Admin tự mở rộng quyền ngoài policy đã được duyệt.

`User` là identity toàn hệ thống đang có sẵn. User không mang `tenantId`, `branchId` hay cờ boolean như `isAdmin`; các thuộc tính đó sẽ sai khi một người làm việc tại nhiều tenant hoặc có nhiều vai trò.

```text
                                 ┌── PlatformRoleAssignment ── PLATFORM_ADMIN
User (global identity) ──────────┤
                                 └── RoleAssignment ── TenantRoleCode
                                        ├── tenantId ─── Tenant
                                        └── branchId? ── Branch (cùng tenant)

RoleAssignment có branchId = null  → TENANT_ADMIN, scope toàn tenant
RoleAssignment có branchId          → BRANCH_ADMIN | RECEPTIONIST | DENTIST,
                                      một bản ghi cho mỗi branch được cấp
```

Thiết kế một `RoleAssignment` cho mỗi cặp role–branch thay vì thêm bảng nối `RoleAssignmentBranch`. Ví dụ, một receptionist được phép ở Q1 và Thủ Đức có hai assignment `RECEPTIONIST`. Cách này biến scope thành một phần nguyên tử của grant, cho phép cấp/thu hồi từng branch, lưu actor/lý do riêng, và cho phép database bắt buộc branch thuộc đúng tenant mà không cần trigger kiểm tra tập hợp branch rỗng.

### 10.1 Danh mục role và enum

```ts
export enum TenantRoleCode {
  TENANT_ADMIN = 'TENANT_ADMIN',
  BRANCH_ADMIN = 'BRANCH_ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  DENTIST = 'DENTIST',
}

export enum PlatformRoleCode {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}
```

`DENTAL_ASSISTANT` chưa xuất hiện trong enum/schema MVP. Khi milestone chairside bắt đầu, thêm enum value, policy và test cùng một migration; không seed hoặc cho phép gán role đó trước khi hành vi của nó được chốt.

Không có hierarchy hoặc kế thừa role: `TENANT_ADMIN` không tự có quyền `DENTIST`, và `PLATFORM_ADMIN` không tự có quyền tenant/clinical. Khi một request hợp lệ với nhiều role, quyền hiệu lực là hợp quyền của các assignment **trong cùng tenant và cùng scope branch**, rồi vẫn phải qua điều kiện nghiệp vụ của resource.

### 10.2 `platform_role_assignments`

Đây là bảng độc lập, không có `tenant_id`, để loại trừ khả năng một row có `tenant_id = NULL` vô tình được diễn giải là "mọi tenant".

| Cột | Kiểu / quy tắc | Ý nghĩa |
| --- | --- | --- |
| `id` | UUID PK | Định danh grant |
| `user_id` | UUID FK → `users.id`, `NOT NULL` | Platform identity được cấp quyền |
| `role_code` | `platform_role_code_enum`, `NOT NULL` | MVP chỉ có `PLATFORM_ADMIN` |
| `assigned_by_user_id` | UUID FK → `users.id`, nullable | Actor cấp quyền; nullable chỉ cho bootstrap hệ thống |
| `assigned_at` | `timestamptz`, `NOT NULL` | Thời điểm cấp quyền |
| `assignment_reason` | `varchar(500)`, nullable | Lý do, bắt buộc theo policy vận hành |
| `revoked_by_user_id` | UUID FK → `users.id`, nullable | Actor thu hồi |
| `revoked_at` | `timestamptz`, nullable | `NULL` nghĩa là grant còn hiệu lực |
| `revocation_reason` | `varchar(500)`, nullable | Lý do thu hồi |
| `created_at`, `updated_at` | `timestamptz` | Metadata kỹ thuật |

Index/ràng buộc:

```sql
CREATE UNIQUE INDEX uq_active_platform_role_assignment
  ON platform_role_assignments (user_id, role_code)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_active_platform_role_assignments_by_user
  ON platform_role_assignments (user_id)
  WHERE revoked_at IS NULL;
```

Không hard-delete assignment. Thu hồi quyền đặt `revoked_at`; cấp lại tạo một grant mới để lịch sử quyền không bị mất.

### 10.3 `role_assignments`

| Cột | Kiểu / quy tắc | Ý nghĩa |
| --- | --- | --- |
| `id` | UUID PK | Định danh grant scoped |
| `user_id` | UUID FK → `users.id`, `NOT NULL` | User được cấp role |
| `tenant_id` | UUID FK → `tenants.id`, `NOT NULL` | Tenant mà grant có hiệu lực |
| `branch_id` | UUID nullable, composite FK với `tenant_id` → `branches(id, tenant_id)` | `NULL` chỉ với Tenant Admin; khác `NULL` là branch scope cụ thể |
| `role_code` | `tenant_role_code_enum`, `NOT NULL` | Một trong bốn role tenant-facing của MVP |
| `assigned_by_user_id` | UUID FK → `users.id`, nullable | Actor cấp role; nullable chỉ cho provisioning/bootstrap |
| `assigned_at` | `timestamptz`, `NOT NULL` | Thời điểm có hiệu lực |
| `assignment_reason` | `varchar(500)`, nullable | Lý do cấp, nếu policy yêu cầu |
| `revoked_by_user_id` | UUID FK → `users.id`, nullable | Actor thu hồi role/scope |
| `revoked_at` | `timestamptz`, nullable | `NULL` nghĩa là grant còn hiệu lực |
| `revocation_reason` | `varchar(500)`, nullable | Lý do thu hồi |
| `created_at`, `updated_at` | `timestamptz` | Metadata kỹ thuật |

Các field định nghĩa phạm vi (`user_id`, `tenant_id`, `branch_id`, `role_code`) là bất biến sau khi tạo. Đổi role, tenant hoặc branch phải tạo grant mới và thu hồi grant cũ; không `UPDATE` trực tiếp để audit dễ đọc và tránh cửa sổ cấp quyền không rõ ràng.

Ràng buộc bắt buộc:

```sql
-- Tenant Admin áp dụng cho toàn tenant; các role MVP khác luôn phải chỉ rõ branch.
CHECK (
  (role_code = 'TENANT_ADMIN' AND branch_id IS NULL)
  OR
  (role_code IN ('BRANCH_ADMIN', 'RECEPTIONIST', 'DENTIST') AND branch_id IS NOT NULL)
);

-- Hai index riêng tránh ngữ nghĩa NULL của unique index PostgreSQL.
CREATE UNIQUE INDEX uq_active_tenant_wide_role_assignment
  ON role_assignments (user_id, tenant_id, role_code)
  WHERE revoked_at IS NULL AND branch_id IS NULL;

CREATE UNIQUE INDEX uq_active_branch_role_assignment
  ON role_assignments (user_id, tenant_id, role_code, branch_id)
  WHERE revoked_at IS NULL AND branch_id IS NOT NULL;

CREATE INDEX idx_active_role_assignments_for_authorization
  ON role_assignments (user_id, tenant_id, branch_id, role_code)
  WHERE revoked_at IS NULL;
```

`branches` phải có `UNIQUE (id, tenant_id)` để có thể dùng composite foreign key dưới đây. Tương tự, mỗi `Branch` tự có FK `tenant_id → tenants.id`.

```sql
ALTER TABLE role_assignments
  ADD CONSTRAINT fk_role_assignments_branch_in_same_tenant
  FOREIGN KEY (branch_id, tenant_id)
  REFERENCES branches (id, tenant_id);
```

Đây là ràng buộc tenant isolation ở database: biết một `branchId` của tenant khác không thể tạo được assignment cross-tenant. Authorization ở API vẫn bắt buộc xác minh tenant context đã được chứng thực trước khi truy vấn; FK không thay thế guard.

### 10.3.1 Trạng thái persistence hiện tại

Migration `1786060800005-CreateAuthorizationRoleAssignments` và module `authorization` đã triển khai hai bảng assignment cùng enum, FK, CHECK và partial index nêu trên. Authorization service hiện đọc active assignment để tạo authorization snapshot cho `POST /auth/login`, `POST /auth/refresh` và `GET /auth/me`. Fixture synthetic cho development/test hiện tạo Tenant, Branch, User và các grant fixed-role theo thứ tự; module vẫn chưa có route riêng, DTO grant/revoke hay command quản trị role.

### 10.4 Policy ở code, không phải entity dữ liệu

Permission đã được định nghĩa bằng policy map bất biến tại `modules/authorization/authorization.policy.ts`; không lưu thành entity/database enum và không có endpoint CRUD. Snapshot auth trả platform permission và effective permission theo tenant/branch để client ẩn/hiện UI, nhưng policy backend vẫn là nguồn quyết định quyền.

Policy hiện có capability Platform (`platform.*`), quản trị tenant (`tenant.settings.manage`, `branch.manage`, `service-catalog.manage`, `staff.manage`, reports/audit/billing/notification), Receptionist và Dentist theo ma trận role ở đầu tài liệu. Mỗi action mới phải được thêm có chủ đích vào policy, guard và test; mặc định không khớp permission là `403`. Không thêm direct user permission, tenant-custom role, wildcard (`*`) hay super-admin bypass cho dữ liệu tenant.

### 10.5 Entity nghiệp vụ dùng làm điều kiện quyền

Role và branch scope chỉ trả lời "người này có thể làm loại thao tác này ở đâu". Chúng không tự trả lời "người này có được thao tác trên ca này không". Những entity nghiệp vụ sau phải lưu ownership/assignment rõ ràng:

| Entity nghiệp vụ | Thuộc tính authorization cần có | Quy tắc dành cho Dentist |
| --- | --- | --- |
| `Appointment` | `tenant_id`, `branch_id`, `assigned_dentist_user_id` | Chỉ dentist đang được gán mới bắt đầu/ghi clinical data |
| `Visit` | `tenant_id`, `branch_id`, `appointment_id`, `opened_by_user_id` | Phải cùng tenant/branch và bắt nguồn từ appointment hợp lệ |
| `TreatmentPlan` / `TreatmentItem` | `tenant_id`, `branch_id`, `visit_id`, `responsible_dentist_user_id` | Cần dentist role + branch scope + assignment ca phù hợp |
| `PatientInvoice` / `Payment` | `tenant_id`, `branch_id`, `recorded_by_user_id` | Receptionist/Branch Admin trong đúng branch; không có update/delete payment thường |

Nếu sau này cần nhiều dentist/assistant trong một appointment hoặc cần lịch sử chuyển giao riêng, bổ sung `appointment_clinician_assignments` ở module Appointment, không mở rộng `role_assignments` để mang dữ liệu ca. Bảng đó phải mang `tenant_id`, `branch_id`, `appointment_id`, `clinician_user_id`, `assignment_kind`, `assigned_by_user_id`, `assigned_at`, `ended_at`, lý do và composite FK cùng tenant. Một partial unique index bảo đảm chỉ một `PRIMARY_DENTIST` active cho một appointment trong MVP.

### 10.6 Audit, lifecycle và thứ tự migration

- Mọi `INSERT`/thu hồi `PlatformRoleAssignment` hoặc `RoleAssignment` tạo `AuditLog` với action (`ROLE_GRANTED`, `ROLE_REVOKED`, `BRANCH_SCOPE_GRANTED`, `BRANCH_SCOPE_REVOKED`), actor, tenant/branch khi có, resource ID, request ID, reason và before/after an toàn. Không ghi password, token hoặc clinical detail vào audit payload.
- Vô hiệu hóa `User` hoặc suspend tenant làm mọi assignment không hiệu lực trong guard; không cần viết lại hàng loạt `revoked_at`. Khi user/tenant được mở lại, các assignment chưa bị thu hồi lại có thể có hiệu lực theo policy. Nếu muốn thu hồi vĩnh viễn, thực hiện revoke rõ ràng để có audit.
- Không cascade delete từ `users`, `tenants` hoặc `branches` sang assignment/audit. Tenant và branch được ngừng hoạt động theo lifecycle; lịch sử quyền phải còn nguyên.
- Thứ tự triển khai schema: `Tenant` → `Branch` (bao gồm `UNIQUE (id, tenant_id)`) → enum/tables assignment → fixture seed assignment synthetic → `AuditLog` → authorization guard/service.
- `AuditLog`, tenant-context resolver, Subscription Guard và authorization guard vẫn chưa được triển khai. Fixed permission policy và auth authorization snapshot đã có, nhưng snapshot chỉ dùng cho UI chứ không thay enforcement ở API. Khi thêm command cấp/thu hồi role, các command đó phải ghi audit và không được sửa trực tiếp các field scope bất biến.

### 10.7 Thuật toán guard sẽ dùng khi service được thêm

```text
Authenticate session
  → resolve tenant từ tenantSlug đã xác minh, không từ client tenantId
  → kiểm tra tenant/subscription policy
  → tải active RoleAssignment theo (userId, resolved tenantId, target branchId)
  → đối chiếu fixed policy map
  → kiểm tra ownership/assignment và trạng thái resource
  → query/update luôn kèm tenantId; nếu branch-owned thì kèm branchId
```

`platform_role_assignments` chỉ được đọc ở route `/platform/*`; nó không đi vào query clinical. Các endpoint tenant-facing cũng không tin `branchId` từ body để cấp quyền: branch ID chỉ là resource cần đối chiếu với scope đã tải và tenant context đã xác minh.
