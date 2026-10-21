# DentFlow — File Storage

## Mục đích và phạm vi v1

Ảnh được upload trực tiếp từ browser tới S3-compatible object storage qua presigned POST. Backend không nhận byte file và không dùng `FileInterceptor`; backend là control plane xác thực actor, tenant/branch scope, loại file, dung lượng và tạo key.

V1 tạo **upload intent** cho ảnh `image/jpeg`, `image/png`, `image/webp` và luồng PatientFile hỗ trợ thêm `application/pdf`. Upload generic/avatar tối đa 2 MiB; purpose `TREATMENT_PROGRESS` tối đa 5 MiB, còn `PATIENT_FILE` tối đa 10 MiB (`10 * 1024 * 1024`). Không có public URL. Object dưới `temp/` luôn là staging; avatar liên kết qua `users.avatar_object_key`, ảnh tiến độ liên kết append-only qua `treatment_item_event_images`, còn thư viện bệnh nhân dùng `patient_files` branch-scoped.

## API và tenant isolation

`POST /tenants/:tenantSlug/branches/:branchSlug/uploads/image-intents` yêu cầu JWT, `@TenantScope('branch')` và permission `file.upload`. Body chỉ gồm:

```json
{ "contentType": "image/jpeg", "sizeBytes": 524288, "purpose": "TREATMENT_PROGRESS" }
```

Backend lấy tenant/branch từ route context đã guard xác minh, không từ body. Không có purpose thì backend tạo key `temp/{tenantId}/{branchId}/{uuid}.{extension}` với giới hạn 2 MiB. Purpose `TREATMENT_PROGRESS` tạo key `temp/{tenantId}/{branchId}/treatment-progress/{actorUserId}/{uuid}.{extension}` với giới hạn 5 MiB; client không gửi path, tenant/branch/Patient/actor ID. Key không có filename, tên bệnh nhân hoặc dữ liệu lâm sàng. Response trả `objectKey`, `expiresAt` và cặp `upload.url`/`upload.fields` để browser tạo `FormData`, append toàn bộ fields rồi append `file` cuối cùng và POST trực tiếp tới object storage.

`POST /tenants/:tenantSlug/branches/:branchSlug/uploads/file-intents` nhận purpose bắt buộc `PATIENT_FILE`, MIME/dung lượng và tạo `temp/{tenantId}/{branchId}/patient-files/{actorUserId}/{uuid}.{extension}`. Route chỉ stage byte; `/appointments/:appointmentId/visit/files` mới kiểm tra Dentist assignment, trạng thái Visit, suy ra Patient, `HeadObject`, copy sang `clinical/{tenantId}/{branchId}/{patientId}/patient-files/{fileId}.{extension}` và ghi metadata/audit. Tên gốc chỉ nằm trong metadata nghiệp vụ, không nằm trong object key hoặc audit/log. Preview/download dùng signed GET sau mỗi lần kiểm tra quyền; API không trả key permanent.

`POST /uploads/image-intents` là route chung chỉ yêu cầu JWT cho ảnh user-owned. Body thêm `folder`; V1 chỉ có enum `AVATAR`, không nhận path/folder tự do, tenant ID hoặc user ID. Policy map trong Uploads module lấy actor từ JWT và sinh key `temp/users/{userId}/avatar/{uuid}.{extension}`. Thêm user-owned purpose sau này bằng enum/policy map, không thêm endpoint.

Khi `PATCH /users/me` nhận temporary avatar key hợp lệ của chính actor, backend `HeadObject` đối chiếu MIME/dung lượng và exact prefix, copy object sang `avatars/users/{userId}/{uuid}.{extension}`, rồi mới lưu `avatar_object_key`. Sau commit, backend best-effort xóa source temp và avatar cũ. Response nghiệp vụ không trả object key; safe user/staff response và dentist booking option đã được phân quyền chỉ trả `avatarUrl` signed ngắn hạn. `null` xóa avatar hiện hữu. Client không được dùng temp key sau khi save.

Policy được ký khóa đúng bucket, key, MIME và content-length từ 1 byte đến giới hạn của purpose. `objectKey` chỉ là tham chiếu tạm; tính ngẫu nhiên của key không thay thế kiểm tra authorization. Khi tạo progress note, backend resolve lại current Visit, Patient, Plan và Item trong tenant/branch đã xác minh; chỉ nhận exact temp prefix của actor, `HeadObject` để kiểm tra MIME/extension/kích thước, rồi copy sang `clinical/{tenantId}/{branchId}/{patientId}/treatment-progress/{eventId}/{imageId}.{extension}`. Database transaction chỉ lưu quan hệ sau khi copy thành công; lỗi copy/transaction xóa permanent object best-effort, còn thành công xóa temp best-effort. Object clinical là private và signed GET ngắn hạn chỉ được tạo sau cùng kiểm tra quyền ca/Patient; API không trả object key.

## Cấu hình và local MinIO

`S3_ENABLED=false` là mặc định để backend vẫn khởi động khi storage chưa được provision. Khi bật, `AWS_BUCKET` và `AWS_DEFAULT_REGION` là bắt buộc; `AWS_ACCESS_KEY_ID` và `AWS_SECRET_ACCESS_KEY` phải xuất hiện cùng nhau hoặc đều bỏ trống để dùng default credential chain. `S3_ENDPOINT` là tùy chọn cho MinIO/R2-compatible endpoint, `AWS_USE_PATH_STYLE_ENDPOINT=true` dùng cho MinIO local, và `S3_PRESIGNED_POST_TTL` mặc định `5m`.

Khởi động MinIO local:

```bash
docker compose -f docker-compose.minio.yml up -d
```

Sau đó đặt trong `backend/.env.development` (không commit credentials thật):

```dotenv
S3_ENABLED=true
AWS_ACCESS_KEY_ID=dentflow-minio
AWS_SECRET_ACCESS_KEY=dentflow-minio-local-only
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=dentflow-uploads
AWS_USE_PATH_STYLE_ENDPOINT=true
S3_ENDPOINT=http://localhost:9000
S3_PRESIGNED_POST_TTL=5m
```

Compose tạo bucket private và lifecycle rule cho `temp/` expire sau một ngày. CORS local chỉ cho Vite development (`http://localhost:5173`) và isolated Playwright (`http://127.0.0.1:5174`); thay đổi origin theo môi trường frontend thực tế.

### Trang kiểm tra tạm và Browser E2E

Client route test-only `/workspace/:tenantSlug/branches/:branchSlug/upload-test` không nằm trong navigation. Nó tiếp tục chỉ kiểm tra image intent generic và không tạo entity nghiệp vụ. UI PatientFile thực tế nằm trong Doctor Visit, dùng file intent riêng và không hiển thị object key.

`browser-e2e` tự chạy `docker compose -f docker-compose.minio.yml up -d` trước khi mở test và chờ health check MinIO. Vì vậy Docker Desktop phải đang chạy khi dùng `npm run test`, `test:headed` hoặc `test:ui`; stack MinIO sẽ được giữ chạy sau test để tạo lần chạy sau nhanh hơn.

## Production checklist

- Bucket private, Block Public Access và default encryption at rest.
- CORS chỉ cho deployed frontend origin, chỉ các method/header thật sự cần cho presigned POST.
- IAM principal ký upload có `s3:PutObject` trên `temp/*`; backend control plane có thêm `s3:HeadObject`, `s3:GetObject`, `s3:CopyObject` và `s3:DeleteObject` trên `temp/*`, `avatars/*` và `clinical/*`. Không cấp list/public-read.
- Lifecycle xóa `temp/` sau một ngày. Lifecycle chạy bất đồng bộ nên object có thể tồn tại lâu hơn một ít; client không được dựa vào object tạm sau cửa sổ này.
- Không log presigned fields, AWS credentials, file contents, filename hoặc dữ liệu bệnh nhân. Upload intent không tạo audit log vì chưa có thay đổi nghiệp vụ/persistence.
