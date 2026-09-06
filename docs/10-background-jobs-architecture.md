# DentFlow — Kiến trúc Background Jobs với BullMQ

## 1. Trạng thái và quy tắc nền tảng

Backend có kết nối BullMQ/Redis dùng chung nhưng chưa đăng ký queue hoặc processor nào. Retention `IdempotencyRecord` không phải BullMQ job: Nest Scheduler chạy một truy vấn xóa idempotent trong API mỗi ngày lúc 03:15 UTC. Tài liệu này là contract bắt buộc trước khi thêm background job tiếp theo.

> **BullMQ là execution transport, không phải nguồn trạng thái nghiệp vụ. Mọi processor phải idempotent và an toàn khi job bị chạy lại.**

BullMQ có semantics at-least-once: job lỗi, stalled hoặc worker chết có thể được retry/chạy lại. `jobId` hoặc BullMQ deduplication chỉ giảm job bị enqueue trùng, không thay thế kiểm tra state và idempotency trong processor.

Job chỉ dùng cho tác vụ nền: gọi provider, gửi notification, xử lý webhook đã persist, scheduled maintenance hoặc tác vụ I/O chậm. HTTP controller không chờ job hoàn tất để quyết định mutation nghiệp vụ đã thành công hay chưa.

## 2. Ranh giới dữ liệu và dispatch

- API/service chỉ enqueue job **sau khi** transaction nghiệp vụ của nó đã commit.
- Không dùng BullMQ như transaction boundary, không coi một job đang nằm trong Redis là bằng chứng business action đã tồn tại.
- Tác vụ không được phép mất trong MVP phải xử lý đồng bộ hoặc persist domain record trước khi enqueue. Ví dụ webhook phải xác minh chữ ký và lưu `PaymentEvent` trước; worker chỉ nhận ID event để xử lý/retry.
- Transactional outbox/reconciler tổng quát chưa thuộc MVP. Khi một async workflow yêu cầu delivery bảo đảm, thiết kế domain record hoặc outbox riêng trước khi cho queue tạo side effect quan trọng.
- Job không được là nguồn duy nhất tạo `Payment`, refund, adjustment hoặc thay đổi tenant access. Worker phải gọi domain service và kiểm tra state hiện hành như một request retry.

## 3. Runtime và module structure

Khi có background job thực sự cần retry, I/O chậm hoặc execution policy riêng, production chạy API và worker bằng hai process/container từ cùng source build:

```text
API process
  HTTP controller → domain producer → Redis queue

Worker process
  BullMQ processor → domain service / provider → PostgreSQL
```

API process chỉ đăng ký producer; worker process mới đăng ký processor. Điều này tách I/O chậm, retry và concurrency khỏi HTTP traffic. Development/test có thể dùng runtime `all` để chạy cả hai nhằm đơn giản hoá trải nghiệm local, nhưng production không chạy processor trong API process. Hiện chưa có worker runtime vì retention idempotency không cần queue/processor.

Đề xuất cấu trúc mã nguồn:

```text
src/modules/jobs/
  jobs.module.ts                 # queue registry, connection/default dùng chung
  queue.constants.ts             # QueueName và job name constants
  job-envelope.ts                # common payload/context versioned
  queue-policy.ts                # retry, backoff, concurrency theo queue

src/modules/<domain>/jobs/
  <domain>-jobs.producer.ts      # facade enqueue duy nhất của domain
  <domain>-job.types.ts          # job name + payload schema
  <domain>.processor.ts          # chỉ được import bởi worker runtime
```

`JobsModule` là nơi duy nhất đăng ký queue và policy; controller/domain service không inject `Queue` trực tiếp. Mỗi domain gọi producer facade của chính nó, nhờ đó queue name, `jobId`, payload version và policy không bị rải trong business code.

## 4. Queue, job và payload

Không có queue `default`/generic và không tạo queue theo tenant. Queue được tách khi execution policy thực sự khác, không chỉ vì entity khác.

Các queue được phép dùng trước khi có nhu cầu thực tế:

| Queue | Mục đích | Quy tắc riêng |
| --- | --- | --- |
| `notifications` | Gửi email/push/reminder không đồng bộ | Rate limit và retry theo provider |
| `billing-webhooks` | Xử lý nội bộ `PaymentEvent` đã xác minh/lưu | Không gọi provider để tạo charge hoặc Checkout Session |

Queue mới cần nêu rõ lý do tách: concurrency, retry/backoff, rate limit, độ ưu tiên hoặc ownership vận hành khác. Scheduled maintenance chỉ được thêm queue riêng khi có job thực tế; không tạo sẵn.

`IdempotencyRecordPurgeService` chạy trong API mỗi ngày lúc 03:15 UTC bằng `@nestjs/schedule`, với `waitForCompletion` để không chồng lần chạy trong cùng process. Nó chỉ xóa `IdempotencyRecord(COMPLETED)` đã vượt `expiresAt`, không tạo side effect nghiệp vụ và an toàn khi nhiều API instance cùng chạy. Lỗi được log; lần chạy kế tiếp sẽ thử lại. Tác vụ này không cần queue, retry policy hay worker riêng.

Mọi job name là constant và payload có version. Payload tối thiểu chứa:

```text
jobVersion
originRequestId?        # correlation log; không thay worker request ID
tenantId?/branchId?     # chỉ do server tạo khi task thuộc scope này
resourceId hoặc eventId # worker reload domain state từ PostgreSQL
```

Không nhận payload job trực tiếp từ HTTP client. Worker dùng `tenantId`/`branchId` trong payload server-side để query resource có scope tương ứng; không truy vấn resource tenant-owned bằng ID đơn lẻ. Worker tạo request/correlation context riêng; `originRequestId` chỉ liên kết log với request đã enqueue.

`jobId` phải có tính quyết định khi một resource chỉ nên có một job đang chờ, ví dụ `notification-send:<notificationId>` hoặc `billing-webhook-process:<paymentEventId>`. Đây là dedupe enqueue, không thay thế processor idempotent.

## 5. Processor contract

Mỗi processor phải:

1. Validate job name và payload version trước khi gọi domain service.
2. Tải lại state từ database và kiểm tra tenant/branch scope trước khi xử lý.
3. Thiết kế thao tác đơn giản, atomic và idempotent: retry không được tạo thêm transition, notification/provider action hoặc audit business trái phép.
4. Phân loại lỗi: lỗi tạm thời thì throw để BullMQ retry; lỗi permanent phải dừng retry và lưu nguyên nhân có thể vận hành.
5. Khai báo attempts, backoff, concurrency, rate limit (nếu provider yêu cầu) và retention completed/failed cho **từng job/queue**; không có retry vô hạn hoặc default ngầm.
6. Log queue name, job name/ID, attempt, resource/event ID và correlation ID. Không có API business để client xem, sửa hoặc trigger arbitrary BullMQ job.

Processor không dựa vào HTTP `Idempotency-Key` để an toàn. HTTP idempotency, `jobId`, `providerEventId` và domain-state check là các lớp riêng có trách nhiệm khác nhau.

## 6. Retry, failure và vận hành

- BullMQ failed state là đủ cho MVP; không thêm dead-letter queue riêng.
- Retry/replay thủ công chỉ được bổ sung theo workflow của từng domain. Với billing webhook, retry chỉ chạy xử lý nội bộ của `PaymentEvent` đã lưu, theo [02-platform-admin.md](./02-platform-admin.md), không giả lập event hoặc gọi provider tạo giao dịch mới.
- Worker phải graceful shutdown: dừng lấy job mới và để job đang chạy hoàn tất/được BullMQ retry theo policy. Điều này áp dụng khi có worker thực tế; retention idempotency hiện không dùng worker.
- CPU-bound/heavy work không chạy trong processor Node.js thông thường; tách service/worker chuyên dụng khi có nhu cầu thay vì làm nghẽn event loop API.
- Test integration dùng Redis test tách biệt và phải kiểm tra retry, duplicate/stalled job, tenant isolation trong worker, cùng hành vi failed job.

## 7. Điều chưa làm

- Không tạo queue/processor chỉ vì đã có BullMQ dependency. Retention idempotency dùng tác vụ API trực tiếp vì chỉ là truy vấn xóa idempotent, không cần worker.
- Không có BullMQ Flow, queue per tenant, generic `default` queue, dead-letter queue riêng hoặc transactional outbox tổng quát trong MVP.
- Không có API/UI để tenant tự xem, pause, retry hoặc cấu hình queue/job.
- Khi thêm queue đầu tiên, cập nhật tài liệu domain tương ứng với job name, producer, retry policy và operational owner trong cùng PR.
