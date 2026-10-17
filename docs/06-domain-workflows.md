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

V1 có bộ chọn mã răng FDI trực quan trong lúc chỉnh Treatment Plan `DRAFT`,
nhưng không có hồ sơ odontogram theo Patient hoặc trạng thái lâm sàng riêng cho
từng răng. V1 cũng chưa có attachment Patient/Visit, `DENTAL_ASSISTANT`,
kho/vật tư/labo, payment online cho bệnh nhân hay passkey.
Ảnh upload hiện có chỉ là object tạm; không được gắn vào clinical record cho đến
khi có contract attachment riêng.

## 2. Ownership, tenant isolation và dữ liệu nhạy cảm

| Entity | Ownership | Quy tắc bắt buộc |
| --- | --- | --- |
| `Patient` | Tenant | Mang `tenantId`, mã hiển thị tuần tự bất biến `PAT-*`, email optional/non-unique; `phoneNormalized` unique trong tenant. |
| `PatientAlert` | Tenant clinical | Thuộc Patient; Overview cho Receptionist/Branch Admin đọc alert đang hiệu lực tenant-wide. Chỉ Dentist có ca chưa terminal được phân công tại branch hiện tại được xem lịch sử, tạo, sửa hoặc resolve; không hard-delete/reopen. |
| `Operatory` | Tenant + branch | Đại diện thống nhất cho một phòng hoặc ghế; code bất biến, code/name unique trong branch và có lifecycle active/inactive. |
| `Appointment`, `Visit`, `TreatmentPlan`, `TreatmentItem`, `TreatmentNote`, `PatientInvoice`, `Payment`, `FollowUpRecommendation` | Tenant + branch | Mọi query/write mang cả `tenantId` và `branchId` đã resolve từ route context. |

`PatientAlert` lưu `updatedByUserId` do server lấy từ actor đã xác thực. Trường
này được cập nhật khi tạo, khi nội dung thực sự thay đổi hoặc khi resolve; no-op
update không đổi actor. Response alert trả `updatedBy: { id, fullName }` để UI
hiển thị người cập nhật gần nhất, nhưng không đưa message hay tên bệnh nhân vào
audit payload.

`Patient` được truy cập qua route branch-scoped dù bản ghi thuộc tenant. Cách
này cho phép Receptionist hoặc Branch Admin tại branch đã được cấp quyền tìm
Patient trên toàn tenant để tránh tạo trùng, nhưng không biến một route
tenant-wide thành quyền cho mọi user. Route global `/patients` chỉ là
placeholder UI hiện tại, không phải contract API hoặc route sản phẩm sau khi
module được triển khai.

Thông tin hành chính của Patient gồm họ tên, số liên lạc, email optional/non-unique, ngày sinh, giới tính,
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
phải concurrency-safe ở service/database, không chỉ cảnh báo UI. Appointment có tối đa một Operatory; backend xác minh Operatory active cùng tenant/branch khi gán và exclusion constraint riêng chặn giao thời gian ở `BOOKED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`. Dentist conflict và Operatory conflict trả `409` độc lập; không có override.

Form tạo/sửa lịch nhận một ngày hẹn và hai mốc giờ theo bước 15 phút, mặc định
đề xuất giờ kết thúc sau giờ bắt đầu 30 phút nhưng cho phép người dùng đổi. Client
ghép các giá trị này theo timezone đã resolve của branch để tiếp tục gửi/lưu
`startAt` và `endAt` dạng datetime. `GET /appointments/availability` cho phép UI
cảnh báo sớm xung đột Dentist/Operatory; kết quả này chỉ mang tính advisory,
không thay thế exclusion constraint khi command được ghi.

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

Riêng Patient Details dành cho actor có `patient.clinical.read`,
`GET /patients/:patientId/visits` trả danh sách Visit read-only trong branch đã
xác minh, gồm diagnosis nguyên bản hoặc `null`. Quyền này không mở full Visit,
triệu chứng, khám, clinical note, addendum hoặc các command của Dentist Visit
Workspace.

## 4. Treatment Plan, item và follow-up

Treatment Plan thuộc Patient + Tenant + Branch, có mã hiển thị tuần tự bất biến `TP-*` và nhiều TreatmentItem; `originVisitId` chỉ là Visit đã khởi tạo, bất biến nhưng không giới hạn Visit thực hiện sau đó. Mọi thao tác Dentist resolve một current Visit `OPEN` có Appointment `IN_PROGRESS` cùng Patient/Branch và Dentist được gán. Item snapshot Service `id`, code, name, price/currency, quantity, discount, đơn giá cuối cùng, vị trí/răng (FDI string hoặc mô tả), chỉ định và bác sĩ dự kiến. UI Draft có thể tạo chuỗi FDI này bằng bộ chọn răng vĩnh viễn/răng sữa, nhưng không tạo entity hoặc trạng thái odontogram riêng. Chỉ Service `ACTIVE` của tenant và Dentist có grant active cùng branch được thêm/sửa ở Draft; thay đổi catalog hoặc grant sau đó không hồi tố snapshot.

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
- Event Item là append-only và luôn giữ current Visit cùng Dentist thực hiện. `IN_PROGRESS` đầu tiên chuyển Item từ `PENDING`, event `IN_PROGRESS` tiếp theo chỉ ghi thêm buổi điều trị; `COMPLETED` chỉ từ `IN_PROGRESS`; `CANCELLED` từ `PENDING`/`IN_PROGRESS` cần reason code. Plan tự phản ánh `PARTIALLY_COMPLETED` khi có item completed nhưng chưa terminal toàn bộ, `COMPLETED` khi mọi item terminal với ít nhất một completed, và derived `CANCELLED` khi mọi item cancelled. Direct cancel chỉ từ `DRAFT`/`PROPOSED`/`ACCEPTED`, khi chưa có event; nó bulk-cancel item `PENDING`. V1 chưa có financial module nên không giả lập invoice/payment check.

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
| Patient | Administrative API trả thêm email và response-only `code`. `GET /patients/:patientId/overview` cần đồng thời `patient.administrative.manage` + `patient.clinical.read`, trả derived activity status, active alerts, next appointment và treatment aggregate/featured plan trong branch. `GET /patients/:patientId/appointments` cần `appointment.manage`, do `PatientAppointmentsService` truy vấn trực tiếp `Repository<Appointment>` với tenant + branch đã xác minh và Patient từ path; endpoint không lookup Patient riêng để Patient không tồn tại/ngoài scope và Patient không có lịch ở branch hiện tại cùng trả trang rỗng. Query hỗ trợ pagination (mặc định 10, tối đa 100), search snapshot dịch vụ/lý do khám/bác sĩ/phòng ghế/ghi chú, lọc `status`, `dentistUserId`, cặp ISO `from`/`to` tùy chọn theo điều kiện giao nhau, và chỉ sort `startAt`; mặc định `startAt DESC, id DESC`. Response là read model lịch hẹn không lặp lại Patient. `GET /patients/:patientId/treatment-plans` và `GET /patients/:patientId/treatment-plans/:planId` cùng cần cặp quyền của Overview và chỉ đọc Plan trong branch đã xác minh. List có pagination mặc định 20/tối đa 100, search mã Plan và snapshot Item, lọc `status`/`dentistUserId`, chỉ sort `createdAt`, không có lọc thời gian; response trả Visit khởi tạo, Item đại diện, bác sĩ dự kiến, tiến độ và tổng giá snapshot nhóm theo currency. Tổng giá kế hoạch không phải invoice, số dư hay khoản đã thu. Alert commands gồm list/create/update/resolve, cần `patient-alert.manage`, case assignment và idempotency; audit không ghi message. Administrative list/assigned list tiếp tục dùng pagination, scope và dữ liệu tối thiểu như trên. |
| Operatory | Operatory thuộc một trong hai loại bắt buộc `ROOM` hoặc `CHAIR`. `GET/POST/PATCH /operatories`, `POST /operatories/:id/activate` và `/deactivate` yêu cầu `operatory.manage`; create nhận `code`, `name`, `type`, còn update cho phép đổi `name` và `type` nhưng không đổi `code`. Lifecycle cần reason. Deactivate trả `409` nếu còn lịch chưa terminal. List hỗ trợ tìm theo code/tên, lọc active và sort theo code, tên, loại, trạng thái hoặc ngày tạo. `GET /appointments/booking-options/operatories` dùng `appointment.manage` và chỉ trả Operatory active. |
| Appointment | V1 backend hiện có `GET/POST /appointments`, `GET /appointments/calendar-summary?month=YYYY-MM`, `GET /appointments/availability?startAt&endAt&dentistUserId?&operatoryId?&excludeAppointmentId?`, `GET/PATCH /appointments/:appointmentId`, `POST .../:id/confirm`, `/check-in`, `/assign`, `/cancel`, `/no-show`, `GET /appointments/assigned` và `GET /appointments/assigned/calendar-summary?month=YYYY-MM` cho Dentist. Availability yêu cầu `appointment.manage`, scope theo tenant/branch đã xác minh và chỉ trả `dentistConflict`/`operatoryConflict`; `excludeAppointmentId` hỗ trợ kiểm tra lúc sửa. `GET /appointments/booking-options/dentists` và `/booking-options/services` cấp cho `appointment.manage` **hoặc** `treatment-plan.write`; chúng chỉ dùng làm picker read-only, phân trang/tìm kiếm server-side và chỉ trả Dentist active trong branch hoặc Service active trong tenant với trường tối thiểu. Dentist option trả `id`, `fullName` và `avatarUrl` signed ngắn hạn hoặc `null`; không trả email hay object key. List bắt buộc `from`/`to` tối đa 31 ngày, phân trang, lọc `status`, `patientId`, `dentistUserId`, và `search` theo họ tên/số điện thoại Patient trong đúng branch scope. `GET /appointments/:appointmentId` chỉ cấp cho `appointment.manage`; ngoài Patient `id`, họ tên và số điện thoại của Appointment response, detail trả thêm giới tính và ngày sinh hành chính để UI tính tuổi. Nó không trả `phoneNormalized`, địa chỉ, contact khẩn cấp, referral source hoặc dữ liệu clinical. Calendar summary quản trị chỉ cấp cho `appointment.manage`, nhận một tháng, dùng timezone hiệu lực đã resolve trong branch authorization context, và chỉ trả tổng số theo ngày bắt đầu cùng số lượng theo trạng thái; không trả Patient hay chi tiết Appointment. Hai endpoint `assigned` yêu cầu `appointment.assigned.read`, luôn lọc theo actor Dentist và branch đã xác minh; list trả `Patient.id`, mã hiển thị, họ tên, số điện thoại, giới tính, ngày sinh cùng dữ liệu lịch an toàn nhưng không trả địa chỉ, email hoặc contact khẩn cấp, còn monthly summary không trả Patient/chi tiết Appointment. `POST /appointments/:appointmentId/start` chỉ cấp cho Dentist được gán; nó lock Appointment `CHECKED_IN`, tạo Visit duy nhất và chuyển Appointment sang `IN_PROGRESS` trong cùng transaction. |
| Visit | Đã rollout: `GET /patients/:patientId/visits` cần `patient.clinical.read`, xác minh Patient trong tenant rồi scope mọi item/count/summary/filter option bằng tenant + branch + Patient. Endpoint chỉ trả read model lịch sử gồm trạng thái, timestamp thực tế lấy từ Appointment transition, Dentist, Operatory lịch sử và diagnosis nguyên bản; hỗ trợ pagination, `OPEN`/`COMPLETED`, Dentist, khoảng `startedAt` và ASC/DESC. Summary và Dentist options không chịu filter; endpoint không cấp full Visit/addenda và không có Create Visit. Dentist workspace tiếp tục dùng `GET/PATCH /appointments/:appointmentId/visit`, `POST .../visit/complete`, `POST .../visit/addenda`; tất cả command cần `Idempotency-Key` và chỉ Dentist được gán của Appointment truy cập. Visit chứa `symptoms`, `relevantHistory`, `examination`, `diagnosis` và `clinicalNote`; các trường nullable khi `OPEN`, nhưng complete yêu cầu ít nhất một trường có nội dung. Complete atomically khóa Visit và chuyển Appointment sang `COMPLETED`; addendum là `TreatmentNote` append-only chỉ được tạo sau complete. |
| Treatment | Dentist: `GET/POST /visits/:visitId/treatment-plans`, `GET/PATCH /visits/:visitId/treatment-plans/:planId`, `POST .../propose`, `/reopen`, `/cancel`, cùng `GET/POST .../items/:itemId/events`. List Visit-scoped vẫn resolve Patient từ ca được gán trong tenant/branch đã xác minh, trả mọi Plan của Patient tại branch để tiếp tục qua Visit sau, hỗ trợ pagination, search mã Plan/snapshot Item và lọc `status`; mỗi item danh sách trả thêm các bác sĩ dự kiến duy nhất để hiển thị nhưng tổng giá snapshot phía client chỉ là chi phí dự kiến, không phải invoice/số dư/thanh toán. Các command dùng `Idempotency-Key`; event body chỉ nhận event type và reason code khi cancel. Receptionist có riêng `POST /treatment-plans/:planId/accept`, chỉ trả receipt không clinical detail. |
| Financial | `GET/POST /patient-invoices`, `POST .../:invoiceId/issue`, `/void`, `/payments`, `/payments/:paymentId/refunds`, `/adjustments`. |
| Recall | `POST /visits/:visitId/follow-up-recommendations`, `POST /follow-up-recommendations/:recommendationId/schedule`. |

Mọi command, gồm create, update, state transition và financial correction, cần
`Idempotency-Key` theo [09-idempotency-implementation-plan.md](./09-idempotency-implementation-plan.md).
List API dùng pagination contract chung; detail/command response không trả
clinical content cho role không được phép.

Authorization snapshot trả `branch.timezone` là timezone vận hành **đã resolve**:
timezone override của branch, hoặc `tenant.defaultTimezone` khi branch không có
override. Frontend phải dùng giá trị này khi tạo `from`/`to`, nhập và hiển thị
`timestamptz` của Appointment hoặc Visit; không dùng timezone của thiết bị để suy ra giờ
vận hành của chi nhánh.

`@TenantScope('branch')`, Subscription Guard, Branch Activity Guard và
Authorization Guard luôn chạy trước service. Service sau đó kiểm tra state và
case ownership. Thiếu JWT trả `401`; scope/role/case không hợp lệ trả `403`;
resource nằm ngoài context trả `404`; duplicate phone, conflict lịch, item đã
invoiced và transition không hợp lệ trả `409`; field không hợp lệ trả `422`.

| Actor | Quyền workflow |
| --- | --- |
| Receptionist | Patient hành chính + Overview clinical read-only cùng branch, active alert tenant-wide, Appointment/Operatory picker và acceptance/payment workflow. Được đọc danh sách Visit cùng diagnosis và hồ sơ Treatment Plan read-only tại branch bằng cặp quyền Patient, nhưng không mở full Visit/addenda hoặc ghi clinical content. |
| Branch Admin | Patient Overview, danh sách Visit/diagnosis và hồ sơ Treatment Plan cùng branch read-only, quản lý Operatory và điều phối Appointment/Dentist đến `CHECKED_IN`; không mở full Visit/addenda hoặc ghi clinical content. |
| Dentist | Chỉ ca được gán: start/complete Appointment, Visit, PatientAlert, clinical note/addendum, Treatment Plan/Item và follow-up recommendation. |
| Tenant Admin | Không tự có clinical hoặc financial-operational access; chỉ có khi có thêm role branch-scoped tương ứng. |

## 7. Audit và acceptance contract

Receptionist có `treatment-plan.accept` trong branch đã xác minh có thể đọc
`GET /tenants/:tenantSlug/branches/:branchSlug/treatment-plan-acceptances`.
Queue chỉ có Plan ID, `patient.fullName`, `patient.phone`, trạng thái `PROPOSED`,
`createdAt` và `updatedAt`, theo pagination chuẩn; queue và acceptance command
không được nhúng Item, Service, giá, quantity, discount, tooth position,
indication, planned dentist, diagnosis, clinical note hoặc snapshot clinical.
Quyền `treatment-plan.accept` riêng lẻ không cấp list/detail clinical; việc đọc
Plan trong hồ sơ Patient là capability khác, cần đồng thời
`patient.administrative.manage` + `patient.clinical.read`. `POST .../treatment-plans/:planId/accept` vẫn idempotent, chỉ chuyển
`PROPOSED` sang `ACCEPTED` và chỉ trả receipt redacted gồm Plan ID, state, actor,
timestamp. Tenant/branch luôn được resolve từ verified route context.

Các command mới phải chạy business write và AuditLog trong cùng transaction.
Khi module được triển khai, audit action registry được mở rộng tối thiểu với
`PATIENT_ALERT_CREATED`, `PATIENT_ALERT_UPDATED`,
`APPOINTMENT_UPDATED`, `APPOINTMENT_ASSIGNMENT_CHANGED`, `VISIT_OPENED`, `VISIT_UPDATED`, `VISIT_COMPLETED`,
`TREATMENT_NOTE_ADDED`, `TREATMENT_PLAN_ACCEPTED`,
`TREATMENT_PLAN_REOPENED`, `TREATMENT_ITEM_EVENT_RECORDED`, `FOLLOW_UP_RECOMMENDED` và
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
