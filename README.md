# DentFlow

**DentFlow** là nền tảng SaaS đa tenant hỗ trợ chuỗi và phòng khám nha khoa vận hành xuyên suốt hành trình bệnh nhân — từ đặt lịch, tiếp đón, khám/điều trị đến thu phí và tái khám.

> Dự án portfolio đang trong quá trình phát triển, sử dụng hoàn toàn dữ liệu bệnh nhân giả lập.

## Điểm nổi bật

- **Multi-tenant an toàn:** dữ liệu được cô lập theo phòng khám và chi nhánh đã xác thực; không tin cậy tenant ID do client tự gửi.
- **Phân quyền theo ngữ cảnh:** Platform Admin, Tenant Admin, Branch Admin, Receptionist và Dentist có phạm vi truy cập riêng theo tổ chức/chi nhánh.
- **Workflow nghiệp vụ chặt chẽ:** quản lý trạng thái lịch hẹn, ca khám, kế hoạch điều trị, hóa đơn, thanh toán và tái khám.
- **Audit & tính toàn vẹn:** ghi nhận thay đổi nghiệp vụ, command idempotent và kiểm soát các thao tác tài chính.
- **Tách bạch dòng tiền:** subscription SaaS của phòng khám độc lập với khoản thanh toán điều trị của bệnh nhân.

## Công nghệ

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: NestJS, TypeScript, REST API
- Data & infrastructure: PostgreSQL, TypeORM, Redis/BullMQ, S3/MinIO, Docker Compose
- Quality: Jest và Playwright E2E

## Cấu trúc

```text
client/       # Ứng dụng web vận hành phòng khám
backend/      # API, xác thực, phân quyền và nghiệp vụ
browser-e2e/  # Kịch bản kiểm thử đầu-cuối
docs/         # Product, workflow và quyết định kiến trúc
```

Chi tiết về bài toán, các luồng nghiệp vụ và quyết định thiết kế nằm trong [docs/README.md](./docs/README.md).
