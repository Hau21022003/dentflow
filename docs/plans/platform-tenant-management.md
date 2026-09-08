# Kế hoạch tạm — Quản lý tenant cho Platform Admin

> **DRAFT — non-contract.** Tài liệu này chia roadmap để thực thi dần; contract chính thức vẫn nằm trong các tài liệu domain đánh số tại `docs/`.

## Mục tiêu và ranh giới

Backend cho Platform Admin quản lý tenant SaaS: provision tenant trial, xem catalog/chi tiết SaaS, mời owner, cập nhật profile, quản lý lifecycle và chặn access tenant không hợp lệ. Không bao gồm frontend, Stripe webhook, dashboard billing, dữ liệu clinical hoặc `PatientInvoice`/`Payment` điều trị.

## Trạng thái roadmap

1. **Provisioning và catalog — hoàn thành:** `GET /platform/tenants`, `GET /platform/tenants/:tenantId`, `POST /platform/tenants`; transaction tạo Tenant, Subscription trial, invitation và audit.
2. **Owner invitation — hoàn thành:** accept public với account mới hoặc session hiện có đúng email; resend invitation và notification worker.
3. **Lifecycle/access enforcement — hoàn thành:** cập nhật SaaS profile, extend trial, suspend/reactivate và Subscription Guard.
4. **Billing provider — chưa làm:** webhook, grace-period scheduler, invoice SaaS và dashboard metrics cần kế hoạch riêng.

## Bất biến thực thi

- Route Platform luôn dùng `PLATFORM_ADMIN` và `platform.tenant.manage`; Platform scope không truyền thành tenant/clinical scope.
- Owner invitation chỉ lưu SHA-256 hash token. Token email được worker tái tạo bằng HMAC server-side; không có trong database, API response, audit hay payload queue.
- `TenantLifecycleService` là điểm duy nhất chuyển `Tenant.status`; manual suspension lưu marker riêng để provider webhook trong tương lai không tự mở khóa tenant.
- Command Platform lifecycle/resend invitation dùng `Idempotency-Key`, transaction và audit append-only; public invitation acceptance idempotent theo single-use capability. Email enqueue nằm sau commit; failure không rollback provisioning và có thể resend.
- Subscription Guard cho phép `TRIAL`, `ACTIVE` và grace-state `PAST_DUE`; `PROVISIONING`, `SUSPENDED`, `CANCELED` chỉ vào các route billing/read-only đã gắn `@AllowInactiveTenantAccess()`.

## Việc trước khi mở rộng

Mỗi workstream billing sau này phải xác định source-of-truth provider, grace period, transition `PAST_DUE → SUSPENDED`, retry webhook và E2E tenant-isolation. Không thay đổi patient payment hoặc tạo access bypass để triển khai các phần này.
