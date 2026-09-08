# DentFlow — Quy ước kiến trúc Background Job

Tài liệu này chỉ quy định cách tổ chức và các bất biến kỹ thuật của background job. Tên job, payload nghiệp vụ, retry policy và provider cụ thể thuộc tài liệu của domain sở hữu job, không ghi tại đây.

## 1. Khi nào dùng job

Chỉ tạo background job khi tác vụ thực sự cần chạy bất đồng bộ: I/O chậm, gọi provider, retry/backoff, rate limit hoặc concurrency riêng. Không tạo queue/processor chỉ vì dự án đã có BullMQ.

Job không là nguồn trạng thái nghiệp vụ và không là transaction boundary. Domain phải persist state nghiệp vụ trước; chỉ enqueue sau khi transaction đã commit.

## 2. Vị trí mã nguồn

Mỗi job nằm trọn trong domain sở hữu nó:

```text
src/modules/<domain>/jobs/
  <job>.types.ts             # job name, payload và kiểu dữ liệu
  <job>.producer.ts          # facade duy nhất để domain enqueue job
  <job>.processor.ts         # xử lý job
```

Số file không cố định; chỉ tách thêm file khi nó làm rõ trách nhiệm của job. Không tạo `src/modules/jobs/`, queue `default`/generic hoặc queue theo tenant. Cấu hình BullMQ dùng chung, nếu cần, thuộc tầng infrastructure/configuration chứ không là một domain module mới.

## 3. Runtime

Ở quy mô hiện tại, producer và processor cùng chạy trong API server. Processor được đăng ký bởi module domain, còn controller chỉ gọi producer. Không tạo `worker.ts`, worker module hoặc server/process riêng cho job.

## 4. Contract tối thiểu của job

- Payload chỉ do server tạo và chỉ mang ID/context tối thiểu. Không đưa token thô, dữ liệu nhạy cảm hoặc payload trực tiếp từ client vào queue. Chỉ thêm version khi có rollout thay đổi payload không tương thích mà queue có thể còn job cũ.
- Processor phải tải lại state từ database, xác minh tenant/branch context và idempotent vì queue có thể chạy lại job.
- Dùng `jobId` xác định khi một resource chỉ nên có một job đang chờ. Đây chỉ là dedupe enqueue, không thay thế idempotency trong processor.
- Retry, backoff, concurrency, rate limit và retention phải được khai báo rõ ở job/domain; không có retry vô hạn.
- Lỗi tạm thời được throw để retry. Lỗi permanent phải dừng retry và lưu/log lý do đủ để vận hành.

## 5. Kiểm thử và tài liệu domain

Mỗi job phải có test phù hợp cho retry, replay/duplicate, failure và tenant isolation. Khi thêm hoặc đổi job, cập nhật tài liệu domain tương ứng với mục đích, side effect, retry policy và owner vận hành.
