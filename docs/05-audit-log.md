# DentFlow — Audit Log

## 1. Mục đích và bất biến

`AuditLog` là nhật ký nghiệp vụ append-only: ghi ai hoặc hệ thống đã thực hiện hành động rủi ro nào, trên resource nào và khi nào. Nó không thay thế technical log, event webhook hay lịch sử clinical.

- Bản ghi tenant luôn được tạo và đọc trong tenant context đã xác minh; `tenantId`/`branchId` từ client không cấp quyền.
- `audit_logs` không có API update/delete. Database trigger từ chối `UPDATE` và `DELETE`; không có cascade delete từ tenant, branch hoặc user.
- Audit row phải được ghi trong cùng transaction với command nghiệp vụ. Nếu audit không ghi được, command rollback.
- Không backfill lịch sử trước migration này. Các command mới phải gọi `AuditLogService.record(manager, event)` trong PR của chính command đó.

## 2. Nội dung được lưu

Mỗi row có actor type/user/session, tenant/branch khi áp dụng, action, domain, resource type/ID, request ID, timestamp và metadata nguồn request.

- Domain: `PLATFORM`, `TENANT_ADMIN`, `CLINICAL`, `FINANCIAL`, `SECURITY`.
- IP chỉ lưu HMAC-SHA256 với `AUDIT_IP_HMAC_SECRET`; không lưu IP thô. MVP lấy địa chỉ socket trực tiếp và không tin `X-Forwarded-For` khi chưa có cấu hình trusted proxy. User agent được giới hạn 512 ký tự.
- `before`, `after`, `metadata` là JSONB theo allowlist. Cấm password, token, cookie, secret, thông tin nhận diện bệnh nhân, clinical note, diagnosis và patient alert.
- Patient audit chỉ lưu tên các field đã đổi. Alert, diagnosis, tooth description, clinical note và addendum content không bao giờ là payload audit. Treatment audit chỉ lưu state/ID. Financial audit chỉ lưu amount, currency, method, reference an toàn, direction và reason code.
- Free-text reason chỉ dùng cho action Platform/Tenant Admin có policy cho phép. Clinical và financial dùng `metadata.reasonCode`.

Các action là constants ở code, không phải database enum, gồm quyền/scope, tenant lifecycle, SaaS billing, tenant/branch/service/user, patient/appointment/treatment state, patient invoice/payment và security event. Tenant provisioning ghi `TENANT_CREATED`; owner invitation ghi `TENANT_OWNER_INVITATION_CREATED`, `TENANT_OWNER_INVITATION_RESENT` và `TENANT_OWNER_INVITATION_ACCEPTED`. Staff invitation ghi `STAFF_INVITATION_CREATED`, `STAFF_INVITATION_RESENT`, `STAFF_INVITATION_REVOKED`, `STAFF_INVITATION_ACCEPTED`; membership dùng `USER_DISABLED`/`USER_ENABLED`, user tự sửa profile dùng `USER_PROFILE_UPDATED`, và grant dùng `ROLE_GRANTED`/`ROLE_REVOKED`. Khi staff command được Branch Admin thực hiện, invitation và role audit phải mang `branchId` đã resolve; gỡ nhân sự khỏi branch tạo một `ROLE_REVOKED` cho mỗi assignment bị thu hồi trong cùng transaction. `USER_PROFILE_UPDATED` chỉ ghi `changedFields` (`fullName`, `avatar`), không có tên, URL hay object key. Payload invitation chỉ có state; tuyệt đối không có email, tên, raw/hash token hoặc password. Các command nghiệp vụ chưa được tạo phải tích hợp action phù hợp trước khi merge.

Clinical contract tại [06-domain-workflows.md](./06-domain-workflows.md) yêu cầu bổ sung action registry trước khi module được merge: `PATIENT_ALERT_CREATED`, `PATIENT_ALERT_UPDATED`, `APPOINTMENT_ASSIGNMENT_CHANGED`, `VISIT_OPENED`, `VISIT_COMPLETED`, `TREATMENT_NOTE_ADDED`, `TREATMENT_PLAN_ACCEPTED`, `TREATMENT_PLAN_REOPENED`, `FOLLOW_UP_RECOMMENDED` và `FOLLOW_UP_SCHEDULED`. `PATIENT_CREATED`, `PATIENT_ADMINISTRATIVE_UPDATED`, `APPOINTMENT_CREATED`, `APPOINTMENT_STATE_CHANGED`, `TREATMENT_PLAN_STATE_CHANGED`, `TREATMENT_ITEM_STATE_CHANGED`, `PATIENT_INVOICE_ISSUED`, `PATIENT_INVOICE_VOIDED`, `PATIENT_PAYMENT_RECORDED`, `PATIENT_PAYMENT_REFUNDED` và `PATIENT_PAYMENT_ADJUSTED` vẫn là action chuẩn cho các command tương ứng. Mọi action clinical/financial mới mang tenant/branch đã resolve, resource ID, state/changed field an toàn và reason code khi cần; không mang PII hoặc clinical free text.

Branch lifecycle dùng `BRANCH_CREATED`, `BRANCH_UPDATED`, `BRANCH_DEACTIVATED` và `BRANCH_ACTIVATED`. Snapshot chỉ có status và `changedFields`; deactivate/activate lưu free-text reason theo policy Tenant Admin, không ghi địa chỉ hoặc số điện thoại.

Plan catalog dùng `PLAN_CREATED`, `PLAN_UPDATED`, `PLAN_DEACTIVATED` và `PLAN_ACTIVATED`. Snapshot của các action này chỉ chứa `changedFields`, `isActive`, `amount` và `currency`; thay đổi availability lưu thêm free-text `reason` theo policy Platform.

Service catalog tenant dùng `SERVICE_CREATED`, `SERVICE_UPDATED`, `SERVICE_DEACTIVATED`, `SERVICE_ACTIVATED`, `SERVICE_GROUP_CREATED`, `SERVICE_GROUP_UPDATED`, `SERVICE_GROUP_DEACTIVATED` và `SERVICE_GROUP_ACTIVATED`. Snapshot Service chỉ chứa `changedFields`, `isActive`, `amount`, `currency` và `durationMinutes`; thay đổi nhóm chỉ ghi tên field `serviceGroupId`. Snapshot ServiceGroup chỉ chứa `changedFields` và `isActive`. Đổi `amount`/`currency`, hoặc deactivate/activate Service/ServiceGroup lưu free-text `reason` theo policy Tenant Admin. Không ghi code, tên hoặc nhóm dịch vụ trực tiếp trong payload audit.

Email template global dùng `EMAIL_TEMPLATE_DRAFT_SAVED` và `EMAIL_TEMPLATE_PUBLISHED`, resource type `EMAIL_TEMPLATE_REVISION`, domain `PLATFORM`. Snapshot chỉ có `templateKey`, `locale`, `version`, `status` và `changedFields`; tuyệt đối không ghi subject, text, HTML, recipient hoặc giá trị biến đã render.

## 3. API đọc

Các API dưới đây là route nội bộ của backend và chỉ trả audit data đã redacted. URL công khai, API prefix/version và việc rewrite/strip prefix do Nginx/gateway quản lý khi deploy, nên không được ghi cứng ở đây. List không trả payload; endpoint detail mới trả `before`, `after`, `metadata` an toàn. Tất cả list dùng cursor `(occurredAt,id)`, mặc định 50 và tối đa 100.

| Endpoint                                                           | Quyền và phạm vi                           | Dữ liệu trả về                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `GET /platform/audit-logs`, `/:id`                                 | `PLATFORM_AUDIT_LOG_READ` + Platform scope | Chỉ domain `PLATFORM` và `SECURITY`; không có clinical/patient financial audit |
| `GET /tenants/:tenantSlug/audit-logs`, `/:id`                      | `AUDIT_LOG_READ` + tenant scope            | Audit record của tenant đã resolve                                             |
| `GET /tenants/:tenantSlug/branches/:branchSlug/audit-logs`, `/:id` | `AUDIT_LOG_READ` + branch scope            | Chỉ record của branch đã resolve                                               |

List hỗ trợ `from`, `to`, `action`, `resourceType`, `resourceId`, `actorUserId`, `cursor`, `limit`; tenant list nhận thêm `branchSlug`, được resolve trong tenant. Record ngoài scope trả `404`; thiếu JWT là `401` và thiếu grant/permission là `403`.

## 4. Retention và vận hành

Audit log được giữ tối thiểu 7 năm sau khi tenant hủy. MVP chưa có purge tự động để không làm suy yếu tính bất biến. Trước khi bổ sung purge phải có legal review, legal-hold policy và database role riêng có kiểm soát.

`X-Request-Id` chỉ nhận UUID hợp lệ hoặc được server sinh mới, được trả trong response và gắn vào audit/technical log.
