# DentFlow — Payment Model

## 1. Quyết định nền tảng

DentFlow không phải là bên thu hộ tiền điều trị trong MVP. Sản phẩm có hai dòng tiền hoàn toàn tách biệt về dữ liệu, tài khoản nhận tiền, webhook và quyền truy cập.

| Dòng tiền | Người trả | Người nhận / merchant of record | Mục đích |
| --- | --- | --- | --- |
| SaaS subscription | Tenant (phòng khám) | DentFlow | Phí dùng phần mềm theo tháng/năm |
| Clinical payment | Bệnh nhân | Tenant/phòng khám | Chi phí khám và điều trị |

Platform Admin quản trị sản phẩm, plan, công nợ SaaS và hỗ trợ tenant. Platform Admin không tạo khoản thanh toán điều trị thay cho tenant, không nhận tiền điều trị vào tài khoản DentFlow và không thực hiện payout cho tenant.

## 2. Phí thuê bao SaaS: tenant trả DentFlow

### Vai trò và hành vi

- Tenant Admin chọn plan, xem hạn dùng, invoice SaaS, cập nhật phương thức thanh toán và mở billing portal do provider hỗ trợ.
- Backend tạo luồng subscription qua provider SaaS billing được chọn theo môi trường (`SAAS_BILLING_PROVIDER`: `stripe` hoặc `paypal`). Đây là cấu hình toàn cục của DentFlow, không do tenant hay client request chọn.
- Webhook của provider là nguồn dữ liệu đáng tin cậy cho trạng thái thanh toán. Phải xác minh chữ ký webhook trước khi đọc payload; UI chỉ hiển thị trạng thái đang chờ sau khi redirect.
- Platform Admin có thể xem, hỗ trợ và đặt trạng thái trial/khóa theo chính sách vận hành; không đánh dấu `PAID` thủ công cho giao dịch provider trừ khi có luồng thanh toán chuyển khoản được kiểm soát riêng.

### Trạng thái chuẩn hóa trong DentFlow

| Trạng thái | Ý nghĩa | Khả năng dùng sản phẩm |
| --- | --- | --- |
| `TRIAL` | Dùng thử còn hiệu lực | Được phép |
| `ACTIVE` | Thanh toán SaaS hợp lệ | Được phép |
| `PAST_DUE` | Provider chưa thu được tiền | Grace period, sau đó chỉ còn billing |
| `CANCELED` | Đã hủy và hết kỳ đã trả | Chỉ còn billing/read-only |
| `SUSPENDED` | Platform khóa thủ công | Chỉ còn billing/read-only |

Mỗi provider cần ánh xạ event tạo/cập nhật/hủy subscription và invoice thanh toán thành công/thất bại vào trạng thái chuẩn của DentFlow. Mỗi event lưu `providerEventId` duy nhất để xử lý idempotent; xác minh chữ ký của provider trước khi đọc payload.

### Mô hình dữ liệu SaaS

- `SubscriptionPlan`: catalog toàn Platform, không thuộc tenant. Mỗi plan có code ổn định, tên/mô tả, một chu kỳ (`MONTHLY` hoặc `YEARLY`), giá nguyên theo đơn vị tiền tệ nhỏ nhất, ISO currency, provider plan ID tùy chọn, entitlement JSON object và trạng thái hiển thị. Một plan chỉ đại diện cho một mức giá/một chu kỳ, ví dụ `growth-monthly` và `growth-yearly` là hai plan khác nhau. `code` không đổi sau khi tạo; plan đã từng được `Subscription` tham chiếu chỉ thay đổi được availability (ẩn/hiện), không đổi giá hay entitlement hồi tố.
- `trialDays` là thời hạn trial mặc định tùy chọn của plan. Trial là trạng thái của `Subscription`, không phải một plan có chu kỳ riêng; `Subscription` sẽ quyết định thời điểm bắt đầu/kết thúc trial thực tế khi tenant được provision.
- `Subscription`: `tenantId`, plan, provider customer/subscription ID, trạng thái, kỳ hiện tại, ngày hủy. Plan reference là bất biến; khi tenant đổi plan, đóng record cũ và tạo record mới để giữ lịch sử cũng như bảo vệ plan đã từng dùng.
- `SaaSInvoice`: `tenantId`, provider invoice ID, kỳ billing, tổng tiền, tiền tệ, trạng thái, URL invoice/hosted payment page.
- `PaymentEvent`: event provider đã xử lý, loại event, thời điểm, kết quả; đây là audit kỹ thuật, không thay thế `AuditLog` nghiệp vụ.

## 3. Thanh toán điều trị: bệnh nhân trả trực tiếp cho phòng khám

### MVP: ghi nhận tại quầy, không chuyển tiền qua DentFlow

Lễ tân lập `PatientInvoice` từ `TreatmentItem` của Treatment Plan `ACCEPTED` và ghi nhận một hoặc nhiều `Payment`. Item chưa cần `COMPLETED`, nên tenant có thể thu trước hoặc thu nhiều đợt. Contract workflow, quyền và API branch-scoped nằm tại [06-domain-workflows.md](./06-domain-workflows.md).

- Phương thức hỗ trợ: `CASH`, `BANK_TRANSFER`, `CARD`, `OTHER`.
- Một TreatmentItem thuộc tối đa một invoice còn hiệu lực. Void invoice sau khi tất toán correction mới giải phóng item để invoice lại.
- Invoice chỉ dùng một currency và snapshot line/item/service/amount tại thời điểm tạo; catalog hay Treatment Plan thay đổi không hồi tố invoice đã issue.
- Payment có số tiền, thời điểm, người thu, mã tham chiếu/ghi chú và bằng chứng tùy chọn ở giai đoạn sau. `BANK_TRANSFER`/`CARD` dùng transaction reference unique theo policy tenant.
- Một invoice cho phép thanh toán nhiều lần và chuyển `ISSUED → PARTIALLY_PAID → PAID` theo số tiền thực thu ròng, dưới lock invoice.
- Không sửa hoặc xóa Payment đã ghi nhận. Refund/adjustment là record bù trừ mới tham chiếu Payment gốc, mang amount/direction/reason code và audit log; Branch Admin cần permission `patient-payment.adjust` trong đúng branch để tạo correction.
- Invoice chỉ `VOID` ở `DRAFT`/`ISSUED`; nếu đã có net collected amount, phải refund/adjust về 0 trước khi void.
- `PatientInvoice` và `Payment` luôn có `tenantId` và `branchId`; chỉ người có phạm vi branch phù hợp được truy cập.

Tiền mặt, chuyển khoản hay quẹt thẻ được nộp vào quỹ/tài khoản của chi nhánh theo quy trình riêng của tenant. DentFlow lưu sổ theo dõi vận hành, không đóng vai trò ngân hàng, cổng thanh toán hay bên chịu trách nhiệm đối soát ngân hàng trong MVP.

### Roadmap: thanh toán online trực tiếp cho tenant

Khi cần gửi link thanh toán cho bệnh nhân, mỗi tenant kết nối tài khoản merchant/cổng thanh toán của chính họ. Backend tạo payment link theo tenant, nhận webhook tương ứng và cập nhật `Payment` sau khi xác minh.

- Tiền đi thẳng về tài khoản merchant của tenant.
- Biên lai/transaction reference hiển thị tên tenant, không phải DentFlow.
- DentFlow chỉ cung cấp hạ tầng tích hợp và có thể tính phí SaaS độc lập.
- Chỉ bật tính năng sau khi có cơ chế tenant onboarding, lưu secrets được mã hóa, retry/idempotency webhook và quy trình refund rõ ràng.

## 4. Điều không làm trong MVP

Không triển khai marketplace, split payment, tiền ký quỹ, payout hay thu % trên từng ca điều trị. Các mô hình đó đòi hỏi DentFlow đứng trong luồng tiền, onboarding/KYC từng phòng khám, xử lý refund/dispute, đối soát và nghĩa vụ pháp lý/tài chính cao hơn.

Nếu sau này có nhu cầu thật sự, đây là một product line riêng: đánh giá pháp lý tại thị trường mục tiêu, chọn payment facilitator phù hợp, xác định bên chịu trách nhiệm chargeback/refund và thiết kế sổ cái nội bộ trước khi viết tính năng.

## 5. Acceptance criteria

- Thanh toán SaaS thành công qua provider đã cấu hình trong sandbox/test mode kích hoạt tenant mà không tác động đến `PatientInvoice` hay `Payment`.
- Tenant hết hạn/chưa thanh toán bị Subscription Guard chặn endpoint vận hành nhưng vẫn truy cập được trang billing.
- Giao dịch tiền điều trị được tạo bởi lễ tân chỉ ảnh hưởng invoice của bệnh nhân trong tenant/branch của họ; không gọi Stripe Platform API.
- Item `ACCEPTED` không thể xuất hiện trong hai invoice còn hiệu lực; partial payment chỉ tạo thêm Payment trên invoice hiện hữu.
- Refund/adjustment không sửa Payment gốc, chỉ tạo record bù trừ trong đúng branch có audit; Platform Admin không tự có quyền command này.
- Một Platform Admin không thể tạo payout hoặc xem/chỉnh sửa payment điều trị nếu không có tenant/branch assignment hợp lệ.
- Test tenant isolation chứng minh không thể dùng ID của tenant khác cho subscription invoice, patient invoice hoặc payment.
