# DentFlow — File Storage

## Mục đích và phạm vi v1

Ảnh được upload trực tiếp từ browser tới S3-compatible object storage qua presigned POST. Backend không nhận byte file và không dùng `FileInterceptor`; backend là control plane xác thực actor, tenant/branch scope, loại file, dung lượng và tạo key.

V1 tạo **upload intent** cho ảnh `image/jpeg`, `image/png` và `image/webp`, tối đa 2 MiB. Không có database entity, public URL, endpoint download hay attachment Patient/Visit. Object dưới `temp/` luôn là staging; avatar là ngoại lệ có liên kết bền vững trực tiếp qua `users.avatar_object_key`, không cần media entity riêng.

## API và tenant isolation

`POST /tenants/:tenantSlug/branches/:branchSlug/uploads/image-intents` yêu cầu JWT, `@TenantScope('branch')` và permission `file.upload`. Body chỉ gồm:

```json
{ "contentType": "image/jpeg", "sizeBytes": 524288 }
```

Backend lấy tenant/branch từ route context đã guard xác minh, không từ body. Backend tạo key theo mẫu `temp/{tenantId}/{branchId}/{uuid}.{extension}`; key không có filename, tên bệnh nhân hoặc dữ liệu lâm sàng. Response trả `objectKey`, `expiresAt` và cặp `upload.url`/`upload.fields` để browser tạo `FormData`, append toàn bộ fields rồi append `file` cuối cùng và POST trực tiếp tới object storage.

`POST /uploads/image-intents` là route chung chỉ yêu cầu JWT cho ảnh user-owned. Body thêm `folder`; V1 chỉ có enum `AVATAR`, không nhận path/folder tự do, tenant ID hoặc user ID. Policy map trong Uploads module lấy actor từ JWT và sinh key `temp/users/{userId}/avatar/{uuid}.{extension}`. Thêm user-owned purpose sau này bằng enum/policy map, không thêm endpoint.

Khi `PATCH /users/me` nhận temporary avatar key hợp lệ của chính actor, backend `HeadObject` đối chiếu MIME/dung lượng và exact prefix, copy object sang `avatars/users/{userId}/{uuid}.{extension}`, rồi mới lưu `avatar_object_key`. Sau commit, backend best-effort xóa source temp và avatar cũ. Response nghiệp vụ không trả object key; safe user/staff response chỉ trả `avatarUrl` signed ngắn hạn. `null` xóa avatar hiện hữu. Client không được dùng temp key sau khi save.

Policy được ký khóa đúng bucket, key, MIME và content-length từ 1 byte đến 2 MiB. `objectKey` chỉ là tham chiếu tạm; tính ngẫu nhiên của key không thay thế kiểm tra authorization. Module gắn attachment sau này phải `HeadObject`/đối chiếu exact prefix tenant-branch trước khi copy sang key lâu dài hoặc tạo quan hệ nghiệp vụ.

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

Client route test-only `/workspace/:tenantSlug/branches/:branchSlug/upload-test` không nằm trong navigation. Nó dùng đúng frontend helper và API upload intent hiện có, sau đó POST trực tiếp tới MinIO/S3; không tạo API, attachment hay entity nghiệp vụ. Route yêu cầu `file.upload`, hiển thị object key tạm và phải bị xóa khi UI attachment thực tế được triển khai.

`browser-e2e` tự chạy `docker compose -f docker-compose.minio.yml up -d` trước khi mở test và chờ health check MinIO. Vì vậy Docker Desktop phải đang chạy khi dùng `npm run test`, `test:headed` hoặc `test:ui`; stack MinIO sẽ được giữ chạy sau test để tạo lần chạy sau nhanh hơn.

## Production checklist

- Bucket private, Block Public Access và default encryption at rest.
- CORS chỉ cho deployed frontend origin, chỉ các method/header thật sự cần cho presigned POST.
- IAM principal ký upload có `s3:PutObject` trên `temp/*`; backend control plane có thêm `s3:HeadObject`, `s3:GetObject`, `s3:CopyObject` và `s3:DeleteObject` trên `temp/*`/`avatars/*`. Không cấp list/public-read.
- Lifecycle xóa `temp/` sau một ngày. Lifecycle chạy bất đồng bộ nên object có thể tồn tại lâu hơn một ít; client không được dựa vào object tạm sau cửa sổ này.
- Không log presigned fields, AWS credentials, file contents, filename hoặc dữ liệu bệnh nhân. Upload intent không tạo audit log vì chưa có thay đổi nghiệp vụ/persistence.
