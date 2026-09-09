# DentFlow — Platform Admin Operations

## 1. Mục đích và ranh giới

Platform Admin vận hành DentFlow với tư cách nhà cung cấp SaaS. Vai trò này quản lý vòng đời tenant, plan, subscription, hoá đơn SaaS, hỗ trợ vận hành và sức khỏe hệ thống. Đây không phải là quản trị viên của một phòng khám.

Platform Admin không quản lý lịch hẹn, visit, treatment plan, `PatientInvoice` hay `Payment` điều trị của tenant. Hai dòng tiền được định nghĩa tại [01-payment-model.md](./01-payment-model.md).

## 2. Quyền Platform Admin trong MVP

MVP dùng một role `PLATFORM_ADMIN` duy nhất; tài khoản được provision nội bộ, không có public registration. Các role vận hành hẹp hơn như Billing Operator, Support Agent và Read-only Analyst là roadmap sau MVP.

| Năng lực     | Được phép                                                                                           | Bị cấm / giới hạn                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Tenant       | Tạo, xem, cập nhật thông tin SaaS, khóa/mở khóa, gia hạn trial                                      | Không sửa dữ liệu lâm sàng hoặc tài chính điều trị                                                |
| Plan         | Tạo, ẩn/kích hoạt lại plan; thay đổi metadata plan chưa từng được dùng                              | `code` bất biến; plan đã có subscription history chỉ đổi availability, không đổi giá/quyền hồi tố |
| SaaS billing | Xem subscription/invoice/event; mở Stripe dashboard/link; ghi nhận chuyển khoản qua luồng kiểm soát | Không đánh dấu giao dịch Stripe là paid bằng thao tác thủ công                                    |
| Support      | Gửi lại lời mời, yêu cầu reset Tenant Admin, xem audit log SaaS                                     | Không support access âm thầm, không xem dữ liệu nhạy cảm mặc định                                 |
| Email template | Xem, lưu draft và publish template email hệ thống toàn cục                                          | Không chỉnh template theo tenant, không tạo key email tự do hoặc gửi email preview                |
| System       | Xem webhook failures, job failures và feature flags                                                 | Không chỉnh sửa dữ liệu production trực tiếp qua database                                         |

Mọi tác vụ ghi dữ liệu của Platform Admin tạo `AuditLog` với actor, action, resource type/ID, timestamp, request ID, giá trị trước/sau phù hợp và lý do khi thao tác có ảnh hưởng quyền truy cập.

## 3. Tenant lifecycle

### Trạng thái tenant

| Trạng thái     | Ý nghĩa                                      | Hành vi                                             |
| -------------- | -------------------------------------------- | --------------------------------------------------- |
| `PROVISIONING` | Đang tạo tenant và owner                     | Chưa đăng nhập được                                 |
| `TRIAL`        | Dùng thử hợp lệ                              | Dùng theo plan trial                                |
| `ACTIVE`       | Có subscription SaaS hợp lệ                  | Dùng đầy đủ theo entitlements                       |
| `PAST_DUE`     | Thanh toán SaaS thất bại                     | Cảnh báo, áp dụng grace period                      |
| `SUSPENDED`    | Bị khóa bởi chính sách hoặc hết grace period | Chỉ Tenant Admin vào Billing/export theo chính sách |
| `CANCELED`     | Tenant đã hủy và hết kỳ trả tiền             | Read-only/Billing theo retention policy             |

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

| Route                              | Nội dung                                                                                | Hành động chính                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `/platform/dashboard`              | Active/trial/past-due, MRR demo, trial sắp hết, payment failure và webhook lỗi gần nhất | Đi tới tenant/invoice cần xử lý                 |
| `/platform/tenants`                | Tìm kiếm, lọc trạng thái/plan/hạn dùng, usage tóm tắt                                   | Tạo tenant, mở chi tiết                         |
| `/platform/tenants/:id`            | Profile SaaS, subscription, usage, owner, chi nhánh/user count, audit log               | Resend invite, extend trial, suspend/reactivate |
| `/platform/plans`                  | Danh mục plan, giá, billing cycle, entitlement và availability                          | Tạo/ẩn plan mới                                 |
| `/platform/billing/invoices`       | Invoice SaaS, trạng thái provider, failure reason                                       | Mở hosted invoice/Stripe dashboard              |
| `/platform/billing/webhook-events` | Provider event ID, loại, trạng thái xử lý, lỗi                                          | Retry xử lý nội bộ theo quyền                   |
| `/platform/email-templates`        | Template email hệ thống theo key/locale, draft, published revision và lịch sử           | Lưu draft, publish trực tiếp hoặc publish draft |
| `/platform/audit-logs`             | Nhật ký Platform Admin và tenant lifecycle                                              | Lọc, xem chi tiết                               |

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
- `GET /platform/email-templates`, `GET /platform/email-templates/:templateKey/:locale`
- `PUT /platform/email-templates/:templateKey/:locale/draft`
- `POST /platform/email-templates/:templateKey/:locale/publish`
- `POST /platform/email-templates/:templateKey/:locale/draft/publish`
- `GET /platform/audit-logs`, `GET /platform/audit-logs/:id`: chỉ trả audit domain Platform/Security; không trả clinical hay payment điều trị của tenant.

Các command tenant lifecycle cần body gồm `reason` (bắt buộc với suspend/extend/reactivate thủ công). Khi được triển khai, command có side effect phải nhận header `Idempotency-Key` UUID v4; không nhận key trong body. Endpoint retry chỉ chạy lại business processing đã lưu, không gọi provider để tạo giao dịch mới.

Plan catalog chỉ dành cho Platform Admin. `GET /platform/plans` trả cả plan active và inactive; `POST` luôn tạo plan active; `PATCH` không nhận đổi `code` và chỉ thay toàn bộ object `entitlements` khi field này được gửi. `POST` và `PATCH` bắt buộc header `Idempotency-Key` UUID v4; retry cùng key và request trả outcome đã lưu, còn reuse key với request khác trả `409`. Thay đổi `isActive` cần `reason`; lệnh lặp lại trạng thái hiện có không tạo audit mới. `code` và provider plan ID vẫn unique business constraint, không thay thế idempotency persistence. Plan từng được subscription tham chiếu chỉ được đổi `isActive`.

Email template hệ thống là global Platform state; chỉ `PLATFORM_EMAIL_TEMPLATE_MANAGE` được quản lý. V1 chỉ có key `tenant-owner-invitation` với locale `vi` và `en`; API không nhận tenant ID, không có tenant override và mọi command lưu draft/publish đều bắt buộc `Idempotency-Key`. Nội dung published không sửa trực tiếp: Platform Admin có thể direct publish nội dung form để tạo revision published mới, hoặc lưu draft rồi publish; cả hai đều archive bản published cũ. Direct publish trả `409` nếu đang có draft để không làm mất draft. Xem [12-email-template-management.md](./12-email-template-management.md).

### Trạng thái triển khai tenant management

Frontend có route onboarding công khai `/accept-tenant-owner-invitation?token=...`, được dùng từ link trong email owner invitation và không yêu cầu quyền `PLATFORM_ADMIN` hay tenant grant trước đó. Route chỉ gửi capability tới `POST /auth/tenant-owner-invitations/accept`; không hiển thị, lưu trữ hoặc ghi log token. Owner mới nhập họ tên/mật khẩu rồi được chuyển tới đăng nhập vì endpoint accept không tạo session. Owner đã đăng nhập bằng đúng email có thể xác nhận trên cùng route; client refresh authorization snapshot trước khi mở workspace của tenant vừa được cấp quyền.

Tenant catalog dùng offset pagination: `GET /platform/tenants?page=1&limit=10` trả `{ items, meta: { page, limit, total, totalPages } }`. `page` bắt đầu từ 1, `limit` tối đa 100; cursor và `nextCursor` không còn hỗ trợ. Query hỗ trợ `search`, `status`, `planId`, `trialEndingBefore`, `sortBy` (`displayName`, `planName`, `branchCount`, `status`, `createdAt`) và `sortOrder` (`ASC`/`DESC`). Search chỉ truy vấn SaaS profile/current plan; response không có clinical hoặc patient-payment data.

`GET /platform/tenants`, `GET /platform/tenants/:tenantId`, `POST /platform/tenants`, `PATCH /platform/tenants/:tenantId`, resend invitation, extend trial, suspend và reactivate đã được triển khai với `PLATFORM_TENANT_MANAGE` và idempotency cho mọi command. `PATCH` không sửa `slug`, owner hoặc `status`; `TenantLifecycleService` là nơi duy nhất chuyển access status.

Provisioning tạo `Tenant(PROVISIONING)`, một current `Subscription(TRIAL)`, owner invitation và audit trong cùng transaction, sau đó chuyển tenant sang `TRIAL`. Invitation chỉ lưu hash capability; `POST /auth/tenant-owner-invitations/accept` cho phép owner mới đặt password hoặc owner đã đăng nhập với đúng email nhận role `TENANT_ADMIN`. Acceptance replay cùng capability trả lại owner đã được tạo mà không ghi role/audit lần hai; các command Platform còn lại dùng `Idempotency-Key`. Job notifications gửi link sau commit, nên enqueue/delivery failure không xóa tenant và Platform Admin dùng resend để tạo capability mới.

`SubscriptionGuard` đã chạy sau tenant-context resolution và trước authorization ở mọi tenant/branch route. `TRIAL`, `ACTIVE` và `PAST_DUE` được phép vận hành trong grace state hiện tại; `PROVISIONING`, `SUSPENDED` và `CANCELED` bị chặn trừ route billing/read-only gắn `@AllowInactiveTenantAccess()`. Grace-period scheduler/provider transition là phần billing chưa triển khai.

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
