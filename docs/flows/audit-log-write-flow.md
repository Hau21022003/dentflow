# Audit Log Write Flow

Sơ đồ này mô tả luồng kỹ thuật khi một command nghiệp vụ ghi `AuditLog`. Quy tắc domain, payload được phép, API đọc và retention vẫn theo [audit log contract](../05-audit-log.md).

```mermaid
flowchart TD
  client[Client request] --> middleware[RequestContextMiddleware]
  middleware --> context[RequestContextService.run: requestId, IP HMAC, userAgent]
  context --> guards[JWT, tenant context và authorization guards]
  guards --> command[Controller và command service]
  command --> transaction[Transaction nghiệp vụ]
  transaction --> mutation[Thay đổi business data]
  mutation --> record[AuditLogService.record manager, event]
  record --> requestMetadata[Đọc request context]
  requestMetadata --> validation[Validate action, scope và payload an toàn]
  validation --> auditRow[(audit_logs append-only)]
  auditRow --> commit[Commit transaction]
  commit --> response[HTTP response]

  record -->|Validation hoặc insert lỗi| rollback[Rollback transaction]
  rollback --> error[HTTP error]
```

## Quy tắc triển khai

- Command gọi `AuditLogService.record(manager, event)` bằng chính `EntityManager` của transaction. Thay đổi nghiệp vụ và audit commit hoặc rollback cùng nhau.
- `event` chỉ chứa actor, tenant/branch scope đã xác minh, action, resource và payload theo allowlist. `requestId`, IP HMAC và user agent do `AuditLogService` lấy từ `RequestContextService`.
- Request context chỉ sống trong vòng đời HTTP request. Với job hoặc webhook không có HTTP context, audit service tạo request ID mới và lưu IP/user agent là `null`.
- `audit_logs` không được update hoặc delete; database trigger bảo vệ tính append-only.
