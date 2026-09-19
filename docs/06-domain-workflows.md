# DentFlow — Clinical Domain Workflows

## 1. Mục đích và phạm vi MVP

Tài liệu này là contract chuẩn cho toàn bộ luồng vận hành clinical của DentFlow:

```text
Patient → Appointment → Check-in → Visit → Treatment Plan
        → PatientInvoice/Payment → Follow-up appointment
```

Nó chốt entity, ownership, trạng thái, quyền, API định hướng và audit trước khi
viết migration, endpoint hoặc UI. Khi có khác biệt, tài liệu này là nguồn quyết
định cho clinical workflow; [01-payment-model.md](./01-payment-model.md) vẫn là
nguồn quyết định cho ranh giới hai dòng tiền.

V1 không có odontogram trực quan, attachment Patient/Visit, chair/room,
`DENTAL_ASSISTANT`, kho/vật tư/labo, payment online cho bệnh nhân hay passkey.
Ảnh upload hiện có chỉ là object tạm; không được gắn vào clinical record cho đến
khi có contract attachment riêng.

## 2. Ownership, tenant isolation và dữ liệu nhạy cảm

| Entity | Ownership | Quy tắc bắt buộc |
| --- | --- | --- |
| `Patient` | Tenant | Mang `tenantId`, không bị giới hạn branch; `phoneNormalized` unique trong tenant. |
| `PatientAlert` | Tenant clinical | Thuộc Patient; chỉ Dentist đang có ca được phân công cho Patient mới xem/tạo/sửa. Alert có tính an toàn điều trị nên Dentist được phân công ở branch khác vẫn thấy alert hiện hành, nhưng không vì thế có quyền đọc lịch sử visit ở branch đó. |
| `Appointment`, `Visit`, `TreatmentPlan`, `TreatmentItem`, `TreatmentNote`, `PatientInvoice`, `Payment`, `FollowUpRecommendation` | Tenant + branch | Mọi query/write mang cả `tenantId` và `branchId` đã resolve từ route context. |

`Patient` được truy cập qua route branch-scoped dù bản ghi thuộc tenant. Cách
này cho phép Receptionist hoặc Branch Admin tại branch đã được cấp quyền tìm
Patient trên toàn tenant để tránh tạo trùng, nhưng không biến một route
tenant-wide thành quyền cho mọi user. Route global `/patients` chỉ là
placeholder UI hiện tại, không phải contract API hoặc route sản phẩm sau khi
module được triển khai.

Thông tin hành chính của Patient gồm họ tên, số liên lạc, ngày sinh, giới tính,
địa chỉ, người liên hệ khẩn cấp và nguồn giới thiệu. `phoneNormalized` được
chuẩn hóa server-side trước khi lưu; create trùng trong cùng tenant trả `409` và
client phải chọn Patient có sẵn. V1 không hỗ trợ bypass duplicate bằng lý do.

Phase Patient administrative yêu cầu `fullName`, `phone` và `gender` (`MALE`,
`FEMALE` hoặc `OTHER`) khi tạo. Ngày sinh, địa chỉ, người liên hệ khẩn cấp và
nguồn giới thiệu là optional; ngày sinh là `YYYY-MM-DD` không ở tương lai. Khi
có người liên hệ khẩn cấp, phải có cả tên và số điện thoại, quan hệ là optional.
Server giữ số người dùng nhập để hiển thị, đồng thời chuẩn hóa số hợp lệ về
E.164 với `VN` là quốc gia mặc định cho input không có mã nước. `phoneNormalized`
không được trả qua API, audit payload hay application log.

Patient alert, triệu chứng, tiền sử, chẩn đoán và mọi clinical note là dữ liệu
clinical-sensitive. Chúng không xuất hiện trong audit payload, log ứng dụng,
seed/test ngoài dữ liệu synthetic tối thiểu, list Patient hành chính hoặc
response cho role không có quyền clinical.

Timestamp clinical và lịch hẹn được lưu `timestamptz`. Khi nhập/hiển thị, branch
dùng timezone override của branch hoặc timezone mặc định tenant nếu branch
không có override.

## 3. Appointment và Visit

### Appointment

Appointment mang Patient, branch, khoảng thời gian, nguồn/lý do đến khám, ghi
chú vận hành và service tùy chọn. Nguồn V1 là `PHONE`, `WALK_IN`, `ONLINE` hoặc
`OTHER`. Nếu chọn Service, service phải `ACTIVE` trong
tenant đã resolve và Appointment snapshot mã, tên, giá, currency và thời lượng;
snapshot lịch hẹn không tự tạo invoice. Nếu không chọn Service, lý do đến khám
là bắt buộc.

`assignedDentistUserId` có thể `null` lúc tạo để hỗ trợ walk-in/hàng đợi. Khi có
giá trị, Dentist phải có active `DENTIST` grant trong đúng branch. Receptionist
được chọn Dentist **chỉ trong command tạo mới**; sau đó chỉ `BRANCH_ADMIN` được
gán, đổi hoặc bỏ gán Dentist đến hết `CHECKED_IN`. Appointment chưa có Dentist
được `CHECKED_IN`, nhưng không thể bắt đầu.

Backend hard-block khoảng thời gian giao nhau của cùng Dentist trên các
Appointment `BOOKED`, `CONFIRMED`, `CHECKED_IN` hoặc `IN_PROGRESS`. Hai khoảng
giao nhau khi `startAt < existing.endAt` và `endAt > existing.startAt`. Kiểm tra
phải concurrency-safe ở service/database, không chỉ cảnh báo UI. Chair/room và
override trùng lịch không thuộc V1.

```text
BOOKED → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED
   │          │
   ├──────────┼→ CANCELLED
   └──────────┴→ NO_SHOW
```

- Receptionist tạo, xác nhận, check-in, hủy/no-show và đổi giờ trước
  `IN_PROGRESS`; đổi giờ một Appointment `CONFIRMED` cần `PATIENT_REQUEST` hoặc
  `CLINIC_RESCHEDULE` và quay lại `BOOKED` để xác nhận lại. Hủy chỉ nhận
  `PATIENT_CANCELLED`, `CLINIC_CANCELLED` hoặc `DUPLICATE_BOOKING`; no-show chỉ
  nhận `PATIENT_NO_SHOW`. `CANCELLED`/`NO_SHOW` chỉ đi từ `BOOKED` hoặc
  `CONFIRMED` trong V1.
- Branch Admin điều phối slot và gán/đổi Dentist đến hết `CHECKED_IN`; assignment
  bị khóa ở `IN_PROGRESS` để bảo vệ ownership ca.
- `start` chỉ cho Dentist được gán, khi Appointment là `CHECKED_IN`; command chạy
  atomically để chuyển sang `IN_PROGRESS` và tạo đúng một Visit.
- `complete` chỉ hợp lệ khi Visit duy nhất đã `COMPLETED`. `CANCELLED` và
  `NO_SHOW` là terminal; Appointment đã `IN_PROGRESS` không bị cancel/no-show.

### Visit và clinical access

Một Appointment có tối đa một Visit, unique theo `appointmentId`. Visit mang
triệu chứng, tiền sử liên quan, khám, chẩn đoán và clinical note do Dentist
được phân công tạo.

```text
OPEN → COMPLETED
```

Khi Visit `OPEN`, chỉ Dentist owner của Appointment được sửa nội dung clinical
và tạo/sửa Treatment Plan. Khi Visit `COMPLETED`, nội dung đã có bị khóa, không
update/delete. Sửa sau hoàn tất chỉ bằng `TreatmentNote` dạng addendum, luôn có
author, thời điểm và tham chiếu Visit; addendum không ghi đè nội dung gốc.

Dentist được gán Appointment hiện tại có thể đọc lịch sử Visit/Treatment Plan
của Patient trong **cùng branch**, cùng tenant. Dentist không được gán không đọc
clinical record chỉ vì biết Patient/Visit ID; Dentist được gán ở branch khác
cũng không có quyền lịch sử branch này. PatientAlert là ngoại lệ an toàn nêu ở
mục 2.

## 4. Treatment Plan, item và follow-up

Treatment Plan thuộc một Visit và có nhiều TreatmentItem. Item snapshot Service
`id`, code, name, price/currency, quantity, discount, đơn giá cuối cùng, vị
trí/răng (FDI string hoặc mô tả) và chỉ định. Chỉ Service `ACTIVE` của tenant
được thêm mới; thay đổi catalog không hồi tố snapshot.

```text
DRAFT → PROPOSED → ACCEPTED → PARTIALLY_COMPLETED → COMPLETED
  │        │           │
  │        ├→ DRAFT   │  (REOPEN)
  └────────┴───────────→ CANCELLED
```

- Dentist chỉnh cấu trúc Plan/Item chỉ ở `DRAFT`.
- `PROPOSED` khóa Plan; Receptionist ghi nhận sự chấp thuận của bệnh nhân bằng
  actor và timestamp, rồi chuyển Plan sang `ACCEPTED`.
- Dentist muốn thay nội dung `PROPOSED` phải `REOPEN` về `DRAFT`, gửi reason
  code, xóa acceptance cũ và đề xuất/xác nhận lại. Không sửa trực tiếp Plan đã
  `PROPOSED` hoặc `ACCEPTED`.
- Item dùng vòng đời `PENDING → IN_PROGRESS → COMPLETED`; `PENDING` hoặc
  `IN_PROGRESS` có thể `CANCELLED` bởi Dentist theo reason code. Plan tự phản
  ánh `PARTIALLY_COMPLETED` khi có item completed và `COMPLETED` khi mọi item
  terminal với ít nhất một item completed. Plan `DRAFT`, `PROPOSED` hoặc
  `ACCEPTED` chỉ chuyển `CANCELLED` khi không còn item thực hiện và mọi nghĩa vụ
  invoice/payment liên quan đã được void hoặc bù trừ.

Dentist tạo `FollowUpRecommendation` từ Visit hoặc Treatment Plan với lý do và
mốc thời gian đề xuất. Recommendation không phải Appointment. Receptionist tạo
Appointment tái khám từ recommendation, lưu reference nguồn và đánh dấu
recommendation đã được schedule; không tự sao chép clinical content sang ghi
chú vận hành.

## 5. PatientInvoice, Payment và correction

PatientInvoice là ledger vận hành nội bộ của tenant/branch, không đi qua tài
khoản DentFlow. Nó chỉ nhận TreatmentItem của Plan `ACCEPTED`; item chưa cần
`COMPLETED` để được invoiced, hỗ trợ thu trước hoặc thu nhiều đợt.

- Một TreatmentItem thuộc tối đa một PatientInvoice **còn hiệu lực** (`DRAFT`,
  `ISSUED`, `PARTIALLY_PAID`, `PAID`). Void invoice giải phóng item để lập invoice
  mới sau khi mọi tiền đã được bù trừ.
- Một invoice chỉ có một currency; tất cả line phải cùng currency từ snapshot
  TreatmentItem. Invoice snapshot line, Patient, TreatmentItem, Service và số
  tiền; sửa catalog hoặc Plan không đổi invoice đã issue.
- Vòng đời invoice là `DRAFT → ISSUED → PARTIALLY_PAID → PAID`, hoặc `VOID` từ
  `DRAFT`/`ISSUED`. Invoice có net collected amount chỉ void sau khi các refund/
  adjustment cần thiết đã làm số đã thu ròng về 0.
- Payment collection là record bất biến, amount dương và method `CASH`,
  `BANK_TRANSFER`, `CARD` hoặc `OTHER`. Nhiều Payment hợp lệ cập nhật số đã thu
  và trạng thái invoice atomically dưới lock invoice.
- Refund và adjustment không update/delete Payment gốc. Chúng là record bù trừ
  mới có reference Payment gốc, amount/direction, actor, timestamp và reason
  code; số dư invoice tính theo net amount của mọi record. `BANK_TRANSFER` và
  `CARD` phải có transaction reference unique trong phạm vi tenant theo policy
  implementation.

Receptionist tạo invoice, collection và thực hiện thao tác quầy thường ngày.
Refund/adjustment là command kiểm soát tài chính riêng: V1 yêu cầu permission
`patient-payment.adjust` cho Branch Admin trong đúng branch. Permission này sẽ
được thêm vào fixed-role policy cùng module implementation; nó không cho phép
sửa record gốc.

## 6. API, authorization và error contract

Mọi API clinical dùng prefix branch-scoped sau; `tenantSlug` và `branchSlug` chỉ
đến từ URL và được resolve trước authorization. Client không gửi tenant/branch
ID/slug trong body để chọn scope.

```text
/tenants/:tenantSlug/branches/:branchSlug
```

| Capability | Contract route/command |
| --- | --- |
| Patient | `GET/POST /patients`, `GET/PATCH /patients/:patientId` cho `RECEPTIONIST` hoặc `BRANCH_ADMIN` có `patient.administrative.manage`; `POST`/`PATCH` cần `Idempotency-Key`. List phân trang tìm theo họ tên/số điện thoại và chỉ sort `fullName`, `dateOfBirth`, `createdAt`. `GET/POST /patients/:patientId/alerts` và `PATCH /patients/:patientId/alerts/:alertId` là module sau cho Dentist có case assignment. |
| Appointment | V1 backend hiện có `GET/POST /appointments`, `GET/PATCH /appointments/:appointmentId`, `POST .../:id/confirm`, `/check-in`, `/assign`, `/cancel`, `/no-show` và `GET /appointments/assigned` cho Dentist. List bắt buộc `from`/`to` tối đa 31 ngày, phân trang và lọc `status`, `patientId`, `dentistUserId`; Dentist chỉ thấy ca do chính mình được gán cùng dữ liệu schedule an toàn. `start`/`complete` bị hoãn đến module Visit để bảo đảm tạo Visit atomically. |
| Visit | `GET/PATCH /appointments/:appointmentId/visit`, `POST .../visit/complete`, `POST .../visit/addenda`. |
| Treatment | `GET/POST /visits/:visitId/treatment-plans`, `PATCH /treatment-plans/:planId` khi `DRAFT`, `POST .../propose`, `/reopen`, `/accept`, `/cancel`; item command `/start`, `/complete`, `/cancel`. |
| Financial | `GET/POST /patient-invoices`, `POST .../:invoiceId/issue`, `/void`, `/payments`, `/payments/:paymentId/refunds`, `/adjustments`. |
| Recall | `POST /visits/:visitId/follow-up-recommendations`, `POST /follow-up-recommendations/:recommendationId/schedule`. |

Mọi command, gồm create, update, state transition và financial correction, cần
`Idempotency-Key` theo [09-idempotency-implementation-plan.md](./09-idempotency-implementation-plan.md).
List API dùng pagination contract chung; detail/command response không trả
clinical content cho role không được phép.

`@TenantScope('branch')`, Subscription Guard, Branch Activity Guard và
Authorization Guard luôn chạy trước service. Service sau đó kiểm tra state và
case ownership. Thiếu JWT trả `401`; scope/role/case không hợp lệ trả `403`;
resource nằm ngoài context trả `404`; duplicate phone, conflict lịch, item đã
invoiced và transition không hợp lệ trả `409`; field không hợp lệ trả `422`.

| Actor | Quyền workflow |
| --- | --- |
| Receptionist | Patient hành chính, Appointment/create-confirm-check-in-cancel-no-show, accept Plan, create/issue Invoice và record Payment trong branch được gán. Không đọc/ghi alert, diagnosis hoặc note. |
| Branch Admin | Patient hành chính và điều phối Appointment, slot và Dentist assignment đến `CHECKED_IN`; refund/adjustment khi có `patient-payment.adjust`. Không ghi clinical content. |
| Dentist | Chỉ ca được gán: start/complete Appointment, Visit, PatientAlert, clinical note/addendum, Treatment Plan/Item và follow-up recommendation. |
| Tenant Admin | Không tự có clinical hoặc financial-operational access; chỉ có khi có thêm role branch-scoped tương ứng. |

## 7. Audit và acceptance contract

Các command mới phải chạy business write và AuditLog trong cùng transaction.
Khi module được triển khai, audit action registry được mở rộng tối thiểu với
`PATIENT_ALERT_CREATED`, `PATIENT_ALERT_UPDATED`,
`APPOINTMENT_UPDATED`, `APPOINTMENT_ASSIGNMENT_CHANGED`, `VISIT_OPENED`, `VISIT_COMPLETED`,
`TREATMENT_NOTE_ADDED`, `TREATMENT_PLAN_ACCEPTED`,
`TREATMENT_PLAN_REOPENED`, `FOLLOW_UP_RECOMMENDED` và
`FOLLOW_UP_SCHEDULED`. Action Invoice/Payment hiện có tiếp tục dùng cho issue,
void, collection, refund và adjustment.

Audit chỉ ghi resource IDs, state, timestamp, changed field names, safe
amount/currency/method/reference và reason code. Không ghi Patient identity,
phone, address, alert, diagnosis, note, tooth description hoặc clinical free
text. Clinical/financial command dùng reason code, không dùng free-text reason.

Implementation sau tài liệu này phải có synthetic E2E/API coverage cho:

1. tạo Patient và duplicate normalized phone trong cùng tenant;
2. chặn Patient/Appointment/Service/Dentist ID ngoài tenant hoặc branch;
3. branch inactive và user thiếu scope/permission;
4. check-in ca chưa gán, nhưng chặn start; chặn overlap Dentist và reassignment
   sau `IN_PROGRESS`;
5. Dentist không được gán không đọc clinical history/alert, còn Dentist được gán
   đọc history cùng branch và alert cần thiết;
6. Visit lock/addendum, Plan reopen và acceptance lại;
7. item đã invoice không lập invoice lần hai, partial payment, refund/adjustment
   immutable và void sau khi net collected bằng 0;
8. Dentist đề xuất và Receptionist schedule follow-up, có reference nguồn.

Không dùng dữ liệu bệnh nhân thật trong migration, seed, test, screenshot hoặc
log.
