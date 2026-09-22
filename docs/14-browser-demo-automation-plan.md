# Kế hoạch Browser Demo Automation

> Trạng thái: **nền đã triển khai**. Config riêng, helper pace/caption/cursor,
> smoke demo, script npm và artifact isolation đã có trong source. Flow trình
> diễn nghiệp vụ cho nhà tuyển dụng vẫn là hạng mục kế tiếp, chưa được thêm.

## Mục tiêu

Tạo một bộ Playwright riêng để quay demo sản phẩm cho nhà tuyển dụng. Bộ này
phải thể hiện rõ từng thao tác bằng caption trên màn hình, con trỏ chuột hiển
thị trong video, và nhịp thao tác có thể lặp lại theo hai mức `low` và
`medium`.

Đây là browser automation cho trình diễn, không phải bộ kiểm thử regression.
Nó vẫn thực hiện thao tác thật và chỉ chuyển bước sau khi UI hoặc API đã đạt
trạng thái mong đợi.

## Ranh giới bắt buộc

- Browser E2E hiện hữu chỉ nằm trong `browser-e2e/tests/` và tiếp tục chỉ chạy
  qua `npm run test`, `test:headed` và `test:ui`.
- Demo nằm riêng tại `browser-e2e/demo/`, chạy bằng
  `playwright.demo.config.ts`. Config thường có `testDir: "./tests"` không
  được mở rộng để quét `demo/`.
- Không import một file spec từ `tests/` vào demo hoặc ngược lại. Demo chỉ có
  thể dùng các helper setup thuần như `tests/support/database.ts` và
  `tests/support/login.ts`; nếu cần dùng chung nhiều hơn, tách helper ra file
  support độc lập thay vì phụ thuộc giữa các spec.
- Demo và browser E2E đều dùng database `NODE_ENV=test`, fixture test và
  `GET /testing/reset-db`; không dùng dữ liệu development, staging,
  production hay bệnh nhân thật. Mỗi demo spec reset fixture trước mỗi test.
- Không chạy `npm run test` và một lệnh `demo:*` đồng thời: chúng dùng cùng
  database reset endpoint và các port test `3001`/`5174`.
- Không đưa demo vào CI bắt buộc ở giai đoạn đầu. Video là artifact để xem
  thủ công; CI regression hiện tại vẫn chỉ chạy `npm run test`.

## Cấu trúc nền đã thêm

```text
browser-e2e/
  demo/
    foundation.demo.spec.ts     # smoke: login, caption, marker cursor
    support/
      demo.fixture.ts          # reset fixture, cài overlay, chọn pace
      demo-narrator.ts         # caption và các pause có chủ đích
      demo-cursor.ts           # đưa con trỏ tới locator rồi click/type
      demo-pace.ts             # validate DEMO_PACE và thời lượng
  playwright.demo.config.ts    # chỉ discover ./demo
  demo-results/                # video, trace, screenshot; gitignored
  demo-report/                 # HTML report; gitignored
```

`playwright.config.ts` và `playwright.demo.config.ts` đã dùng chung các phần
an toàn trong `playwright.shared.ts`: Chromium desktop, `global-setup.ts`, hai
web server test, base URL, secrets test-only và một worker. Config E2E thường
vẫn giữ `testDir: "./tests"` và các reporter/artifact path hiện tại.

Config demo sẽ có các khác biệt sau:

- `testDir: "./demo"`, `outputDir: "demo-results"` và HTML report ở
  `demo-report` để không ghi đè `test-results` hay `playwright-report`.
- `workers: 1`, `retries: 0`, Chromium desktop, và video/trace/screenshot bật
  cho mỗi demo run. Retry có thể làm video lặp hành động và làm khó chọn file
  để dựng.
- Vẫn dùng `reuseExistingServer: false`, do đó chỉ khởi động backend/frontend
  test đúng cấu hình thay vì bám vào một server người dùng đang chạy.
- `tsconfig.json` được mở rộng để type-check config và file trong `demo/`.
  `.gitignore` được bổ sung `demo-results/` và `demo-report/`.

## Nhịp trình diễn và quy tắc chờ

`DEMO_PACE` chỉ nhận `low` hoặc `medium`; thiếu biến thì mặc định `medium`.
Giá trị sai phải fail sớm với thông báo rõ ràng thay vì quay video có tốc độ
không xác định.

| Nhịp có chủ đích | `low` | `medium` | Khi dùng |
| --- | ---: | ---: | --- |
| Caption trước thao tác | 300 ms | 700 ms | Để người xem đọc bước sắp làm |
| Giữ sau kết quả | 450 ms | 900 ms | Để người xem thấy thay đổi đã xong |
| Giữ sau chuyển trang/dialog | 650 ms | 1.300 ms | Để định vị ngữ cảnh mới |
| Gõ từng ký tự | 45 ms | 90 ms | Chỉ cho dữ liệu cần nhìn thấy đang được nhập |

Các số trên là điểm khởi đầu, sẽ điều chỉnh sau một video thử nghiệm ở độ phân
giải mục tiêu. `low` nghĩa là nhanh hơn, còn `medium` là nhịp mặc định phù hợp
để quay cho người xem mới.

Mọi `waitForTimeout` chỉ được đặt bên trong `demo-narrator.ts`/`demo-pace.ts`
với tên ngữ nghĩa như `holdCaption` hoặc `holdResult`. Spec không được có
sleep trần. Trước một pause, test phải dùng đúng loại chờ thật:

- `expect(locator).toBeVisible()` hoặc `toHaveText()` cho thay đổi UI;
- `waitForResponse`/`waitForRequest` với method và path cụ thể cho mutation;
- `toHaveURL` hoặc `waitForLoadState` cho điều hướng.

Như vậy pause chỉ phục vụ người xem video, không phải cách che flaky test.

## Caption và con trỏ trong video

Không dựa vào con trỏ hệ điều hành: nó không được Playwright video recorder
đảm bảo ghi lại. `demo.fixture.ts` sẽ inject một overlay chỉ trong document
test, gồm:

- caption cố định ở vùng an toàn, ví dụ `Bước 3 — Tạo lịch hẹn cho bệnh nhân`;
- marker con trỏ chuột có hiệu ứng click nhỏ;
- `aria-hidden="true"`, `data-demo-overlay` và `pointer-events: none` để không
  ảnh hưởng accessibility tree, locator hoặc thao tác sản phẩm.

Helper con trỏ sẽ scroll locator vào vùng nhìn thấy, lấy `boundingBox`, di
chuyển `page.mouse` có bước nhỏ, cập nhật marker rồi mới click. Helper nhập
liệu sẽ caption, focus field, xóa giá trị khi cần và dùng
`pressSequentially(..., { delay })` theo pace. Overlay được cài lại sau điều
hướng để không mất caption/con trỏ khi document thay đổi.

Chỉ demo browser mới có overlay; không thêm component, CSS, route hay flag
vào `client/`.

## Flow demo đầu tiên

File đầu tiên là `receptionist-appointment.demo.spec.ts`, gắn tag
`@demo @recruiter @receptionist`. Flow được chọn vì dùng hành vi đã có trong
application và thể hiện một vòng thao tác rõ ràng của lễ tân:

1. Reset fixture test, mở trang đăng nhập và đăng nhập bằng tài khoản
   `branch.admin@dentflow.test` (synthetic, có quyền `BRANCH_ADMIN` và
   `RECEPTIONIST` tại branch test).
2. Đi tới lịch hẹn của branch context đã được backend xác minh.
3. Mở **Create appointment**, mở dialog **Add patient**, rồi tạo một bệnh nhân
   mang tên/số điện thoại synthetic duy nhất cho demo.
4. Điền thời gian hẹn và lý do hẹn synthetic, tạo lịch hẹn và đợi phản hồi
   mutation cùng lúc với dialog đóng.
5. Mở chi tiết lịch hẹn mới, xác nhận lịch hẹn và chỉ kết thúc khi trạng thái
   **Confirmed** hiển thị.

Mỗi bước trên có một caption ngắn, di chuyển con trỏ trước thao tác và giữ kết
quả theo `DEMO_PACE`. Test không dùng API để tạo sẵn bệnh nhân/lịch hẹn, ngoài
reset fixture; video vì thế thể hiện luồng UI thật. Cần chọn ngôn ngữ UI và
copy caption nhất quán trước khi code (khuyến nghị caption tiếng Việt, có thể
song ngữ nếu video hướng tới tuyển dụng quốc tế).

Các demo tiếp theo chỉ được thêm sau khi flow đầu tiên ổn định và phải là file
riêng theo vai trò, ví dụ `tenant-admin-staff.demo.spec.ts` hoặc
`dentist-visit.demo.spec.ts`. Luồng dentist visit chỉ được lên lịch sau khi
module visits hiện tại hoàn chỉnh và có E2E regression ổn định; không ghép nó
vào video đầu tiên.

## Script `package.json` đã thêm

Để biến môi trường hoạt động giống nhau trên PowerShell, cmd và shell CI,
đã thêm `cross-env` vào `devDependencies` của `browser-e2e` và cập nhật
`package-lock.json` bằng npm. Toàn bộ script `test:*` được giữ nguyên; các
script demo hiện có là:

```json
{
  "scripts": {
    "demo": "cross-env DEMO_PACE=medium playwright test --config=playwright.demo.config.ts",
    "demo:low": "cross-env DEMO_PACE=low playwright test --config=playwright.demo.config.ts",
    "demo:headed": "cross-env DEMO_PACE=medium playwright test --config=playwright.demo.config.ts --headed",
    "demo:foundation": "cross-env DEMO_PACE=medium playwright test --config=playwright.demo.config.ts --grep @foundation",
    "demo:report": "playwright show-report demo-report"
  }
}
```

`demo` và `demo:low` đều tạo video vì đó là option của demo config, không phải
vì browser ở headed mode. `demo:headed` dùng khi người quay cần xem trực tiếp
và tinh chỉnh pacing/caption. File video WebM sẽ nằm bên dưới
`browser-e2e/demo-results/`; HTML report mở bằng `npm run demo:report`.
`demo:receptionist` sẽ chỉ được thêm cùng flow lễ tân thực tế để tránh tồn tại
một script lọc test chưa có.

## Trình tự triển khai lần sau

1. Đã đọc lại `docs/08-demo-and-testing.md`, thêm shared Playwright config,
   demo config, TypeScript include, artifact ignore, `cross-env` và smoke
   `@foundation` để xác nhận config không discover `tests/`.
2. Đã viết helper pace/narrator/cursor và smoke xác nhận caption/marker xuất
   hiện trên trang login. Một assertion click qua overlay và assertion sau điều
   hướng sẽ được thêm cùng flow đầu tiên.
3. Viết flow lễ tân theo từng bước, với assertion/network wait trước mọi hold;
   dùng duy nhất dữ liệu synthetic.
4. Quay `medium` và `low`, kiểm tra thủ công video ở kích thước phát hành rồi
   điều chỉnh bảng thời gian nếu caption không đủ dễ đọc.
5. Cập nhật tài liệu này nếu có quyết định khác với kế hoạch.

## Tiêu chí nghiệm thu

- `npm run test` chỉ discover `browser-e2e/tests/` và vẫn qua như trước.
- `npm run demo:foundation` chỉ discover smoke demo được gắn tag foundation,
  reset fixture test và sinh video/report ở đường dẫn demo riêng.
- Video `low` lẫn `medium` thể hiện caption đúng thứ tự, marker con trỏ trước
  click/nhập, kết quả thao tác thật và không có overlay che/cướp click.
- Không có artifact demo được git track; không có source production, route,
  role, API, schema hay payment behavior nào bị thay đổi.
- Chạy `npx tsc --noEmit` trong `browser-e2e` và kiểm tra ít nhất một video
  headed trước khi bàn giao cho quay/dựng.

## Rủi ro đã biết

| Rủi ro | Cách kiểm soát |
| --- | --- |
| Demo và regression chạy đồng thời làm reset DB/đụng port | Quy ước chạy tuần tự; config đều dùng một worker và server test riêng. |
| Sleep làm test flaky hoặc video không đồng bộ | Chỉ helper narration được pause; state thật luôn được assert/chờ trước. |
| Cursor hệ điều hành mất trong video | Dùng marker DOM test-only, không dựa vào OS cursor. |
| Overlay ảnh hưởng UI hoặc locator | `pointer-events: none`, fixed layer, `aria-hidden`, data attribute riêng; có test click smoke cho overlay. |
| Video lộ dữ liệu nhạy cảm | Chỉ dùng fixture/tên/số điện thoại synthetic; không dùng account hay dữ liệu môi trường thật. |
| UI/copy đổi làm demo hỏng | Locator ưu tiên role/label/test id ổn định, reviewer xem video sau mỗi thay đổi luồng. |
