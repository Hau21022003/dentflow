# DentFlow — Kế hoạch triển khai Idempotency

> Trạng thái triển khai (2026-09-24): Foundation, Pilot Plan, tenant lifecycle, Patient administrative, Appointment V1, Visit V1 và Treatment Plan/Item Backend V1 đã được thực hiện. Treatment dùng key riêng cho create, draft-sync, propose, reopen, cancel, accept và record item event. Financial command, provider checkout và webhook vẫn là các giai đoạn rollout sau. Retention `IdempotencyRecord` chạy trực tiếp trong API mỗi ngày lúc 03:15 UTC bằng Nest Scheduler; không dùng queue hoặc worker riêng cho tác vụ xóa idempotent này.

Sơ đồ đọc nhanh cho developer: [Idempotency request flow](./flows/idempotency-request-flow.md).

## 1. Trạng thái và mục tiêu

Tài liệu này chốt hướng triển khai trước khi viết code. Mục tiêu là để một command backend được retry do timeout, mất response hoặc gửi trùng trả lại cùng outcome đã lưu, mà không phải thêm idempotency logic vào từng service.

Idempotency khác với `X-Request-Id`:

- `X-Request-Id` là correlation ID cho technical log và `AuditLog`; mỗi HTTP request có thể có request ID khác nhau.
- `Idempotency-Key` biểu thị một ý định command của client và phải được tái sử dụng cho mọi lần retry của cùng ý định đó.

Đây là idempotency **best effort**: không cam kết “exactly once” với database hay side effect bên ngoài. Kế hoạch chủ động chấp nhận khe lỗi hiếm khi service đã commit dữ liệu nhưng process/database connection chết trước khi interceptor lưu outcome. Khi gọi provider có hỗ trợ idempotency, caller vẫn truyền provider key ổn định.

## 2. API contract đã chốt

- Command được đánh dấu idempotent bắt buộc nhận header `Idempotency-Key`. MVP nhận UUID v4 do first-party client tạo bằng `crypto.randomUUID()`; không nhận key qua body.
- Client tạo key một lần khi bắt đầu submit, giữ lại qua retry tự động/thủ công, và tạo key mới cho một ý định mới.
- Uniqueness chỉ là `(actorUserId, idempotencyKeyHash)`. Không đưa `tenantId`, `branchId` hoặc operation code vào unique constraint.
- Fingerprint của request vẫn phải là HMAC của operation version, HTTP method, resource ID trên URL, body/query có ảnh hưởng nghiệp vụ và tenant/branch context **đã được server resolve**. Client không thể đưa tenant/branch vào body để ảnh hưởng fingerprint hoặc scope.
- Lookup idempotency diễn ra sau authentication, tenant/branch context resolution, Subscription Guard và authorization. Một actor đã mất quyền luôn nhận `403`, không được replay response cũ.
- Cùng actor, key và fingerprint trả lại nguyên HTTP outcome đã lưu: status, JSON body và các response header có thể replay. Outcome được snapshot từ kết quả controller trả về; retry thêm `Idempotency-Replayed: true`.
- Cùng actor/key nhưng fingerprint khác trả `409 idempotency_key_reused_with_different_request`, không tiết lộ outcome cũ.
- Thiếu hoặc sai header trả lỗi validation; các lỗi authentication/authorization xảy ra trước interceptor không tiêu tốn key. Nếu handler trả lỗi, interceptor xóa record `PROCESSING` để client có thể retry.
- Khi request trùng đang chạy hoặc còn `PROCESSING`, trả `409 idempotency_request_in_progress` cùng `Retry-After`; client retry lại với chính key đó.
- `PROCESSING` có lease ngắn, cấu hình được (mặc định 5 phút). Sau khi lease hết hạn, retry cùng key được phép chạy lại command. Nếu lần chạy trước đã commit nhưng chưa kịp lưu outcome, lần chạy lại có thể tạo kết quả trùng; đây là giới hạn đã được chấp nhận của hướng best effort.
- Record là technical data nội bộ, không có API đọc. Key và fingerprint chỉ lưu dạng HMAC, không lưu raw key/body. Record `COMPLETED` được giữ mặc định 30 ngày; nó không thay thế `AuditLog` tối thiểu 7 năm.

### 2.1. Quy ước client frontend

Frontend chỉ gửi `Idempotency-Key` cho command mà API contract yêu cầu; việc có
field `idempotencyKey` trong type không tự làm endpoint trở thành idempotent.

- UI tạo intent ngay trước khi submit bằng
  `idempotencyKeyForIntent(currentIntent, command)`. `command` phải chứa operation,
  resource ID trên URL khi có, và payload cuối cùng sẽ gửi. Hàm giữ UUID hiện có khi
  command không đổi, hoặc tạo UUID v4 mới khi command thay đổi.
- Giữ `IdempotencyIntent` trong state hoặc `useRef` của luồng UI để một lần retry do
  timeout, mất response, hoặc lỗi tạm thời dùng lại đúng key. Khi command thành công,
  người dùng hủy/đóng luồng, hoặc bắt đầu một intent mới, xóa intent cũ.
- Mutation service nhận command kế thừa `IdempotentCommand` và truyền
  `{ idempotencyKey }` cho `http.post`, `http.patch`, `http.put` hoặc `http.delete`.
  Không truyền `Idempotency-Key` thủ công trong `headers`.
- `CustomOptions.idempotencyKey` trong `client/src/shared/lib/http.ts` chuyển giá trị
  thành header `Idempotency-Key`. Giá trị custom option được ưu tiên nếu cả option và
  raw header cùng được truyền. Khi HTTP client retry request sau khi refresh token,
  options gốc được giữ lại nên key không đổi.
- Không sinh key trong HTTP client, service, hoặc render UI: các lớp này không biết
  ranh giới một command intent. Mỗi UI flow chịu trách nhiệm cung cấp command đã
  canonicalized cho `idempotencyKeyForIntent`.
- Với `409 idempotency_request_in_progress`, giữ key hiện tại và chỉ retry theo
  `Retry-After`. Với `409 idempotency_key_reused_with_different_request`, báo lỗi;
  không tự sinh key mới rồi gửi lại vì điều đó có thể biến một retry thành command mới.

Ví dụ type dùng chung:

```ts
type CreatePlanCommand = IdempotentCommand & {
  input: CreateSubscriptionPlanInput;
};
```

Quy ước này hiện áp dụng cho pilot Plan. Không áp dụng nó cho `GET`, login/refresh,
webhook, hoặc command chưa được backend đánh dấu idempotent.

## 3. Kiến trúc thực thi

Developer chỉ khai báo policy tại controller:

```text
@Idempotent('platform.plan.create')
POST /platform/plans
```

`@Idempotent()` chỉ gắn metadata. Một global `IdempotencyInterceptor` chỉ kích hoạt với route có metadata và làm toàn bộ phần dùng chung: validate header, tạo fingerprint, claim/replay result và lưu outcome. Service nghiệp vụ không import module idempotency, không tự claim/check key và không tự lưu response idempotency.

Interceptor không mở transaction bao quanh handler; Plan/Tenant service và mọi service hiện có tiếp tục sở hữu transaction của chúng như hiện tại. Luồng thực thi là:

1. Sau guard, interceptor tạo fingerprint và thử tạo `IdempotencyRecord(PROCESSING)` trong một transaction ngắn. Unique constraint `(actorUserId, idempotencyKeyHash)` xử lý request đồng thời.
2. Nếu record đã `COMPLETED` và fingerprint trùng, interceptor trả HTTP outcome đã snapshot. Nếu fingerprint khác, trả `409`; nếu record còn `PROCESSING`, trả `409` cùng `Retry-After`.
3. Nếu claim thành công, interceptor gọi controller; controller và service chạy hoàn toàn bình thường, dùng transaction riêng hiện có để lưu business data và `AuditLog`.
4. Khi controller trả thành công, interceptor lưu HTTP outcome vào record và chuyển sang `COMPLETED` trong một transaction ngắn riêng.
5. Khi handler trả lỗi, interceptor xóa `PROCESSING`; khi process chết giữa bước 3 và 4, record hết lease theo policy ở mục 2.

Khe lỗi giữa bước 3 và 4 là đánh đổi chủ động để không buộc service dùng chung `EntityManager` hoặc thay `dataSource.transaction(...)`. Không dùng Redis/cache làm nguồn quyết định; PostgreSQL unique constraint là nguồn xử lý request trùng giữa nhiều API instance.

`IdempotencyRecord` tối thiểu gồm actor user ID, key HMAC, request fingerprint HMAC, trạng thái `PROCESSING`/`COMPLETED`, thời điểm hết lease `PROCESSING`, HTTP status, nguyên response JSON do controller trả về, các response header có thể replay, thời điểm tạo/hoàn tất/hết hạn và request ID gốc để tra cứu nội bộ. Tenant/branch không là một phần của entity uniqueness; chúng chỉ nằm trong fingerprint do server tạo.

## 4. Phạm vi endpoint

Áp dụng decorator cho mọi command mới có thể tạo dữ liệu, chuyển trạng thái, tạo financial record hoặc gây side effect. Không áp dụng cho `GET`/`HEAD`; `DELETE` chỉ áp dụng nếu sau này có side effect hay audit command riêng.

Ưu tiên theo rủi ro:

1. `POST /platform/plans` và `PATCH /platform/plans/:planId` để kiểm chứng decorator/interceptor mà không sửa transaction hay business logic của module Plan.
2. Tenant lifecycle: create tenant, resend invitation, extend trial, suspend và reactivate.
3. Clinical command: tạo patient/appointment/visit/treatment plan, các state transition, tạo invoice, payment, refund và adjustment.
4. SaaS checkout: truyền provider idempotency key ổn định suy ra từ Idempotency-Key. Không gọi provider lại khi replay command đã `COMPLETED`.

Payment điều trị cần thêm invariant domain ngoài idempotency: lock invoice khi tính số dư, UI chống double-submit và unique transaction reference phù hợp cho `BANK_TRANSFER`/`CARD`. Hai key khác nhau vẫn là hai command khác nhau; idempotency không được dùng để suy đoán hai payment độc lập có phải trùng nghiệp vụ hay không.

## 5. Webhook và auth là luồng riêng

Webhook không có authenticated user nên không dùng `Idempotency-Key` chung. Sau khi xác minh chữ ký provider, webhook processor dedupe bằng `providerEventId` unique trong `PaymentEvent`, xử lý state change trong transaction và cho phép Platform Admin retry phần xử lý nội bộ. Retry không được tạo Checkout Session hoặc charge mới.

Login và refresh token rotation không vào generic decorator trong đợt này; cookie/token rotation cần contract retry riêng. Logout idempotent theo trạng thái và không cần key.

## 6. Các giai đoạn thực hiện

### Giai đoạn 1 — Foundation

- Thêm migration/entity/repository cho `IdempotencyRecord`, cấu hình secret HMAC và chính sách retention.
- Thêm `@Idempotent()` và global interceptor; không thêm `UnitOfWork` hay thay đổi transaction của service.
- Chuẩn hóa error response/header, snapshot/restore toàn bộ HTTP outcome của controller và lease cho `PROCESSING`.

### Giai đoạn 2 — Pilot Plan

- Gắn decorator cho create/update plan mà không refactor service.
- Viết integration test concurrency và replay trước khi áp dụng cho module khác.

### Giai đoạn 3 — Rollout command nghiệp vụ

- Áp dụng decorator cho command tenant lifecycle, clinical và financial theo mức rủi ro đã chọn.
- Giữ transaction hiện có của từng mutation service; không yêu cầu `UnitOfWork` hoặc manager dùng chung.
- Cập nhật tài liệu domain/API của từng module trong cùng PR.
- Đã rollout: Patient administrative create/update; Appointment V1 create/update, confirm, check-in, assign, cancel, no-show; Visit V1 start, update, complete, create addendum; và Treatment Plan/Item V1 create, draft-sync, propose, reopen, direct cancel, accept, record item event. Financial command vẫn chưa rollout.

### Giai đoạn 4 — Provider và webhook

- Propagate provider key ổn định cho checkout; transactional outbox chưa thuộc phạm vi kế hoạch này.
- Triển khai `PaymentEvent.providerEventId` unique sau signature verification.
- Khi webhook hoặc notification cần xử lý nền, áp dụng kiến trúc BullMQ tại [10-background-jobs-architecture.md](./10-background-jobs-architecture.md); BullMQ không thay thế provider key, `providerEventId` hay idempotency processor.

## 7. Acceptance tests bắt buộc

- Retry một command thành công bằng cùng key không tạo thêm resource, payment, state transition hoặc audit row.
- Giả lập response bị mất sau commit: retry trả cùng HTTP status, body và response header đã snapshot của command ban đầu.
- Hai request đồng thời cùng key chỉ commit một command; request còn lại replay hoặc nhận `idempotency_request_in_progress`.
- Giả lập record còn `PROCESSING`: trước khi hết lease trả `409`; sau lease, retry được phép chạy command lại. Test này ghi nhận rủi ro có thể tạo kết quả trùng nếu process đã chết sau business commit nhưng trước lúc lưu outcome.
- Reuse key với body, resource, operation hoặc tenant/branch context khác trả mismatch `409` và không làm lộ result cũ.
- Actor không có JWT, mất assignment hoặc sai tenant/branch vẫn nhận lỗi guard tương ứng trước lookup/replay.
- Lỗi handler có thể retry lại với cùng key sau khi record `PROCESSING` được xóa; record mồ côi chỉ được xử lý bằng lease sau unexpected process failure.
- Audit log và mutation vẫn commit/rollback theo transaction hiện hữu của service; idempotency outcome được lưu tách riêng theo kiến trúc best effort.
- Checkout/provider retry và webhook duplicate không tạo side effect hoặc subscription/payment transition lặp.

## 8. Không làm trong đợt foundation

- Không tạo generic API để xem, sửa hoặc xóa idempotency records.
- Không dùng `X-Request-Id` làm key idempotency.
- Không áp dụng generic decorator cho auth refresh/login hay webhook.
- Không thay idempotency bằng cache, Redis lock đơn lẻ hoặc unique business field.
