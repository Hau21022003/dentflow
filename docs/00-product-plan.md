# DentFlow — Product Plan

## 1. Mục tiêu sản phẩm

DentFlow là nền tảng SaaS đa đơn vị dành cho chuỗi và phòng khám nha khoa. Nền tảng giúp chủ chuỗi kiểm soát hoạt động nhiều chi nhánh, trong khi nhân sự tại từng phòng khám vận hành trọn vẹn hành trình của bệnh nhân: từ tiếp nhận, đặt hẹn, khám, lập kế hoạch điều trị, thanh toán đến tái khám.

### Giá trị cần thể hiện trên CV

- Multi-tenant SaaS: nhiều nha khoa độc lập dùng chung một nền tảng nhưng dữ liệu bị cô lập tuyệt đối.
- Phân quyền theo tổ chức và chi nhánh, không chỉ theo một vai trò chung chung.
- Quy trình nghiệp vụ có trạng thái rõ ràng, lịch sử thay đổi và kiểm tra quyền ở phía API.
- Subscription, hoá đơn và webhook thanh toán theo mô hình SaaS.
- Giao diện vận hành thực tế, song ngữ Việt/Anh và dữ liệu demo có thể tự trải nghiệm.

## 2. Mô hình tổ chức và phân quyền

### Cấu trúc dữ liệu

```text
DentFlow Platform
├── Tenant: Nha khoa Tâm Anh
│   ├── Chi nhánh Quận 1
│   └── Chi nhánh Thủ Đức
└── Tenant: Nha khoa Hải Yến
    └── Chi nhánh Cầu Giấy
```

Mọi bản ghi nghiệp vụ mang `tenantId`; dữ liệu gắn với một phòng khám mang thêm `branchId`. API không được chấp nhận ID đơn lẻ như một cơ chế cấp quyền: luôn xác minh tenant và phạm vi chi nhánh từ phiên đăng nhập.

| Vai trò | Phạm vi | Quyền chính |
| --- | --- | --- |
| Platform Admin | Toàn nền tảng | Tenant, gói dịch vụ, subscription, hỗ trợ vận hành |
| Tenant Admin | Một tenant | Chi nhánh, nhân sự, cấu hình, báo cáo toàn chuỗi |
| Branch Admin | Chi nhánh được gán | Nhân sự, lịch hẹn, bệnh nhân, báo cáo chi nhánh |
| Receptionist | Chi nhánh được gán | Tiếp nhận, bệnh nhân, lịch hẹn, thanh toán, nhắc hẹn |
| Dentist | Chi nhánh được gán | Lịch của mình, khám, kế hoạch và ghi chú điều trị bệnh nhân được phân công |

Một người dùng có thể được cấp nhiều vai trò/phạm vi, ví dụ Tenant Admin đồng thời là Dentist tại một chi nhánh. Việc cấp hoặc thu hồi quyền phải được ghi vào audit log.

## 3. Quy trình nghiệp vụ nha khoa

### 3.1 Tiếp nhận và hồ sơ bệnh nhân

1. Lễ tân tìm kiếm theo số điện thoại để tránh tạo trùng hồ sơ trong cùng tenant.
2. Nếu là bệnh nhân mới, tạo hồ sơ với thông tin liên hệ, ngày sinh, giới tính, địa chỉ, người liên hệ khẩn cấp và nguồn biết đến phòng khám.
3. Bệnh nhân có thể có nhiều lần đến khám tại các chi nhánh khác nhau của cùng một tenant; lịch sử vẫn thống nhất ở cấp tenant.
4. Lễ tân ghi cảnh báo ngắn như dị ứng thuốc hoặc yêu cầu đặc biệt. Các nội dung khám chuyên môn chỉ bác sĩ/nhân sự được phép mới xem được.

### 3.2 Lịch hẹn và check-in

Lịch hẹn bao gồm bệnh nhân, chi nhánh, bác sĩ dự kiến, dịch vụ/lý do đến khám, khoảng thời gian, ghi chú và nguồn đặt hẹn. Hệ thống kiểm tra trùng lịch cho bác sĩ và ghế/phòng khám nếu đã cấu hình.

Vòng đời lịch hẹn:

```text
BOOKED → CONFIRMED → CHECKED_IN → IN_PROGRESS → COMPLETED
     └→ CANCELLED
     └→ NO_SHOW
```

- Lễ tân tạo, xác nhận, check-in, hủy và đánh dấu no-show.
- Bác sĩ bắt đầu và hoàn tất phiên khám của bệnh nhân được giao.
- Mỗi lần đổi trạng thái lưu thời gian, người thực hiện và lý do hủy/no-show nếu có.
- Dashboard hiển thị lịch hôm nay, tình trạng chờ, no-show và công suất bác sĩ.

### 3.3 Khám, chẩn đoán và kế hoạch điều trị

Sau khi bệnh nhân check-in, bác sĩ mở một **visit** gắn với lịch hẹn. Visit có triệu chứng, tiền sử liên quan, chẩn đoán, ghi chú lâm sàng và tệp đính kèm trong giai đoạn sau.

Bác sĩ tạo **treatment plan** gồm các hạng mục điều trị: dịch vụ, răng/vị trí (mã FDI hoặc mô tả), bác sĩ thực hiện, số lượng, đơn giá, giảm giá và ghi chú. Kế hoạch có trạng thái `DRAFT`, `PROPOSED`, `ACCEPTED`, `PARTIALLY_COMPLETED`, `COMPLETED`, `CANCELLED`.

- Bệnh nhân xác nhận kế hoạch tại quầy; lễ tân ghi lại người xác nhận và thời điểm.
- Mỗi hạng mục điều trị tiến triển độc lập: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- MVP chỉ cần chọn răng theo mã/mô tả. Odontogram trực quan là hạng mục nâng cao, không chặn luồng điều trị cơ bản.

### 3.4 Thanh toán và tái khám

DentFlow có **hai dòng tiền độc lập**: phí thuê bao SaaS mà tenant trả cho DentFlow, và chi phí điều trị mà bệnh nhân trả trực tiếp cho phòng khám. Chi tiết mô hình, trách nhiệm và roadmap được quy định tại [01-payment-model.md](./01-payment-model.md).

Từ hạng mục điều trị đã xác nhận, lễ tân lập invoice theo từng lần thanh toán hoặc một đợt điều trị. Invoice có dòng chi tiết, tổng tiền, giảm giá, số đã thu, số còn lại và phương thức thanh toán (`CASH`, `BANK_TRANSFER`, `CARD`, `OTHER`).

Vòng đời invoice: `DRAFT → ISSUED → PARTIALLY_PAID → PAID`, hoặc `VOID`. Không cho phép sửa các dòng tiền sau khi invoice đã có giao dịch thanh toán; thay vào đó lập điều chỉnh có audit log.

Khi kết thúc điều trị hoặc thu tiền, lễ tân/bác sĩ tạo lịch tái khám với lý do và khoảng thời gian gợi ý. Trong MVP, việc gửi nhắc hẹn được mô phỏng bằng hàng đợi/lịch sử thông báo; SMS/Zalo/email thật là giai đoạn nâng cao.

## 4. Phạm vi MVP bắt buộc

### Platform SaaS

- Platform Admin tạo/khoá tenant, tạo gói thuê bao và xem tổng quan tenant.
- Tenant có subscription `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `SUSPENDED` và ngày hết hạn.
- Tích hợp Stripe Test Mode cho **phí SaaS**: tạo checkout session, xác thực webhook signature, đồng bộ trạng thái subscription và invoice SaaS. Tiền điều trị của bệnh nhân chỉ được ghi nhận nội bộ trong MVP, không đi qua tài khoản DentFlow.
- Subscription không còn hiệu lực chỉ cho phép Tenant Admin xem thông tin billing; các tác vụ vận hành bị chặn bởi guard ở API.

### Vận hành phòng khám

- Quản lý chi nhánh, người dùng, vai trò và phạm vi chi nhánh.
- Danh mục dịch vụ: mã dịch vụ, tên, nhóm dịch vụ, giá niêm yết, thời lượng dự kiến, trạng thái hoạt động.
- Bệnh nhân, lịch hẹn, check-in, visit, kế hoạch điều trị và ghi chú điều trị.
- Invoice và payment nội bộ cho chi phí điều trị của bệnh nhân.
- Dashboard theo quyền: lịch hôm nay, số bệnh nhân, lịch hẹn theo trạng thái, doanh thu đã thu trong ngày và treatment plan đang mở.
- Audit log cho thay đổi quyền, chi nhánh, bệnh nhân, lịch hẹn, kế hoạch điều trị và billing SaaS.

### Trải nghiệm và kỹ thuật

- React + TypeScript frontend; NestJS REST API; PostgreSQL và TypeOrm.
- URL chứa `tenantSlug` (ví dụ `/t/tam-anh/dashboard`) cho ứng dụng demo. Có thể mở rộng sang subdomain khi deploy.
- JWT access token ngắn hạn kết hợp refresh token; mật khẩu được hash; các secrets chỉ nằm trong biến môi trường.
- i18n Việt/Anh, `Asia/Ho_Chi_Minh` là timezone mặc định và định dạng VND theo locale.
- Docker Compose cho API, frontend và PostgreSQL; seed tối thiểu hai tenant độc lập.

## 5. Dữ liệu lõi và quan hệ

| Nhóm | Entity chính | Ghi chú |
| --- | --- | --- |
| SaaS | Tenant, Plan, Subscription, SaaSInvoice | Quản lý khách hàng của DentFlow |
| Tổ chức | Branch, User, RoleAssignment | RoleAssignment có phạm vi branch tùy chọn |
| Xác thực | User, AuthSession, TotpFactor, PasskeyCredential | User là identity toàn hệ thống; session theo từng thiết bị, TOTP secret và refresh token chỉ lưu dạng mã hóa/hash |
| Danh mục | Service | Giá và thời lượng phục vụ điều trị/lịch hẹn |
| Bệnh nhân | Patient, PatientAlert | Patient thuộc tenant, không bị giới hạn một branch |
| Điều phối | Appointment, Visit | Appointment thuộc branch; Visit được tạo từ appointment |
| Điều trị | TreatmentPlan, TreatmentItem, TreatmentNote | Bác sĩ được gán và lịch sử thực hiện |
| Thu phí | PatientInvoice, PatientInvoiceItem, Payment | Tách biệt với hóa đơn SaaS của tenant |
| Tuân thủ | AuditLog | Ai làm gì, trên bản ghi nào, khi nào |

## 6. API và nguyên tắc bảo mật

Các API được tổ chức theo tiền tố `/api/v1`. Tenant context lấy từ `tenantSlug` trong route/header đã được xác minh với session; không tin tưởng tenant ID do client tự gửi.

- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
- `GET/POST /tenants`, `GET/PATCH /tenants/:id`: chỉ Platform Admin.
- `GET/POST /branches`, `GET/POST /users`, `POST /role-assignments`: Tenant/Branch Admin theo phạm vi.
- `GET/POST /patients`, `GET/POST /appointments`, `POST /appointments/:id/check-in`, `POST /appointments/:id/start`, `POST /appointments/:id/complete`.
- `GET/POST /visits`, `GET/POST /treatment-plans`, `POST /treatment-items/:id/complete`.
- `GET/POST /patient-invoices`, `POST /patient-invoices/:id/payments`.
- `POST /billing/checkout-session`, `POST /billing/webhook`; webhook không dùng JWT mà xác minh chữ ký Stripe.

Mọi endpoint nghiệp vụ phải áp dụng theo thứ tự: xác thực → lấy tenant context → kiểm tra subscription → kiểm tra role/phạm vi branch → truy vấn có điều kiện `tenantId`/`branchId`.

## 7. Kiểm thử và demo bắt buộc

- E2E test: Platform Admin tạo tenant → Tenant Admin tạo chi nhánh và nhân sự → lễ tân tạo bệnh nhân/lịch hẹn → check-in → bác sĩ ghi visit/kế hoạch điều trị → thu tiền → tạo tái khám.
- E2E Stripe Test Mode: checkout thành công và webhook chuyển tenant sang `ACTIVE`; thử `PAST_DUE`/`CANCELED` để kiểm tra API vận hành bị chặn.
- Seed data và tài khoản demo có phân quyền khác nhau; README mô tả kiến trúc, ERD, biến môi trường, cách chạy Docker và các luồng demo.

## 8. Roadmap sau MVP

1. Odontogram tương tác, ảnh X-quang/tệp điều trị và mẫu phiếu điều trị.
2. Nhắc hẹn SMS, Zalo OA hoặc email; chiến dịch gọi lại bệnh nhân không tái khám.
3. Kho vật tư, nhà cung cấp, tiêu hao theo hạng mục điều trị.
4. Báo cáo doanh thu/công nợ nâng cao, KPI bác sĩ, công suất ghế và export kế toán.
5. Patient portal cho tự đặt hẹn, xem kế hoạch điều trị và lịch sử thanh toán.
6. Hoàn thiện luồng đăng ký/xác thực 2FA (TOTP và passkey), chính sách lưu trữ dữ liệu, consent và các kiểm soát tuân thủ phù hợp trước khi dùng dữ liệu thật. Persistence cho TOTP, passkey và session đa thiết bị đã được chuẩn bị, nhưng chưa có endpoint xác thực trong giai đoạn này.
