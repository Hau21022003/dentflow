# Demo và Browser E2E

## Phạm vi

Browser E2E nằm trong `browser-e2e/` và chạy bằng Playwright Chromium. Bộ test kiểm tra luồng giao diện thực tế, hiện bắt đầu với đăng nhập bằng tài khoản synthetic.

Mỗi test browser phải gọi `GET /testing/reset-db` trước khi chạy thông qua helper dùng chung hoặc fixture tự động. Endpoint này chỉ hoạt động khi backend chạy với `NODE_ENV=test`; không có JWT nhưng bị `TestingGuard` chặn ở mọi môi trường khác.

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

## Browser demo quay video

Demo Playwright tách hoàn toàn khỏi regression E2E: file nằm trong
`browser-e2e/demo/` và chỉ được discover bởi `playwright.demo.config.ts`.
`npm run test` vẫn chỉ quét `browser-e2e/tests/`. Demo dùng cùng môi trường
test-only, fixture synthetic và endpoint reset; không chạy nó đồng thời với
`npm run test` vì cùng dùng database reset và port `3001`/`5174`.

Nền demo tự inject caption và marker con trỏ vào browser test. Hai thành phần
này có `pointer-events: none` và chỉ tồn tại trong document Playwright, không
thay đổi client production. `DEMO_PACE` có hai mức: `low` nhanh hơn và
`medium` (mặc định) dễ đọc hơn khi quay video. Mọi pause của demo nằm trong
helper; spec vẫn phải chờ UI/network state thật trước khi giữ hình cho người
xem.

Sau khi đã cài dependency trong `browser-e2e/`, dùng các lệnh sau:

```powershell
# Smoke video: login page, caption và marker cursor; chưa phải flow nghiệp vụ.
npm run demo

# Cùng smoke demo với nhịp nhanh hơn.
npm run demo:low

# Chỉ chạy smoke foundation hoặc xem browser trong lúc quay/tinh chỉnh.
npm run demo:foundation
npm run demo:headed

# Mở HTML report; video/trace/screenshot nằm ở demo-results/.
npm run demo:report
```

Artifact demo được ghi vào `demo-results/` và `demo-report/`, đều không được
git track. Flow trình diễn theo vai trò sẽ được thêm thành file demo riêng sau
khi được duyệt; xem `14-browser-demo-automation-plan.md` để biết phạm vi và
quy tắc mở rộng.

## Dữ liệu synthetic

Seed được tách theo môi trường và luôn nạp theo thứ tự `Tenant → Branch → User → role assignment`. Toàn bộ dữ liệu là synthetic; mọi tài khoản dưới đây có mật khẩu `12345`, chỉ dùng cho development/test local.

`backend/src/database/seeds/dev/` có dữ liệu mở rộng để kiểm tra đa tenant: ba tenant, năm branch và mười một user. Các role đang có gồm một `PLATFORM_ADMIN`, tenant-wide `TENANT_ADMIN`, cùng `BRANCH_ADMIN`, `RECEPTIONIST` và `DENTIST` ở branch scope. `Riverfront Gò Vấp` là branch `INACTIVE` để kiểm tra UI/lifecycle; nó không có grant active.

| Email                                  | Scope / role                                                   |
| -------------------------------------- | -------------------------------------------------------------- |
| `platform.admin@dentflow.local`        | Platform: `PLATFORM_ADMIN`                                     |
| `brightsmile.admin@dentflow.local`     | BrightSmile: `TENANT_ADMIN`, thêm `DENTIST` tại Quận 1         |
| `brightsmile.ops@dentflow.local`       | BrightSmile: `BRANCH_ADMIN` tại Quận 1 và Thủ Đức              |
| `brightsmile.reception@dentflow.local` | BrightSmile Quận 1: `RECEPTIONIST`                             |
| `brightsmile.dentist@dentflow.local`   | BrightSmile Quận 1 và Thủ Đức: `DENTIST`                       |
| `nguyen.minh.tuan@dentflow.local`      | BrightSmile Quận 1: `DENTIST`                                  |
| `tran.ngoc.mai@dentflow.local`         | BrightSmile Quận 1: `DENTIST`                                  |
| `le.hoang.phuc@dentflow.local`         | BrightSmile Quận 1: `DENTIST`                                  |
| `harmony.admin@dentflow.local`         | Harmony: `TENANT_ADMIN`                                        |
| `harmony.reception@dentflow.local`     | Harmony Quận 7: `RECEPTIONIST`                                 |
| `riverfront.admin@dentflow.local`      | Riverfront: `TENANT_ADMIN`, thêm `BRANCH_ADMIN` tại Bình Thạnh |

`backend/src/database/seeds/test/` giữ fixture nhỏ hơn cho test lặp lại: hai tenant, ba branch, tám user, một grant platform và mười grant tenant/branch. Browser E2E tiếp tục dùng `e2e.user@dentflow.test`, hiện là `TENANT_ADMIN` của `BrightSmile Test`. Các fixture test còn lại là `platform.admin@dentflow.test`, `branch.admin@dentflow.test` (`BRANCH_ADMIN` và `RECEPTIONIST` tại Central lẫn West), `dentist@dentflow.test` (`DENTIST` tại Harmony Test), ba Dentist tại Central (`nguyen.minh.tuan@dentflow.test`, `tran.ngoc.mai@dentflow.test`, `le.hoang.phuc@dentflow.test`) và `harmony.admin@dentflow.test` (`TENANT_ADMIN` của Harmony Test).

Mỗi tenant ở cả hai môi trường có cùng catalog synthetic gồm sáu nhóm dịch vụ active và 39 dịch vụ nha khoa active, đều tenant-scoped: Khám & chẩn đoán, Phòng ngừa & nha chu, Phục hồi & nội nha, Nhổ răng & tiểu phẫu, Phục hình & implant, Chỉnh nha & thẩm mỹ. Giá là giá niêm yết tham chiếu bằng VND, còn thời lượng là thời gian ghế ước tính cho một lần hẹn. Vì vậy dev có 18 nhóm/117 dịch vụ và test có 12 nhóm/78 dịch vụ; mã dịch vụ được lặp lại giữa tenant nhưng unique trong từng tenant.

Hai môi trường cũng nạp cùng 22 hồ sơ Patient synthetic vào tenant BrightSmile chính tương ứng (`brightsmile-dental` ở dev và `test-brightsmile` ở test). Dữ liệu có UUID, thời điểm tạo và số điện thoại giả cố định để kết quả tìm kiếm, sắp xếp và phân trang lặp lại được; Patient vẫn chỉ thuộc tenant, nên có thể được tìm thấy từ mọi branch active có quyền của tenant đó. Seed này chỉ có dữ liệu hành chính tối thiểu, không có alert hay dữ liệu clinical.

Hai môi trường nạp thêm 80 Appointment synthetic tại branch BrightSmile chính và các Visit tối thiểu cho ca `IN_PROGRESS` hoặc `COMPLETED`. Fixture lấy ngày hiện tại theo timezone vận hành của branch (`Asia/Ho_Chi_Minh` hiện tại), phân bố 20 lịch trong tháng trước, 40 lịch trong tháng hiện tại và 20 lịch trong tháng kế tiếp. Ngày hiện tại có nhiều lịch phân bổ trên ba Dentist để kiểm tra calendar month và daily timeline; toàn bộ Appointment, Visit và clinical text đều là synthetic. Fixture cũng có Treatment Plan/Item/Event đại diện đủ sáu trạng thái Plan: `DRAFT`, `PROPOSED`, `ACCEPTED`, `PARTIALLY_COMPLETED`, `COMPLETED` và `CANCELLED`. Plan `PROPOSED` hiện trong acceptance queue redacted; các Plan đang/đã hoàn tất dùng event append-only gắn vào Visit `OPEN` của ca tái khám cùng Patient/branch, để kiểm tra execution history mà không tạo thêm Appointment.

Không đưa dữ liệu bệnh nhân thật vào seed hoặc test. Khi bổ sung luồng nghiệp vụ mới, chỉ thêm dữ liệu synthetic với tenant context đã được xác minh bởi backend.

## Reset fixture development

`backend` có hai lệnh dành cho database development local riêng:

```powershell
# Xóa data trong schema public, giữ lại migration history, rồi nạp seeds/dev.
npm run reset:dev

# Apply migration pending, sau đó reset và nạp lại development fixture.
npm run refresh:dev
```

Cả hai lệnh đều yêu cầu `NODE_ENV=development` và
`ALLOW_DEV_DB_RESET=true` trong `backend/.env.development`. Lệnh reset sử dụng
`TRUNCATE … RESTART IDENTITY CASCADE` cho mọi bảng `public` ngoại trừ
`migrations`, nên mọi data development tự tạo sẽ mất. Không chạy khi backend đang
phục vụ request; lệnh không reset Redis, MinIO/S3 hay database schema.

## Storage dependency

Browser E2E tự chạy `docker compose -f docker-compose.minio.yml up -d` và cấu hình backend test dùng MinIO local. Vì vậy Docker Desktop phải đang chạy trước `npm run test`, `test:headed` hoặc `test:ui`. Spec upload mở route test-only `upload-test`, tải một PNG 1×1 synthetic bằng presigned POST và xác nhận phản hồi thành công từ MinIO. Stack MinIO vẫn chạy sau test; dừng khi cần bằng `docker compose -f docker-compose.minio.yml down` từ repository root.

## CI

Workflow `.github/workflows/browser-e2e.yml` tạo PostgreSQL và Redis sạch, sinh `.env.test` từ mẫu; Playwright khởi động MinIO Compose, chạy browser E2E và lưu Playwright HTML report làm artifact. Browser demo chưa là job CI bắt buộc vì video được xem thủ công.
