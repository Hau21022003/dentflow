# DentFlow — Platform Admin Operations

## 1. Mục đích và ranh giới

Platform Admin vận hành DentFlow với tư cách nhà cung cấp SaaS. Vai trò này quản lý vòng đời tenant, plan, subscription, hoá đơn SaaS, hỗ trợ vận hành và sức khỏe hệ thống. Đây không phải là quản trị viên của một phòng khám.

Platform Admin không quản lý lịch hẹn, visit, treatment plan, `PatientInvoice` hay `Payment` điều trị của tenant. Hai dòng tiền được định nghĩa tại [01-payment-model.md](./01-payment-model.md).

## 2. Quyền Platform Admin trong MVP

MVP dùng một role `PLATFORM_ADMIN` duy nhất; tài khoản được provision nội bộ, không có public registration. Các role vận hành hẹp hơn như Billing Operator, Support Agent và Read-only Analyst là roadmap sau MVP.

| Năng lực | Được phép | Bị cấm / giới hạn |
| --- | --- | --- |
| Tenant | Tạo, xem, cập nhật thông tin SaaS, khóa/mở khóa, gia hạn trial | Không sửa dữ liệu lâm sàng hoặc tài chính điều trị |
| Plan | Tạo, ẩn/kích hoạt lại plan; thay đổi metadata plan chưa từng được dùng | `code` bất biến; plan đã có subscription history chỉ đổi availability, không đổi giá/quyền hồi tố |
| SaaS billing | Xem subscription/invoice/event; mở Stripe dashboard/link; ghi nhận chuyển khoản qua luồng kiểm soát | Không đánh dấu giao dịch Stripe là paid bằng thao tác thủ công |
| Support | Gửi lại lời mời, yêu cầu reset Tenant Admin, xem audit log SaaS | Không support access âm thầm, không xem dữ liệu nhạy cảm mặc định |
| System | Xem webhook failures, job failures và feature flags | Không chỉnh sửa dữ liệu production trực tiếp qua database |

Mọi tác vụ ghi dữ liệu của Platform Admin tạo `AuditLog` với actor, action, resource type/ID, timestamp, request ID, giá trị trước/sau phù hợp và lý do khi thao tác có ảnh hưởng quyền truy cập.

## 3. Tenant lifecycle

### Trạng thái tenant

| Trạng thái | Ý nghĩa | Hành vi |
| --- | --- | --- |
| `PROVISIONING` | Đang tạo tenant và owner | Chưa đăng nhập được |
| `TRIAL` | Dùng thử hợp lệ | Dùng theo plan trial |
| `ACTIVE` | Có subscription SaaS hợp lệ | Dùng đầy đủ theo entitlements |
| `PAST_DUE` | Thanh toán SaaS thất bại | Cảnh báo, áp dụng grace period |
| `SUSPENDED` | Bị khóa bởi chính sách hoặc hết grace period | Chỉ Tenant Admin vào Billing/export theo chính sách |
| `CANCELED` | Tenant đã hủy và hết kỳ trả tiền | Read-only/Billing theo retention policy |

`Tenant.status` là trạng thái quyền truy cập cấp tổ chức. `Subscription.status` lưu trạng thái đồng bộ từ Stripe. Chỉ một service tổng hợp xác định transition của `Tenant.status`; controller không tự cập nhật trực tiếp từ input client.

### Tạo tenant

1. Platform Admin chọn **Create tenant**.
2. Nhập tên pháp lý, display name, slug duy nhất, billing email, tên/email Tenant Admin đầu tiên, timezone và locale mặc định.
3. Chọn plan trial và ngày hết hạn trial. Hệ thống kiểm tra `slug` chưa tồn tại và email owner hợp lệ.
4. Backend tạo transaction gồm `Tenant(PROVISIONING)`, `Subscription(TRIAL)`, cấu hình mặc định và lời mời Tenant Admin.
5. Sau khi transaction thành công, tenant chuyển `TRIAL`; email invitation được enqueue. Nếu enqueue thất bại, tenant vẫn tồn tại và Platform Admin có thể resend invitation.
6. Tenant Admin nhận lời mời, tạo password và thiết lập chi nhánh đầu tiên. Không tự kích hoạt `ACTIVE` nếu chưa có thanh toán SaaS/trial hợp lệ.

### Đình chỉ, gia hạn và hủy

- **Extend trial**: Platform Admin nhập số ngày và lý do; chỉ thực hiện khi tenant đang `TRIAL` hoặc `PAST_DUE`; toàn bộ thay đổi được audit.
- **Suspend**: Platform Admin chọn lý do; quyền vận hành bị Subscription Guard chặn ngay sau khi chuyển trạng thái. Không xóa dữ liệu.
- **Reactivate**: chỉ khi có quyền Platform Admin và subscription đủ điều kiện; nếu do Stripe billing, ưu tiên webhook `invoice.paid` để tự kích hoạt.
- **Cancel**: thực hiện tại Stripe Customer Portal bởi Tenant Admin hoặc Stripe Dashboard theo quy trình support. Hệ thống đồng bộ kết quả từ webhook; giữ dữ liệu theo retention policy, không xóa trong MVP.

## 4. Luồng SaaS billing và công nợ

Chi tiết provider, webhook và entity được quy định tại [01-payment-model.md](./01-payment-model.md). Platform Admin chỉ quan sát và hỗ trợ các luồng tự động của Stripe.

```text
Tenant Admin chọn plan
  → Stripe Checkout
  → Stripe webhook xác thực
  → Subscription + SaaSInvoice cập nhật
  → Tenant ACTIVE hoặc PAST_DUE
  → Subscription Guard áp dụng quyền truy cập
```

### Thanh toán Stripe

- Platform Admin xem danh sách subscription, invoice SaaS, trạng thái webhook và link provider theo tenant.
- `invoice.paid` chuyển tenant sang `ACTIVE` nếu không bị khóa quản trị.
- `invoice.payment_failed` chuyển subscription sang `PAST_DUE`, thiết lập/kiểm tra grace period và tạo thông báo cho Tenant Admin.
- Platform Admin được retry/replay **xử lý nội bộ** một webhook đã lưu khi lỗi tạm thời; không giả lập event hoặc bỏ qua xác minh signature.

### Thanh toán chuyển khoản B2B (roadmap gần)

Nếu bán cho doanh nghiệp có nhu cầu chuyển khoản, tạo `ManualSaaSPayment` tách khỏi Stripe với invoice, amount, reference, chứng từ, người đối soát và thời điểm xác nhận. Việc xác nhận đòi hỏi mã tham chiếu khớp và audit log. Luồng này không dùng để sửa một Stripe invoice đã thanh toán/thất bại.

## 5. Màn hình và hành động

| Route | Nội dung | Hành động chính |
| --- | --- | --- |
| `/platform/dashboard` | Active/trial/past-due, MRR demo, trial sắp hết, payment failure và webhook lỗi gần nhất | Đi tới tenant/invoice cần xử lý |
| `/platform/tenants` | Tìm kiếm, lọc trạng thái/plan/hạn dùng, usage tóm tắt | Tạo tenant, mở chi tiết |
| `/platform/tenants/:id` | Profile SaaS, subscription, usage, owner, chi nhánh/user count, audit log | Resend invite, extend trial, suspend/reactivate |
| `/platform/plans` | Danh mục plan, giá, billing cycle, entitlement và availability | Tạo/ẩn plan mới |
| `/platform/billing/invoices` | Invoice SaaS, trạng thái provider, failure reason | Mở hosted invoice/Stripe dashboard |
| `/platform/billing/webhook-events` | Provider event ID, loại, trạng thái xử lý, lỗi | Retry xử lý nội bộ theo quyền |
| `/platform/audit-logs` | Nhật ký Platform Admin và tenant lifecycle | Lọc, xem chi tiết |

Dashboard sử dụng số liệu SaaS tổng hợp. Không hiển thị chi tiết bệnh nhân hay doanh thu điều trị giữa các tenant. Chỉ hiển thị usage phi lâm sàng như số branch/user nếu plan cần quota.

## 6. Support access và bảo vệ dữ liệu

MVP không có impersonation. Hỗ trợ được thực hiện qua audit log, cấu hình subscription, resend invitation và reset credential theo quy trình an toàn.

Nếu thêm support access sau này, phải yêu cầu một trong hai điều kiện: Tenant Admin cấp consent có thời hạn hoặc Platform Admin nhập incident reason theo policy. Phiên truy cập phải read-only mặc định, có banner rõ ràng, scope tenant/branch giới hạn, thời hạn tự hết và audit mọi hành động. Clinical notes, patient alerts và thông tin nhạy cảm bị loại trừ mặc định.

## 7. API contract định hướng

Các endpoint nội bộ dưới `/platform/*` yêu cầu `PLATFORM_ADMIN`. Tài liệu này không ghi API prefix/version công khai vì chúng do Nginx/gateway quản lý khi deploy. API không nhận `tenantId` như một tín hiệu cấp quyền từ client; ID chỉ là resource được role Platform Admin tra cứu.

- `GET /platform/dashboard`
- `GET/POST /platform/tenants`
- `GET/PATCH /platform/tenants/:tenantId`
- `POST /platform/tenants/:tenantId/resend-owner-invite`
- `POST /platform/tenants/:tenantId/extend-trial`
- `POST /platform/tenants/:tenantId/suspend`
- `POST /platform/tenants/:tenantId/reactivate`
- `GET/POST /platform/plans`, `PATCH /platform/plans/:planId`
- `GET /platform/billing/invoices`, `GET /platform/billing/webhook-events`
- `POST /platform/billing/webhook-events/:eventId/retry`
- `GET /platform/audit-logs`, `GET /platform/audit-logs/:id`: chỉ trả audit domain Platform/Security; không trả clinical hay payment điều trị của tenant.

Các command tenant lifecycle cần body gồm `reason` (bắt buộc với suspend/extend/reactivate thủ công) và `idempotencyKey`. Endpoint retry chỉ chạy lại business processing đã lưu, không gọi provider để tạo giao dịch mới.

Plan catalog chỉ dành cho Platform Admin. `GET /platform/plans` trả cả plan active và inactive; `POST` luôn tạo plan active; `PATCH` không nhận đổi `code` và chỉ thay toàn bộ object `entitlements` khi field này được gửi. Thay đổi `isActive` cần `reason`; lệnh lặp lại trạng thái hiện có không tạo audit mới. Catalog chưa có idempotency persistence riêng: `code` và provider plan ID được unique. Plan từng được subscription tham chiếu chỉ được đổi `isActive`.

## 8. Acceptance criteria và test

- Platform Admin tạo tenant trial, lời mời owner và subscription trial trong một transaction; slug trùng bị từ chối.
- Tenant Admin không gọi được `/platform/*`; Platform Admin không gọi được API tạo/sửa `PatientInvoice` hoặc `Payment` điều trị chỉ vì có quyền platform.
- `invoice.paid` chỉ kích hoạt đúng tenant liên kết; payment failed chỉ chuyển tenant đó sang `PAST_DUE`.
- Hết grace period, tenant bị `SUSPENDED`: API vận hành trả lỗi rõ ràng, Tenant Admin vẫn truy cập Billing theo policy.
- Suspend/reactivate/extend trial/resend invitation đều tạo audit log với actor và reason.
- Webhook event xử lý lặp không tạo invoice/subscription transition lặp; retry sự kiện lỗi không tạo Checkout Session hoặc Stripe charge mới.
- Dashboard không trả patient data hoặc treatment revenue trong payload của Platform API.

## 9. Ngoài phạm vi MVP

- Phân tách nhiều vai trò vận hành Platform như Finance, Support và Analyst.
- CRM sales lead, quote, contract và renewal pipeline cho DentFlow.
- Self-service onboarding hoàn toàn tự động từ landing page.
- Feature flags theo tenant và quota enforcement chi tiết.
- Marketplace, payout hoặc thu hộ tiền điều trị.
