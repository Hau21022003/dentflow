# DentFlow — Email Template Management

## 1. Mục đích và phạm vi

Email template là nội dung email hệ thống toàn cục do Platform Admin quản lý. V1 không có template theo tenant, không có key do admin tự tạo, không có preview-send endpoint và không dùng template để thay thế trạng thái nghiệp vụ hay background job của domain sở hữu email.

Key `tenant-owner-invitation` là key duy nhất trong V1. Mỗi key có locale `vi` và `en`; locale tenant khác `en` fallback `vi` khi hệ thống tạo owner invitation.

## 2. Revision và publish lifecycle

`email_template_revisions` lưu `template_key`, `locale`, `version`, `status`, subject, text, HTML và metadata creator/publisher. Mỗi cặp key/locale chỉ có một `DRAFT` và một `PUBLISHED`; revision có unique `(template_key, locale, version)`.

Published revision không sửa trực tiếp. Platform Admin có thể lưu nội dung vào draft rồi publish draft, hoặc direct publish nội dung form. Cả hai luồng đều chạy trong một transaction, archive published revision cũ và tạo/đưa một revision mới thành `PUBLISHED`. Direct publish luôn tạo revision mới, không thay đổi revision lịch sử và bị từ chối nếu đang có draft để không âm thầm bỏ nội dung chưa publish của admin khác. Không xóa revision để giữ lịch sử quản trị template.

Seed development/test tạo bản published v1 synthetic cho cả `vi` và `en`. `TenantOwnerInvitation` không giữ foreign key hay ID của template revision; invitation chỉ là state nghiệp vụ và không sở hữu nội dung email.

### Quy ước khi bổ sung system email template

- Mỗi key email system mới phải được khai báo trong registry, validation/schema và renderer của domain sở hữu email.
- Thêm bản `PUBLISHED` synthetic ban đầu cho từng locale được hỗ trợ vào **cả** `backend/src/database/seeds/dev/` và `backend/src/database/seeds/test/`. Fixture phải idempotent, dùng dữ liệu synthetic và có đủ placeholder bắt buộc để development, reset test và E2E có thể gửi/render email ngay sau khi seed.
- Migration chỉ tạo hoặc thay đổi schema/constraint; không chèn nội dung template mẫu. Seed development/test không được dùng để khởi tạo production. Trước khi bật key mới ở production, phải có kế hoạch provision/publish riêng, được kiểm soát trong rollout của key đó.

## 3. Nội dung và an toàn

Template bắt buộc có `subject`, `text` và `html`. Chỉ chấp nhận placeholder `{{variable}}`; không có raw HTML placeholder, loop hay condition. `tenant-owner-invitation` chỉ dùng `tenantDisplayName`, `invitationUrl` và `expiresAt`; `invitationUrl` và `expiresAt` bắt buộc xuất hiện trong text/HTML.

Processor tạo link capability ở server, tải lại invitation từ database và resolve revision `PUBLISHED` theo key `tenant-owner-invitation` và locale đã normalize từ `Tenant.defaultLocale` ngay trước khi render. Giá trị biến được HTML-escape; HTML email sau render được sanitize theo allowlist. Payload BullMQ chỉ chứa invitation ID, không chứa template content, recipient, token hay data từ client. Vì vậy publish hoàn tất trước một lần xử lý hoặc retry sẽ áp dụng nội dung published mới cho lần gửi đó.

## 4. API, quyền và audit

Tất cả route dưới `/platform/email-templates` yêu cầu Platform scope và `PLATFORM_EMAIL_TEMPLATE_MANAGE`:

- `GET /platform/email-templates`
- `GET /platform/email-templates/:templateKey/:locale`
- `PUT /platform/email-templates/:templateKey/:locale/draft`
- `POST /platform/email-templates/:templateKey/:locale/publish`
- `POST /platform/email-templates/:templateKey/:locale/draft/publish`

Ba command dùng `Idempotency-Key` UUID v4. Direct publish nhận cùng body `subject`, `text`, `html` như save draft, validate theo template contract và trả revision `PUBLISHED` mới. Nếu một draft đang tồn tại, direct publish trả `409`; client phải publish hoặc cập nhật draft theo luồng draft trước. API không nhận tenant ID và Tenant Admin không có route hay permission quản lý template này.

Lưu draft, direct publish và publish draft ghi AuditLog domain `PLATFORM`, nhưng chỉ chứa key, locale, version, status và tên field thay đổi; không lưu nội dung email hoặc giá trị đã render.

## 5. Ngoài phạm vi V1

Tenant override, key email bổ sung, template preview/send, delivery outbox tập trung và worker/concurrency riêng sẽ được thiết kế thành domain riêng khi có nhu cầu nghiệp vụ cụ thể. Nếu cần truy vết chính xác revision đã được một email gửi sử dụng, delivery outbox sẽ lưu `templateKey`, locale và revision tại thời điểm dispatch; không thêm thuộc tính revision vào entity nghiệp vụ.
