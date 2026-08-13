# Demo và Browser E2E

## Phạm vi

Browser E2E nằm trong `browser-e2e/` và chạy bằng Playwright Chromium. Bộ test kiểm tra luồng giao diện thực tế, hiện bắt đầu với đăng nhập bằng tài khoản synthetic.

Mỗi file spec phải gọi `GET /testing/reset-db` trong `beforeAll` thông qua helper dùng chung. Endpoint này chỉ hoạt động khi backend chạy với `NODE_ENV=test`; không có JWT nhưng bị `TestingGuard` chặn ở mọi môi trường khác.

## Môi trường test

Tạo cấu hình local từ mẫu:

```powershell
Copy-Item backend/.env.test.example backend/.env.test
```

`DB_NAME` trong `.env.test` phải là database dành riêng cho test. Tuyệt đối không trỏ nó vào database development, staging hoặc production vì reset sẽ truncate toàn bộ bảng dữ liệu trong schema `public`, ngoại trừ lịch sử migration.

Playwright chạy `npm run migration:test:run` trước khi mở API. Endpoint reset chỉ truncate dữ liệu hiện hữu và nạp lại các file SQL trong `backend/src/database/seeds/test/`; nó không chạy migration.

## Chạy local

Khởi động PostgreSQL và Redis theo cấu hình `.env.test`, sau đó:

```powershell
cd browser-e2e
npm install
npx playwright install chromium
npm run test
```

Các lệnh hỗ trợ:

```powershell
npm run test:headed
npm run test:ui
npm run report
```

Playwright tự chạy backend ở `http://127.0.0.1:3001` và frontend ở `http://127.0.0.1:5174`; không tái sử dụng các process đang chạy để luôn dùng đúng môi trường test.

## Dữ liệu synthetic

Tài khoản browser E2E được seed lại trước mỗi file test:

| Email                    | Password                 | Mục đích                                                           |
| ------------------------ | ------------------------ | ------------------------------------------------------------------ |
| `e2e.user@dentflow.test` | `synthetic-e2e-password` | Kiểm tra đăng nhập UI và làm fixture cho các browser E2E tiếp theo |

Không đưa dữ liệu bệnh nhân thật vào seed hoặc test. Khi bổ sung luồng nghiệp vụ mới, chỉ thêm dữ liệu synthetic với tenant context đã được xác minh bởi backend.

## CI

Workflow `browser-e2e/.github/workflows/playwright.yml` tạo PostgreSQL và Redis sạch, sinh `.env.test` từ mẫu, chạy browser E2E và lưu Playwright HTML report làm artifact.
