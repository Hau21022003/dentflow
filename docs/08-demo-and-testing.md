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

Seed được tách theo môi trường và luôn nạp theo thứ tự `Tenant → Branch → User → role assignment`. Toàn bộ dữ liệu là synthetic; mọi tài khoản dưới đây có mật khẩu `12345`, chỉ dùng cho development/test local.

`backend/src/database/seeds/dev/` có dữ liệu mở rộng để kiểm tra đa tenant: ba tenant, năm branch và tám user. Các role đang có gồm một `PLATFORM_ADMIN`, tenant-wide `TENANT_ADMIN`, cùng `BRANCH_ADMIN`, `RECEPTIONIST` và `DENTIST` ở branch scope. `Riverfront Gò Vấp` là branch `INACTIVE` để kiểm tra UI/lifecycle; nó không có grant active.

| Email                                  | Scope / role                                                   |
| -------------------------------------- | -------------------------------------------------------------- |
| `platform.admin@dentflow.local`        | Platform: `PLATFORM_ADMIN`                                     |
| `brightsmile.admin@dentflow.local`     | BrightSmile: `TENANT_ADMIN`, thêm `DENTIST` tại Quận 1         |
| `brightsmile.ops@dentflow.local`       | BrightSmile: `BRANCH_ADMIN` tại Quận 1 và Thủ Đức              |
| `brightsmile.reception@dentflow.local` | BrightSmile Quận 1: `RECEPTIONIST`                             |
| `brightsmile.dentist@dentflow.local`   | BrightSmile Quận 1 và Thủ Đức: `DENTIST`                       |
| `harmony.admin@dentflow.local`         | Harmony: `TENANT_ADMIN`                                        |
| `harmony.reception@dentflow.local`     | Harmony Quận 7: `RECEPTIONIST`                                 |
| `riverfront.admin@dentflow.local`      | Riverfront: `TENANT_ADMIN`, thêm `BRANCH_ADMIN` tại Bình Thạnh |

`backend/src/database/seeds/test/` giữ fixture nhỏ hơn cho test lặp lại: hai tenant, ba branch, bốn user, một grant platform và sáu grant tenant/branch. Browser E2E tiếp tục dùng `e2e.user@dentflow.test`, hiện là `TENANT_ADMIN` của `BrightSmile Test`. Các fixture test còn lại là `platform.admin@dentflow.test`, `branch.admin@dentflow.test` (`BRANCH_ADMIN` và `RECEPTIONIST` tại Central lẫn West) và `dentist@dentflow.test` (`DENTIST` tại Harmony Test).

Mỗi tenant ở cả hai môi trường có cùng catalog synthetic gồm sáu nhóm dịch vụ active và 39 dịch vụ nha khoa active, đều tenant-scoped: Khám & chẩn đoán, Phòng ngừa & nha chu, Phục hồi & nội nha, Nhổ răng & tiểu phẫu, Phục hình & implant, Chỉnh nha & thẩm mỹ. Giá là giá niêm yết tham chiếu bằng VND, còn thời lượng là thời gian ghế ước tính cho một lần hẹn. Vì vậy dev có 18 nhóm/117 dịch vụ và test có 12 nhóm/78 dịch vụ; mã dịch vụ được lặp lại giữa tenant nhưng unique trong từng tenant.

Không đưa dữ liệu bệnh nhân thật vào seed hoặc test. Khi bổ sung luồng nghiệp vụ mới, chỉ thêm dữ liệu synthetic với tenant context đã được xác minh bởi backend.

## CI

Workflow `browser-e2e/.github/workflows/playwright.yml` tạo PostgreSQL và Redis sạch, sinh `.env.test` từ mẫu, chạy browser E2E và lưu Playwright HTML report làm artifact.
