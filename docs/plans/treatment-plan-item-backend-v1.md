# Treatment Plan/Item Backend V1 — đa Visit

> **Đã triển khai Backend V1 (2026-09-24).** Đây là tài liệu handoff
> để triển khai backend Treatment Plan/Item V1 ở phiên tiếp theo. Nó chốt các
> quyết định dưới đây; không được âm thầm quay lại mô hình Plan thuộc duy nhất
> một Visit. Contract clinical chính thức sẽ được cập nhật cùng code tại các
> tài liệu domain đánh số trong `docs/`.

## 1. Mục tiêu, ranh giới và bất biến

`TreatmentPlan` là kế hoạch điều trị dài hạn thuộc **Patient + Branch + Tenant**.
Nó có một `originVisitId` bất biến để ghi nhận Visit đã khởi tạo, nhưng Visit đó
không phải mặc định hay giới hạn cho các lần thực hiện sau này.

- Dentist luôn dùng một **current Visit** làm ngữ cảnh khi xem, sửa hoặc thực
  hiện Plan. Current Visit phải `OPEN`, Appointment tương ứng phải
  `IN_PROGRESS`, và actor phải là Dentist được gán Appointment đó.
- Vì vậy Dentist ở Visit #002 hoặc #003 có thể thao tác Plan khởi tạo ở Visit
  #001, kể cả sau khi origin Visit đã `COMPLETED`, nếu các Visit cùng Patient,
  Tenant và Branch. Plan không được truy cập hay thực hiện ở branch khác, kể cả
  branch cùng tenant.
- Khi tạo Plan, server xác minh chuỗi `origin Visit → Appointment`, rồi lấy
  `patientId`, `tenantId` và `branchId` từ context/Appointment đã xác minh.
  Client không bao giờ gửi các ID scope này trong body.
- Không thay đổi behavior của Appointment hoặc Visit hiện hữu. Không triển khai
  invoice/payment, follow-up, odontogram, attachment, cross-branch handoff hay
  Treatment UI trong V1 này.
- Tenant isolation là bắt buộc: mọi query/write Plan đều có tenant/branch từ
  route đã resolve; mọi đối chiếu Patient/Visit/Plan còn được thực hiện ở
  service. Không dùng ID do client cung cấp làm căn cứ cấp quyền.

## 2. Data model và persistence contract

### 2.1 `TreatmentPlan`

Thêm enum `TreatmentPlanStatus`:

```text
DRAFT → PROPOSED → ACCEPTED → PARTIALLY_COMPLETED → COMPLETED
  │        │           │
  └────────┴───────────→ CANCELLED
```

Plan có `id`, `tenantId`, `branchId`, `patientId`, `originVisitId`,
`createdByUserId`, `status`, `acceptedByUserId?`, `acceptedAt?`, `createdAt` và
`updatedAt`.

- `originVisitId` là immutable.
- `acceptedByUserId` và `acceptedAt` luôn cùng null hoặc cùng có giá trị.
  Reopen xóa cả hai; Plan đã từng ACCEPTED rồi CANCELLED giữ acceptance lịch sử.
- `tenantId`/`branchId` có composite FK tới Branch ở cùng tenant khi schema hiện
  hữu hỗ trợ; `tenantId`, Patient, origin Visit và các User references dùng FK
  `RESTRICT` phù hợp. Tính nhất quán origin Visit/Appointment/Patient/Branch
  được service xác minh vì Visit hiện chỉ tới Patient qua Appointment.
- Có index `(tenant_id, branch_id, patient_id)` để lấy Plan lịch sử của patient
  trong branch, và index `(origin_visit_id)`.

### 2.2 `TreatmentItem`

Thêm enum `TreatmentItemStatus`:

```text
PENDING → IN_PROGRESS → COMPLETED
   │           │
   └───────────→ CANCELLED
```

Item thuộc một Plan và lưu snapshot Service immutable gồm `serviceId`,
`serviceCode`, `serviceName`, `listUnitAmount`, `currency`; cùng `quantity`,
`discountAmount`, `finalUnitAmount`, vị trí/răng, chỉ định,
`plannedDentistUserId`, `status`, timestamps.

- Chỉ Service `ACTIVE` cùng tenant được dùng khi thêm hoặc thay item ở Draft.
  Catalog thay đổi/deactivate sau đó không hồi tố snapshot.
- Amount dùng integer minor unit nhất quán với `Service.amount`; quantity dương;
  discount không âm và không vượt list unit amount. Server luôn tính
  `finalUnitAmount = listUnitAmount - discountAmount`; client không được override
  hoặc thêm surcharge ở V1.
- `plannedDentistUserId` là bắt buộc, phải có active `DENTIST` grant tại branch
  của Plan tại thời điểm lưu Draft. Đây chỉ là bác sĩ dự kiến/snapshot planning,
  không cấp quyền, không thay thế Dentist thực hiện thực tế và không làm mất
  lịch sử nếu grant sau đó bị thu hồi.
- Vị trí/răng và chỉ định là clinical-sensitive; chúng có trong response Dentist
  nhưng không được ghi audit payload, application log hay response Receptionist.

### 2.3 `TreatmentItemEvent`

Thêm enum event `IN_PROGRESS | COMPLETED | CANCELLED`. Event có
`id`, `treatmentItemId`, `treatmentPlanId`, `visitId`, `performedByUserId`,
`eventType`, `createdAt`.

- Mỗi event luôn tham chiếu current Visit và Dentist thực tế lấy từ actor, không
  nhận `visitId` hay `performedByUserId` từ body.
- Một Visit có thể ghi event cho nhiều Item thuộc nhiều Plan; một Item có thể có
  nhiều event `IN_PROGRESS` ở các Visit khác nhau trước khi hoàn tất.
- Enforce item/plan pair bằng composite relation/unique key phù hợp để event
  không thể tham chiếu Item của Plan khác. FK User/Visit/Plan/Item đều
  `RESTRICT`.
- Có index `(treatment_item_id, created_at, id)` và `(visit_id, created_at, id)`
  cho history/cursor pagination. Event là append-only: migration tạo trigger
  PostgreSQL từ chối `UPDATE` và `DELETE`, tương tự TreatmentNote.

## 3. API và payload contract

Mọi route bên dưới nằm dưới base branch-scoped đã xác minh:

```text
/tenants/:tenantSlug/branches/:branchSlug
```

### 3.1 Dentist API

| Method | Route | Quy tắc |
| --- | --- | --- |
| `GET` | `/visits/:visitId/treatment-plans` | Trả danh sách Plan của Patient trong **current Visit**, cùng branch; áp dụng pagination list chuẩn hiện có. |
| `POST` | `/visits/:visitId/treatment-plans` | Tạo `DRAFT` **rỗng**; không nhận item ban đầu. |
| `GET` | `/visits/:visitId/treatment-plans/:planId` | Trả Plan/detail Item cho Dentist có case hiện tại hợp lệ. |
| `PATCH` | `/visits/:visitId/treatment-plans/:planId` | Chỉ `DRAFT`; nhận danh sách Item cuối cùng để đồng bộ atomically. |
| `POST` | `/visits/:visitId/treatment-plans/:planId/propose` | Chỉ `DRAFT`, yêu cầu ít nhất một Item. |
| `POST` | `/visits/:visitId/treatment-plans/:planId/reopen` | Chỉ `PROPOSED`; body bắt buộc `reasonCode`; xóa acceptance. |
| `POST` | `/visits/:visitId/treatment-plans/:planId/cancel` | Hủy trực tiếp Plan theo quy tắc tại mục 4; body bắt buộc `reasonCode`. |
| `GET` | `/visits/:visitId/treatment-plans/:planId/items/:itemId/events` | Event history phân trang cursor `(createdAt,id)`; chỉ Dentist với current Visit hợp lệ. |
| `POST` | `/visits/:visitId/treatment-plans/:planId/items/:itemId/events` | Ghi event thực hiện; body chỉ có `eventType` và `reasonCode` bắt buộc khi `CANCELLED`. |

`PATCH` nhận list Item cuối cùng: item có `id` là update Item thuộc đúng Plan;
không có `id` là create; Item hiện hữu không có trong list bị delete. ID trùng,
ID không thuộc Plan, Service inactive/sai tenant, planned Dentist sai branch, hay
payload không hợp lệ phải làm toàn bộ transaction rollback. Patch không có
plan-level mutable fields.

### 3.2 Receptionist acceptance API

```text
POST /treatment-plans/:planId/accept
```

Chỉ `RECEPTIONIST` có `treatment-plan.accept` trong branch đã resolve được gọi;
không cần hay nhận current Visit. Chỉ transition `PROPOSED → ACCEPTED`, lấy actor
và timestamp từ server, và chỉ trả receipt tối thiểu gồm Plan ID, state,
acceptance actor, timestamp. Receptionist không có list/detail hoặc clinical
content Plan/Item.

### 3.3 Error, idempotency và response rules

- Mọi `POST`/`PATCH` command ở trên dùng `@Idempotent()` với operation riêng:
  create, draft-sync, propose, reopen, Plan cancel, accept và item-event record.
  Client phải gửi `Idempotency-Key` UUID v4; replay dùng outcome idempotency hiện
  hữu và không tạo thêm event/audit.
- `GET` không dùng key. Event list trả `{ items, nextCursor }` với cursor opaque
  base64url từ `(createdAt,id)`, theo pattern Audit Log hiện có.
- Resource nằm ngoài tenant/branch hoặc Plan không cùng Patient của current Visit
  trả `404`; current Visit đã đóng hay Appointment không `IN_PROGRESS` trả `409`;
  thiếu permission/assignment trả `403`; input invalid trả `422`; invalid state
  transition trả `409`.
- Dentist response có thể trả clinical detail cần thiết; receipt Receptionist và
  audit tuyệt đối không lộ chỉ định, răng/vị trí, Service name hoặc giá.

## 4. Authorization và business state machine

### 4.1 Permission policy

- Giữ `treatment-plan.write` cho Dentist.
- Đổi capability chưa dùng `treatment-item.complete` thành
  `treatment-item.execute` cho Dentist; cập nhật backend policy, auth E2E
  expectation và `client/src/features/auth/auth.types.ts` để snapshot contract
  không còn permission cũ.
- Thêm `treatment-plan.accept` chỉ cho Receptionist.
- Tenant Admin và Branch Admin không tự có clinical permission; chỉ có thể thao
  tác nếu đồng thời có grant `DENTIST`/`RECEPTIONIST` đúng branch.

### 4.2 Current Visit authorization

Mọi thao tác Dentist, kể cả list/detail, phải resolve current Visit trong scope
route và xác minh theo thứ tự nghiệp vụ:

1. Appointment/Visit nằm trong tenant + branch đã resolve.
2. Visit `OPEN`, Appointment `IN_PROGRESS`.
3. Actor là `assignedDentistUserId` của Appointment hiện tại.
4. Plan nằm cùng tenant/branch và có `patientId` bằng Patient của Appointment
   hiện tại.

Chỉ `originVisitId` được dùng khi tạo Plan. Sau đó origin Visit có thể completed
vẫn không chặn current Visit hợp lệ thao tác Plan.

### 4.3 Plan transitions

- `POST create` tạo `DRAFT` không item. `PATCH` chỉ ở `DRAFT`; `propose` yêu cầu
  ít nhất một Item rồi chuyển `DRAFT → PROPOSED`.
- `reopen` chỉ `PROPOSED → DRAFT`, bắt buộc reason code và xóa actor/timestamp
  acceptance cũ.
- Receptionist `accept` chỉ `PROPOSED → ACCEPTED`.
- Dentist chỉ được tạo clinical execution event khi Plan hiện `ACCEPTED` hoặc
  state thực thi suy ra còn hoạt động (`PARTIALLY_COMPLETED`); không bao giờ từ
  `DRAFT`/`PROPOSED`.
- Direct Plan cancel chỉ hợp lệ từ `DRAFT`, `PROPOSED` hoặc `ACCEPTED`, không có
  bất kỳ `TreatmentItemEvent` nào và, khi financial module tồn tại, chỉ khi mọi
  invoice/payment liên quan đã void hoặc bù trừ. V1 chưa có financial module nên
  điều kiện tài chính hiện thỏa một cách rõ ràng, không được giả lập invoice.
- Direct cancel chuyển Plan sang `CANCELLED` và bulk-cancel mọi Item `PENDING`
  trong cùng transaction. Không tạo clinical event vì chưa có thực hiện; vẫn ghi
  audit transition an toàn cho Plan/Item.

### 4.4 Item event transitions và suy ra Plan state

- `IN_PROGRESS` đầu tiên chỉ hợp lệ từ `PENDING`, tạo event và chuyển Item sang
  `IN_PROGRESS`. Event `IN_PROGRESS` tiếp theo khi Item đang `IN_PROGRESS` chỉ
  ghi thêm buổi điều trị, không đổi Item state.
- `COMPLETED` chỉ hợp lệ từ `IN_PROGRESS`; `CANCELLED` chỉ hợp lệ từ `PENDING`
  hoặc `IN_PROGRESS`, bắt buộc reason code. Cả hai ghi event với current Visit
  và Dentist thực tế.
- Event và Item status được lock/cập nhật trong một transaction. Sau mỗi event,
  Plan state được suy ra từ toàn bộ Item:
  - Có Item `COMPLETED` và chưa tất cả Item terminal: `PARTIALLY_COMPLETED`.
  - Mọi Item terminal và có ít nhất một Item `COMPLETED`: `COMPLETED`.
  - Mọi Item `CANCELLED` và chưa có Item `COMPLETED`: tự động `CANCELLED`.
    Đây là derived transition, **không** phải direct cancel command, nên không
    mâu thuẫn quy tắc cấm hủy trực tiếp Plan đã có event.
  - Nếu chỉ một Item completed và tất cả Item đã terminal, Plan có thể chuyển
    trực tiếp `COMPLETED`; không tạo intermediate state nhân tạo.
- Plan có Item event không thể direct-cancel. Plan `COMPLETED`/`CANCELLED` không
  nhận thêm event.

## 5. Transaction, concurrency và audit

### 5.1 Transaction/lock contract

- Mỗi mutation service tự sở hữu `dataSource.transaction`, nhất quán với module
  hiện hữu; không đưa generic Unit of Work hoặc idempotency claim vào transaction
  nghiệp vụ.
- Với Dentist command, lock theo thứ tự cố định: **current Appointment/Visit →
  Plan → Item**. Khi cần nhiều Item, lock theo thứ tự ID ổn định. Service snapshot
  Service/role trong cùng transaction theo repository/query hiện hữu.
- Event insert, Item transition, derived Plan transition và toàn bộ AuditLog liên
  quan phải commit hoặc rollback cùng nhau. Acceptance chỉ lock Plan vì không có
  current Visit.
- Idempotency interceptor vẫn claim/replay ngoài transaction business theo kiến
  trúc best-effort hiện tại. Không tự implement idempotency trong Treatment
  service.

### 5.2 Audit contract

Mở rộng `AuditAction`/registry với:

- `TREATMENT_PLAN_ACCEPTED`
- `TREATMENT_PLAN_REOPENED`
- `TREATMENT_ITEM_EVENT_RECORDED`

Tiếp tục dùng `TREATMENT_PLAN_STATE_CHANGED` và
`TREATMENT_ITEM_STATE_CHANGED` cho mọi transition tương ứng, gồm bulk cancel và
derived Plan transition. Acceptance/reopen ghi cả action chuyên biệt và
state-change trong cùng transaction. Repeated `IN_PROGRESS` không đổi state chỉ
ghi `TREATMENT_ITEM_EVENT_RECORDED`.

Audit payload allowlist chỉ cho resource ID (trường chuẩn của AuditLog), `visitId`,
state và `reasonCode` khi có; timestamp dùng `occurredAt` chuẩn. Không ghi patient
identity, Service ID/code/name/price, quantity, tooth position, indication,
clinical note hay free-text reason. Mọi action clinical mang tenant/branch đã
resolve và actor/session hiện tại.

## 6. Phases triển khai

Trạng thái code: Phase 1–4 đã hoàn thành; Phase 5 đã hoàn thành build, migration
run/revert và E2E targeted. Full backend E2E cần chạy trong CI với database test
độc quyền; interactive runner không hoàn thành bộ đó trong thời gian chạy cho
phép, nên không dùng nó làm release gate ở phiên này.

### Phase 1 — Persistence foundation

**Trạng thái:** hoàn thành 2026-09-24 (`CreateTreatmentPlans1786060800023`; migration test run/revert pass).

**Dependency:** không có.

**Phạm vi và công việc**

- Tạo migration kế tiếp Visits cho ba enum, `treatment_plans`,
  `treatment_items`, `treatment_item_events`, constraints/FK/check/index đã chốt
  ở mục 2, cùng append-only trigger/function cho Event.
- Thêm entities, enum TypeScript, relationship và repository query cơ bản; đăng
  ký entity/module TypeORM mà không sửa Appointment/Visit behavior.
- Đảm bảo migration `down` gỡ trigger/function, bảng, enum theo thứ tự dependency
  an toàn.

**Tiêu chí hoàn thành**

- Migration up/down chạy được trên test database; database từ migration mới có
  đầy đủ FK, index, money/quantity/acceptance checks và Event không thể update/
  delete.
- Không có seed hay test data bệnh nhân thật.

**Test cần chạy**

- Migration test run/revert.
- Repository/database integration kiểm tra constraints, composite item/plan
  reference, indexes theo query path, và trigger append-only.

### Phase 2 — Core Treatment workflow

**Trạng thái:** hoàn thành 2026-09-24.

**Dependency:** Phase 1 hoàn thành.

**Phạm vi và công việc**

- Tạo `TreatmentPlansModule`, service/repository và DTO/response mapper cho
  create Draft rỗng, draft replacement atomic, propose, reopen, direct cancel,
  accept và event workflow.
- Dùng Appointment/Visit đã có để resolve case hiện tại và Patient; reuse query
  Service/RoleAssignment để kiểm tra Service active và planned Dentist active
  trong branch.
- Implement state machine, financial integration point không-op V1, derived
  state, deterministic lock order và transaction/audit hook boundary.

**Tiêu chí hoàn thành**

- Mọi business rule mục 1–5 được enforce ở service, không chỉ ở controller/UI.
- Origin Visit bất biến; Plan cũ cùng patient/branch hoạt động được qua Visit mới;
  Plan khác patient/branch bị ẩn.
- Draft replacement là all-or-nothing; Event thực hiện không thể làm duplicate
  hoặc lệch Item/Plan state khi concurrent.

**Test cần chạy**

- Unit/service tests cho toàn bộ valid/invalid transition, snapshot calculation,
  planned Dentist/Service validation, direct/bulk/derived cancellation và lock
  ordering path.
- Database-level test Event append-only và state/audit rollback khi một write
  thất bại.

### Phase 3 — HTTP contract, RBAC và idempotency

**Trạng thái:** hoàn thành 2026-09-24 (bao gồm auth snapshot regression E2E).

**Dependency:** Phase 2 hoàn thành.

**Phạm vi và công việc**

- Thêm Dentist và Receptionist controllers/routes đúng mục 3 với
  `@TenantScope('branch')`, `@RequirePermissions`, parsing UUID/DTO validation
  và pagination Event cursor.
- Gắn `@Idempotent()` operation riêng cho từng command; không gắn GET.
- Đổi permission `treatment-item.complete` → `treatment-item.execute`, thêm
  `treatment-plan.accept`, cập nhật fixed-role policy, auth assertions và client
  permission union. Không thêm treatment UI/frontend route.
- Đảm bảo response Receptionist chỉ là receipt; service/controller không mở
  clinical list/detail cho Receptionist/Admin.

**Tiêu chí hoàn thành**

- Scope, subscription, branch activity, RBAC, case ownership và service-state
  cho các route đều áp dụng đúng thứ tự guard hiện hữu.
- Cùng idempotency key replay nguyên outcome; request concurrent hoặc fingerprint
  mismatch theo generic contract hiện hữu; không có Event/Audit duplicate.

**Test cần chạy**

- E2E API cho `401/403/404/409/422`, permission snapshot mới, branch/tenant
  isolation, current Visit requirements, acceptance receipt redaction và cursor
  pagination.
- E2E idempotency replay, same-key concurrency và key mismatch cho create,
  state transition, accept và event record.

### Phase 4 — Audit và documentation contract

**Trạng thái:** hoàn thành 2026-09-24.

**Dependency:** Phase 2; nên hoàn thành cùng Phase 3 trước khi merge.

**Phạm vi và công việc**

- Mở rộng audit action registry/payload allowlist và ghi action đúng mục 5 cho
  mọi Treatment mutation trong cùng transaction.
- Cập nhật `docs/00-product-plan.md`, `docs/03-role-workflows.md`,
  `docs/05-audit-log.md`, `docs/06-domain-workflows.md` và
  `docs/09-idempotency-implementation-plan.md` để thay mô hình Plan thuộc Visit
  cũ bằng origin/execution đa Visit, routes, RBAC, audit và rollout status mới.
- Giữ payment model tách biệt; không cập nhật nó thành một implementation financial
  giả định.

**Tiêu chí hoàn thành**

- Action registry chấp nhận đúng safe fields và từ chối clinical/PII/pricing.
- Tài liệu domain không còn route/item command hay ownership cũ mâu thuẫn với
  contract này.

**Test cần chạy**

- Audit E2E xác minh action/resource/state/reason/visit an toàn, transaction
  rollback và JSON audit không chứa tooth, indication, Service name/price hay
  clinical content.

### Phase 5 — End-to-end verification và handoff completion

**Trạng thái:** hoàn thành phần kiểm thử khả dụng 2026-09-24: `npm run build`, migration run/revert, Visit regression E2E, auth snapshot E2E và Treatment V1 targeted E2E pass. Full-suite release gate còn cần CI database độc quyền như ghi ở đầu mục 6.

**Dependency:** Phase 1–4 hoàn thành.

**Phạm vi và công việc**

- Viết/chạy E2E xuyên Visit và các regression test nêu ở mục 7.
- Chạy TypeScript build, targeted/full backend E2E theo môi trường sẵn có, kiểm
  tra migration clean database và review `git diff` để bảo đảm không có scope
  creep sang Appointment, financial hoặc frontend UI.
- Đổi trạng thái các phase trong tài liệu này thành hoàn thành, kèm ngày và link
  test/commit khi có.

**Tiêu chí hoàn thành**

- Toàn bộ acceptance test pass; migration có thể áp dụng từ database mới; public
  docs/policy/auth types nhất quán với backend.

**Test cần chạy**

- `npm run build` trong `backend`.
- Migration test run/revert và `npm run test:e2e` hoặc bộ targeted E2E tương đương
  khi environment test khả dụng.

## 7. Acceptance/E2E matrix bắt buộc

1. Tạo Draft rỗng tại Visit #001, sync items, propose, hoàn tất origin Visit,
   Receptionist accept, rồi dùng Visit #002/#003 cùng patient/branch ghi event;
   origin không đổi và mỗi event giữ đúng Visit/Dentist.
2. Một Visit thực hiện item của nhiều Plan; nhiều `IN_PROGRESS` ghi history;
   Item/Plan đi đúng `PARTIALLY_COMPLETED`, `COMPLETED`, direct cancel hoặc
   all-items-cancelled derived `CANCELLED`.
3. Dentist được gán Visit sau được làm Plan cũ; Dentist không được gán, branch
   khác, tenant khác, patient khác không thể đọc/thao tác. Closed Visit hoặc
   Appointment ngoài `IN_PROGRESS` bị `409`.
4. Patch Draft replacement create/update/delete atomically; invalid Item làm
   rollback toàn bộ; Service inactive/sai tenant và planned Dentist không active
   trong branch bị từ chối.
5. Reopen xóa acceptance; accept chỉ `PROPOSED`; Receptionist không đọc clinical;
   Plan có event không direct-cancel; accepted Plan cancellation kiểm tra điểm
   tích hợp financial khi module đó tồn tại.
6. Replay/concurrency idempotency không tạo Event, state transition hay AuditLog
   trùng; event/audit write rollback cùng transaction; Event database trigger
   chặn mutation.
7. Audit chỉ có fields safe; không chứa vị trí/răng, chỉ định, clinical content,
   Service name/code/price hoặc PII. Toàn bộ test data là synthetic.

## 8. Chưa triển khai, giả định và vấn đề còn mở

### Trạng thái hiện tại

- Backend V1 có migration/entities Treatment, `TreatmentPlansModule`, Dentist
  route branch-scoped, receipt accept riêng cho Receptionist, permission mới,
  idempotency và audit action an toàn. E2E dùng dữ liệu synthetic.
- Không có Treatment UI, PatientInvoice/Payment, follow-up, odontogram,
  attachment hay cross-branch handoff trong thay đổi này.

### Giả định đã chốt

- Create Plan là Draft rỗng; PATCH là con đường duy nhất để gửi/synchronize Item
  đầu tiên và mọi lần thay Draft.
- Chỉ Plan đã acceptance mới bắt đầu execution event.
- `plannedDentistUserId` bắt buộc và phải là Dentist active cùng branch, nhưng
  không có ý nghĩa authorization thực thi.
- Direct Plan cancel bulk-cancel Item `PENDING` không event; toàn bộ item bị
  cancel qua Event mà chưa completed sẽ derived-cancel Plan.
- Plan list dùng current Visit để xác định Patient; Event list dùng cursor. Không
  thêm cross-branch, financial, follow-up hay UI behavior ngoài các contract này.

### Điểm cần giữ mở có chủ đích

- **Financial integration:** V1 không có PatientInvoice/Payment schema. Khi module
  financial được thêm, phải thay điều kiện no-op của direct Plan cancel bằng query
  transactional kiểm tra invoice/payment active hoặc net collected; không sửa lại
  history Treatment và không trộn tiền clinical với SaaS billing.
- **Cross-branch handoff:** không thuộc V1. Nếu cần trong tương lai, đó là thiết kế
  ownership/consent/audit mới, không phải bỏ filter branch hiện tại.
- **Frontend workflow:** không thuộc V1 này. Chỉ permission type cần đồng bộ để
  authorization snapshot hợp lệ; route/UI/i18n Treatment phải có kế hoạch riêng.
- Chi tiết kỹ thuật không ảnh hưởng nghiệp vụ như tên lớp DTO/repository, giới hạn
  text áp dụng theo convention hiện hữu và Swagger response decorator phải được
  chọn nhất quán codebase, nhưng không được thay state/API/authorization contract
  đã chốt trong tài liệu này.

## 9. Implementation Handoff cho phiên Codex tiếp theo

1. Đọc toàn bộ file này trước. Sau đó đọc `AGENTS.md`, `docs/README.md`,
   `docs/01-payment-model.md`, `docs/03-role-workflows.md`,
   `docs/05-audit-log.md`, `docs/06-domain-workflows.md` và
   `docs/09-idempotency-implementation-plan.md` trước khi sửa product/schema/API.
2. Kiểm tra `git status --short`, migration cuối, `backend/src/modules/modules.module.ts`,
   Visit/Appointment/Service/Audit/Authorization/Idempotency hiện tại. Bảo toàn mọi
   thay đổi không liên quan trong worktree.
3. Đối chiếu trạng thái phase trong mục 6. Nếu không có commit/changelog đánh dấu
   khác, bắt đầu từ **Phase 1 — Persistence foundation**; không phân tích lại
   nghiệp vụ hay đưa Plan quay về ownership theo một Visit.
4. Hoàn thành và verify từng phase trước phase phụ thuộc; ghi lại trạng thái thực
   tế, test đã chạy và các deviation được người dùng phê duyệt ngay trong mục 6/8
   của file này.
5. Nếu yêu cầu mới mâu thuẫn với quyết định ở mục 1–5, dừng để chốt thay đổi sản
   phẩm trước khi code. Không tự nới tenant/branch isolation, clinical access,
   financial boundary hoặc audit redaction để “đơn giản hóa” implementation.
