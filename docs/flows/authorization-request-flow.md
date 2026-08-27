# Authorization Request Flow

Sơ đồ này mô tả luồng authorization hiện có cho một endpoint protected. Nó không thể hiện `Subscription Guard`, vì guard đó chưa được triển khai.

```mermaid
flowchart TD
  request[Request đến endpoint protected] --> jwt{Access JWT hợp lệ?}
  jwt -- Không --> unauthorized[401 Unauthorized]
  jwt -- Có --> scope{Scope của route?}

  scope -- platform --> platformGuard[PlatformScope và AuthorizationGuard]
  platformGuard --> platformAccess[Tải active platform role assignment]
  platformAccess --> platformPermission{Có role và đủ permission?}
  platformPermission -- Không --> forbidden[403 Forbidden]
  platformPermission -- Có --> platformHandler[Controller và service platform]

  scope -- tenant hoặc branch --> contextGuard[TenantContextGuard]
  contextGuard --> tenantContext[Resolve tenant từ tenantSlug]
  tenantContext --> tenantFound{Tenant tồn tại?}
  tenantFound -- Không --> tenantNotFound[404 Tenant not found]
  tenantFound -- Có --> branchScope{Branch scope?}
  branchScope -- Không --> tenantAuthorization[AuthorizationGuard]
  branchScope -- Có --> branchContext[Resolve branch bằng tenantId và branchSlug]
  branchContext --> branchFound{Branch thuộc tenant trên URL?}
  branchFound -- Không --> branchNotFound[404 Branch not found]
  branchFound -- Có --> tenantAuthorization

  tenantAuthorization --> tenantAccess[Tải active role assignment theo user và context]
  tenantAccess --> tenantPermission{Có role và đủ permission?}
  tenantPermission -- Không --> forbidden
  tenantPermission -- Có --> scopedService[Controller truyền AuthorizationContext vào service]
  scopedService --> ownership{Đúng ownership, trạng thái và scope resource?}
  ownership -- Không --> noCrossContext[Không đọc hoặc ghi resource ngoài context]
  ownership -- Có --> scopedQuery[Query hoặc write luôn kèm tenantId và branchId khi áp dụng]
  scopedQuery --> success[Thực hiện nghiệp vụ]
```

## Cách đọc

- `TenantContextGuard` chỉ xác định tenant/branch mục tiêu từ URL. Nó không kiểm tra quyền của user.
- `AuthorizationGuard` dùng context đã resolve và `userId` trong JWT để kiểm tra active assignment cùng permission. Target tồn tại nhưng user không có scope hoặc thiếu permission trả `403`.
- Service vẫn chịu trách nhiệm kiểm tra ownership/case và chỉ truy vấn trong context đã xác thực. ID từ body chỉ là resource reference, không cấp quyền.

Quy tắc đầy đủ nằm ở [implementation contract](../03-role-workflows.md#108-implementation-contract-cho-scoped-api).
