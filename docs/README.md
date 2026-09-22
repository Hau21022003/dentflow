# DentFlow Documentation

Thư mục này là nguồn thông tin sản phẩm và kỹ thuật chính của DentFlow. Khi xây dựng hoặc thay đổi tính năng, đọc tài liệu theo thứ tự dưới đây và cập nhật tài liệu liên quan cùng thay đổi mã nguồn.

| Tài liệu                                           | Mục đích                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [00-product-plan.md](./00-product-plan.md)         | Phạm vi sản phẩm, mô hình tenant, quy trình nha khoa và roadmap                        |
| [01-payment-model.md](./01-payment-model.md)       | Hai dòng tiền, billing SaaS, thanh toán điều trị và ranh giới trách nhiệm              |
| [02-platform-admin.md](./02-platform-admin.md)     | Vận hành Platform Admin: tenant lifecycle, SaaS billing, support và kiểm soát hệ thống |
| [03-role-workflows.md](./03-role-workflows.md)     | Phạm vi quyền, bàn giao công việc và luồng hằng ngày của từng vai trò                  |
| [04-tenant-admin.md](./04-tenant-admin.md)         | Vận hành Tenant Admin: cấu hình tenant, chi nhánh, nhân sự, giám sát và SaaS billing   |
| [05-audit-log.md](./05-audit-log.md)               | Audit nghiệp vụ append-only, payload an toàn, API đọc và retention                     |
| [06-domain-workflows.md](./06-domain-workflows.md) | Contract MVP Patient, lịch hẹn, khám, điều trị, thu phí và tái khám                    |
| [08-demo-and-testing.md](./08-demo-and-testing.md) | Tài khoản dữ liệu mẫu, browser E2E và môi trường test tách biệt                        |
| [09-idempotency-implementation-plan.md](./09-idempotency-implementation-plan.md) | Quyết định kỹ thuật và lộ trình triển khai idempotency cho command backend |
| [10-background-jobs-architecture.md](./10-background-jobs-architecture.md) | Kiến trúc BullMQ, worker và quy ước background job backend |
| [12-email-template-management.md](./12-email-template-management.md) | Template email hệ thống, publish revision và tích hợp delivery |
| [13-file-storage.md](./13-file-storage.md) | Direct upload ảnh tạm qua S3/MinIO, tenant isolation và vận hành bucket |
| [14-browser-demo-automation-plan.md](./14-browser-demo-automation-plan.md) | Kế hoạch Playwright demo có caption, con trỏ và nhịp quay video riêng |
| [flows/README.md](./flows/README.md)               | Sơ đồ Mermaid đọc nhanh cho developer; không thay thế tài liệu domain chuẩn            |

## Quy ước làm việc với Codex

- Đọc tài liệu liên quan trước khi thiết kế API, schema hoặc UI; không suy diễn quyền truy cập và dòng tiền chỉ từ tên entity.
- Một tài liệu tập trung vào một domain. Dùng tiền tố số để giữ thứ tự đọc ổn định.
- Ghi rõ điều đã quyết định, điều chưa làm và lý do; tránh tài liệu chỉ mô tả ý tưởng chung chung.
- Khi API, entity, trạng thái nghiệp vụ hoặc quyền thay đổi, cập nhật tài liệu domain trong cùng pull request/commit.
- Dùng dữ liệu synthetic trong seed, ảnh demo và test; không đưa thông tin bệnh nhân thật vào repository.

## Tài liệu sẽ bổ sung khi triển khai

- `07-architecture.md`: ranh giới frontend/API/database, tenant context, auth và deployment.
- `11-api-contracts.md`: quy ước REST, lỗi, pagination và webhook; idempotency theo contract tại `09-idempotency-implementation-plan.md`.
