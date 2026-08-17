# DentFlow — Tenant Admin Operations

## 1. Mục đích và ranh giới

`TENANT_ADMIN` quản trị một chuỗi/phòng khám trong đúng tenant đã được xác thực. Vai trò này thiết lập chuẩn vận hành, quản lý chi nhánh và nhân sự, theo dõi hoạt động toàn chuỗi, quản lý cấu hình tenant và thuê bao SaaS.

Tenant Admin không phải `PLATFORM_ADMIN`: không vận hành hạ tầng DentFlow, tenant khác, plan toàn nền tảng hay hệ thống gửi mail. Tenant Admin cũng không thay thế `BRANCH_ADMIN`, `RECEPTIONIST` hoặc `DENTIST` trong tác vụ hằng ngày. Quyền lâm sàng chỉ có khi user được gán thêm role clinical hợp lệ; quyền payment điều trị vẫn thuộc phạm vi branch và quy trình thu tiền. Hai dòng tiền được định nghĩa tại [01-payment-model.md](./01-payment-model.md).

Mọi dữ liệu và thao tác của Tenant Admin phải lấy tenant context từ session/route đã xác minh. `tenantId` do client gửi chỉ là định danh resource, không phải cơ chế cấp quyền.

## 1.1 Nền tảng schema Tenant và Branch

Migration nền tảng lưu dữ liệu tổ chức trước khi có API quản trị:

| Entity | Field cốt lõi đã có | Lifecycle / ràng buộc |
| --- | --- | --- |
| `Tenant` | UUID, legal/display name, `slug`, billing/contact information, logo URL, default locale/timezone, status, timestamps | `slug` duy nhất và chỉ gồm chữ thường, số, dấu gạch nối; status khởi tạo là `PROVISIONING` rồi chỉ service lifecycle sau này mới chuyển trạng thái |
| `Branch` | UUID, `tenantId`, `slug`, name, address, phone, timezone override, status, timestamps | Thuộc đúng một tenant qua FK `RESTRICT`; `slug` là URL key ổn định, unique theo `(tenantId, slug)` và không thay `id` trong FK; `ACTIVE`/`INACTIVE`, không soft-delete; composite unique `(id, tenantId)` chuẩn bị cho FK tenant-scoped của role và dữ liệu nghiệp vụ |

Branch kế thừa locale/timezone vận hành của tenant khi không có override phù hợp. Giờ mở cửa, slot duration, appointment rules và các cấu hình vận hành khác chưa được lưu ở migration này; chúng sẽ có schema/migration riêng trước khi có endpoint quản trị tương ứng.

## 2. Năng lực Tenant Admin trong MVP

MVP dùng role cố định `TENANT_ADMIN`. Tenant Admin có phạm vi toàn tenant nhưng chỉ được hợp quyền với các role khác trong cùng tenant; không được hợp quyền hoặc branch scope qua tenant khác.

| Năng lực | Được phép | Bị cấm / giới hạn |
| --- | --- | --- |
| Tenant settings | Cập nhật display name, logo, thông tin liên hệ, locale, timezone mặc định và quy ước hiển thị | Không đổi `tenantSlug`, trạng thái tenant hay cấu hình hạ tầng Platform |
| Branch | Tạo, cập nhật, ngừng hoạt động branch; đặt giờ làm việc và cấu hình lịch hẹn cơ bản | Không truy cập hoặc quản lý branch của tenant khác |
| Service catalog | Quản lý mã, tên, nhóm, giá niêm yết, thời lượng và trạng thái hoạt động của `Service` | Không thay đổi hồi tố khoản đã invoiced/paid chỉ bằng việc sửa giá dịch vụ |
| Nhân sự và quyền | Mời, vô hiệu hóa user; gán/thu hồi role cố định và branch scope trong tenant | Không tạo role/permission tuỳ ý, không tự mở rộng quyền ngoài policy |
| Báo cáo và audit | Xem số liệu tổng hợp toàn tenant và audit log nghiệp vụ | Không tự có quyền đọc/ghi clinical detail chỉ vì role quản trị |
| SaaS billing | Chọn plan, mở Stripe Checkout/Customer Portal, xem subscription và `SaaSInvoice` | Không tự đánh dấu Stripe payment là paid/active; webhook là nguồn trạng thái đáng tin cậy |
| Thông báo | Cấu hình branding, sender display name, reply-to, template và loại thông báo được bật | Không truy cập SMTP/API key, DNS, provider configuration hoặc technical delivery log nhạy cảm |

Mọi thay đổi quyền, branch, cấu hình tenant, danh mục dịch vụ và thao tác billing phải tạo `AuditLog` với actor, action, resource, timestamp, request ID và giá trị trước/sau phù hợp. Các thao tác có rủi ro cần lưu thêm lý do.

## 3. Luồng onboarding tenant

1. Tenant Admin nhận lời mời từ tenant đã được `PLATFORM_ADMIN` provision, kích hoạt tài khoản và đăng nhập.
2. Rà soát display name, locale, timezone mặc định, logo và thông tin liên hệ của tenant.
3. Tạo chi nhánh đầu tiên với tên, địa chỉ, số điện thoại, giờ hoạt động và cấu hình lịch hẹn cơ bản.
4. Khai báo danh mục `Service`: mã, tên, nhóm, giá niêm yết, thời lượng dự kiến và trạng thái hoạt động.
5. Mời `BRANCH_ADMIN`, `RECEPTIONIST` và `DENTIST`; gán branch scope ngay trong lời mời hoặc assignment. Chỉ role danh mục cố định mới được gán.
6. Kiểm tra trial/subscription, chọn plan hoặc mở Stripe Checkout khi cần. Tenant chỉ được vận hành khi Subscription Guard cho phép.

## 4. Cài đặt tenant và cấu hình vận hành

### Nhận diện, locale và tên hiển thị

- Tenant Admin quản lý display name, logo, thông tin liên hệ, locale và timezone mặc định của tenant.
- `fullName` là dữ liệu tên chuẩn cho user; hệ thống không bắt buộc tách họ/tên theo một mô hình duy nhất. Tenant chỉ được cấu hình quy ước hiển thị, không thay đổi ý nghĩa hoặc mất dữ liệu tên gốc.
- `tenantSlug` xuất hiện trong URL và được `PLATFORM_ADMIN` kiểm soát để tránh gãy liên kết hoặc xung đột định danh.
- `branchSlug` xuất hiện dưới `tenantSlug` trong URL, chỉ unique trong tenant và không tự đổi khi tên branch đổi. Mọi authorization vẫn resolve slug trong tenant đã xác minh rồi kiểm tra bằng `branchId` và branch scope.
- Thay đổi timezone cần hiển thị cảnh báo về việc lịch hẹn/lịch sử cũ được hiển thị theo timezone mới. Thao tác phải được audit; timestamp nghiệp vụ được lưu theo thời điểm chuẩn để không đổi lịch sử thực tế.

### Lịch hẹn và giờ hoạt động

- Tenant Admin thiết lập giờ hoạt động, thời lượng slot, quy tắc đặt lịch và các giá trị mặc định cho toàn tenant.
- Branch có thể override các giá trị vận hành này khi cần; cấu hình branch luôn ưu tiên cho dữ liệu thuộc branch đó.
- Thay đổi chính sách không được tự động sửa appointment đã tạo. Nếu cần thay đổi một lịch cụ thể, áp dụng workflow và quyền theo branch cùng audit trail.

### Thông báo và email

- Tenant Admin quản lý nhận diện truyền thông: sender display name, địa chỉ reply-to, template và việc bật/tắt từng loại thông báo được hỗ trợ.
- Trong MVP, gửi nhắc hẹn chỉ là hàng đợi/lịch sử mô phỏng; không tích hợp gửi SMS, Zalo hoặc email thật.
- Provider, SMTP/API credential, DNS/SPF/DKIM, retry, rate limit, hàng đợi kỹ thuật và technical delivery log thuộc vận hành Platform. Chúng không được lưu hoặc chỉnh từ tenant settings.

Kết nối domain gửi mail riêng của tenant là roadmap sau MVP. Chỉ triển khai sau khi có xác minh quyền sở hữu domain, lưu secret được mã hóa, retry/idempotency và audit rõ ràng; Tenant Admin có thể khởi tạo yêu cầu, còn Platform quản lý hạ tầng và xác minh.

## 5. Quản trị chi nhánh, nhân sự và danh mục dịch vụ

### Chi nhánh và dịch vụ

- Tạo/cập nhật/ngừng hoạt động branch trong tenant; không xóa dữ liệu vận hành để tránh mất audit trail.
- Quản lý danh mục dịch vụ chung của tenant. Giá niêm yết mới chỉ áp dụng cho các hạng mục/lịch hẹn tạo sau theo policy; không làm thay đổi `PatientInvoice` hay `Payment` đã ghi nhận.
- Tenant Admin theo dõi cấu hình branch nhưng không thực hiện thay `BRANCH_ADMIN` các điều phối ca thường nhật trong MVP.

### User, role và branch scope

- Tenant Admin mời user, vô hiệu hóa user và gán/thu hồi `TENANT_ADMIN`, `BRANCH_ADMIN`, `RECEPTIONIST` hoặc `DENTIST` cùng branch scope phù hợp.
- Role/permission là danh mục tĩnh trong MVP; database lưu assignment và phạm vi, không có màn hình tạo role hoặc sửa permission tuỳ ý.
- Một user có thể có nhiều role, ví dụ Tenant Admin đồng thời là Dentist. API luôn kiểm tra role cần cho hành động, tenant context và branch/case scope; không suy luận quyền clinical từ role quản trị.
- Cấp hoặc thu hồi role, thay đổi branch scope và vô hiệu hóa user phải lưu actor, thời điểm, giá trị trước/sau và lý do khi policy yêu cầu.

## 6. Giám sát, báo cáo và kiểm soát

Tenant Admin xem dashboard toàn tenant, có thể lọc theo branch và thời gian để theo dõi:

- lịch hẹn theo trạng thái, no-show và công suất vận hành;
- số bệnh nhân, treatment plan đang mở và các mục cần follow-up;
- doanh thu điều trị đã ghi nhận, invoice chưa thanh toán và số liệu tổng hợp theo branch;
- thay đổi quyền, giá dịch vụ, lịch hẹn, treatment plan, payment adjustment/refund và cấu hình qua audit log.

Dashboard và báo cáo chỉ cấp số liệu mà role này được phép xem. Tenant Admin không được tạo/sửa clinical note, chẩn đoán hoặc treatment plan nếu không có thêm `DENTIST` role và scope ca hợp lệ. Tenant Admin cũng không sửa/xóa payment điều trị đã ghi nhận; refund/adjustment là bản ghi mới theo workflow, audit và quyền branch phù hợp.

## 7. SaaS billing và trạng thái truy cập

Tenant Admin có thể xem subscription, `SaaSInvoice`, kỳ hạn, plan hiện tại và trạng thái billing; có thể chọn plan, tạo Checkout Session hoặc mở Stripe Customer Portal.

```text
Tenant Admin chọn plan
  → Stripe Checkout / Customer Portal
  → Stripe webhook xác thực
  → Subscription + SaaSInvoice cập nhật
  → Subscription Guard cho phép hoặc giới hạn vận hành
```

Tenant Admin không được tự chuyển subscription sang `ACTIVE` hoặc đánh dấu Stripe invoice là paid. Khi tenant ở `PAST_DUE`, `SUSPENDED` hoặc `CANCELED`, Subscription Guard chặn nghiệp vụ vận hành theo chính sách; Tenant Admin vẫn truy cập được các chức năng billing/read-only được cho phép. SaaS billing không tác động tới `PatientInvoice` hay `Payment` điều trị.

## 8. API contract định hướng

Các endpoint dưới `/api/v1` yêu cầu tenant context đã xác minh và `TENANT_ADMIN` cho năng lực quản trị tương ứng. Mỗi endpoint vẫn áp dụng Subscription Guard, kiểm tra role và truy vấn có điều kiện `tenantId`/`branchId`.

- `GET/PATCH /tenant/settings`
- `GET/POST/PATCH /branches`
- `GET/POST/PATCH /services`
- `GET/POST/PATCH /users`
- `POST /role-assignments`, `PATCH /role-assignments/:assignmentId`, `DELETE /role-assignments/:assignmentId`
- `GET /dashboard`, `GET /reports/*`, `GET /audit-logs`
- `GET /billing/subscription`, `GET /billing/invoices`, `POST /billing/checkout-session`, `POST /billing/customer-portal`

Settings API không nhận credential mail/provider hoặc `tenantId` để chọn tenant. Các command nhạy cảm cần idempotency key khi phù hợp, validation tenant/branch scope và audit log.

## 9. Acceptance criteria và test

- Tenant Admin cập nhật display name, locale, timezone và cấu hình lịch mặc định trong tenant của mình; thay đổi timezone tạo cảnh báo và audit log.
- Tenant Admin tạo branch/service, mời user và gán role/branch scope hợp lệ; không tạo được role/permission tuỳ ý hoặc assignment ở tenant khác.
- Tenant Admin không có `DENTIST` nhận `403` khi tạo/sửa clinical note, diagnosis hoặc treatment plan; không gọi được endpoint sửa/xóa payment điều trị.
- Tenant Admin xem dashboard/báo cáo tenant và audit log, nhưng payload không tự tiết lộ clinical detail ngoài quyền được cấp.
- Tenant Admin chỉ xem/chọn luồng SaaS billing; Stripe webhook mới cập nhật trạng thái thanh toán. Billing SaaS không thay đổi patient payment.
- Tenant settings không có API/UI cho SMTP/API credential, DNS hoặc cấu hình provider. Notification thật chưa được gửi trong MVP.
- Tenant context từ session được kiểm tra trước mọi query; biết ID của tenant/branch khác vẫn nhận `403` hoặc không thấy dữ liệu.

## 10. Ngoài phạm vi MVP

- Custom role/permission hoặc permission editor cho tenant.
- Phê duyệt giảm giá, hoàn tiền và ngoại lệ chuỗi theo nhiều cấp; chỉ bổ sung sau khi có policy, segregation of duties và workflow rõ ràng.
- SMTP credential tự quản lý, email/SMS/Zalo gửi thật hoặc domain gửi riêng của tenant.
- Clinical read access mặc định cho Tenant Admin, support impersonation và chỉnh sửa trực tiếp dữ liệu production.
