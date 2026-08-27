# Tenant–Branch Isolation Flow

Hai sơ đồ dưới đây minh hoạ những điểm chặn truy cập chéo. Chúng dựa trên guard hiện có và các ca trong [authorization guard E2E tests](../../backend/test/authorization-guards.e2e-spec.ts).

## User của branch A gọi URL branch B cùng tenant

```mermaid
sequenceDiagram
  participant U as User có assignment branch A
  participant TCG as TenantContextGuard
  participant TCS as TenantContextService
  participant AG as AuthorizationGuard
  participant AR as Role assignment repository

  U->>TCG: GET /tenants/tenant-a/branches/branch-b/...
  TCG->>TCS: Resolve tenant-a và branch-b
  TCS-->>TCG: Context tenant A, branch B
  TCG->>AG: Context đã xác thực từ URL
  AG->>AR: Active assignment user + tenant A + branch B
  AR-->>AG: Không có assignment phù hợp
  AG-->>U: 403 Forbidden
```

`TenantContextGuard` có thể resolve branch B vì branch này hợp lệ trong tenant A. Chỉ `AuthorizationGuard` quyết định user của branch A không có quyền trên branch B.

## URL ghép branch của tenant B vào tenant A

```mermaid
flowchart TD
  request[GET /tenants/tenant-a/branches/branch-b/...] --> resolveTenant[Resolve tenant-a]
  resolveTenant --> resolveBranch[Tìm branch-b với tenantId của tenant A]
  resolveBranch --> found{Có branch-b trong tenant A?}
  found -- Không: branch-b thuộc tenant B --> notFound[404 Branch not found]
  found -- Có --> authorization[AuthorizationGuard kiểm tra assignment và permission]
```

Branch được tìm bằng cặp `(tenantId đã resolve, branchSlug)`, không phải bằng `branchSlug` đơn lẻ. Vì thế branch của tenant B không thể tạo branch context cho tenant A.

## ID resource ngoài context trong body hoặc path

```mermaid
flowchart TD
  context[Guard đã xác thực tenant và branch context] --> service[Service nhận AuthorizationContext]
  requestId[appointmentId hoặc patientId từ client] --> scopedLookup[Lookup có tenantId từ context và branchId khi áp dụng]
  context --> scopedLookup
  scopedLookup --> matches{Resource thuộc context?}
  matches -- Không --> blocked[Không trả, sửa hoặc tạo liên kết ngoài context]
  matches -- Có --> ownership[Kiểm tra ownership và trạng thái nghiệp vụ]
  ownership --> operation[Thực hiện thao tác được phép]
```

`tenantId`, `branchId`, `tenantSlug` và `branchSlug` trong body/query không được dùng để chọn context hay cấp quyền. Xem [implementation contract](../03-role-workflows.md#108-implementation-contract-cho-scoped-api) để biết quy tắc service đầy đủ.
