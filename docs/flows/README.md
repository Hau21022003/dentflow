# DentFlow — Flow Diagrams

Thư mục này chứa sơ đồ Mermaid để developer nắm nhanh các luồng kỹ thuật quan trọng. Sơ đồ được lưu dạng Markdown để review và cập nhật cùng code; nếu trình xem không render Mermaid, nội dung văn bản vẫn mô tả được luồng.

Sơ đồ **không** thay thế quy tắc domain hoặc implementation contract. Khi có khác biệt, tài liệu domain là nguồn quyết định:

- [Authorization request flow](./authorization-request-flow.md): thứ tự JWT, context, role/permission và service.
- [Tenant–branch isolation flow](./tenant-branch-isolation.md): các tình huống truy cập chéo tenant/branch.
- [Audit log write flow](./audit-log-write-flow.md): context request, transaction nghiệp vụ và bản ghi audit append-only.
- [Role workflows và implementation contract](../03-role-workflows.md): quy tắc authorization chuẩn.

Đọc hai sơ đồ trước để định hướng, rồi đọc mục 10.8 của `03-role-workflows.md` trước khi thêm API nghiệp vụ.
