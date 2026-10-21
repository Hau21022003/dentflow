# DentFlow staging PostgreSQL backup

Thư mục này là nguồn chuẩn để tái tạo backup automation trên một EC2 staging mới.
Nó không chứa credential và không tự deploy khi được merge. Operator vẫn phải
review đúng commit SHA, chuẩn bị AWS resources/secret rồi chạy installer thủ công.

## Invariants

- Chỉ backup database staging; không chạy migration, seed, reset hoặc restore.
- Dump dùng PostgreSQL 16 custom format, một process và compression vừa phải.
- Dump được stream thẳng lên private S3 bằng SSE-S3; không ghi plaintext archive
  xuống EC2.
- SHA-256 được tính khi upload và tính lại khi tải về. `pg_restore --list` phải
  đọc được archive trước khi sidecar `.sha256` được tạo.
- Timer không được installer bật. Chỉ `verify.sh --enable-timer` được bật timer
  sau khi manual backup và postflight đều pass.
- Restore drill phải chạy trong Docker local cô lập theo Phase 3D, không chạy trên
  EC2 staging.

## Files

| File | Mục đích |
| --- | --- |
| `dentflow-postgres-backup.sh` | Backup, checksum, readability check và logging. |
| `dentflow-postgres-backup.service` | Root-only oneshot systemd service. |
| `dentflow-postgres-backup.timer` | Lịch 02:30 Asia/Ho_Chi_Minh hằng ngày. |
| `backup.env.example` | Schema cấu hình không chứa secret. |
| `install.sh` | Validate AWS/IAM rồi cài file; không start service/timer. |
| `verify.sh` | Manual backup, health/identity postflight và optional timer enable. |
| `restore-drill.sh` | Restore backup đã xác minh vào PostgreSQL Docker local disposable. |
| `aws/` | Bucket policy, IAM policy và lifecycle templates. |

## AWS prerequisites

Tạo private bucket cùng region với staging, bật toàn bộ S3 Block Public Access,
Object Ownership `Bucket owner enforced`, default SSE-S3 và lifecycle 30 ngày.
Thay mọi `BACKUP_BUCKET_NAME` trong hai file `*.json.template` bằng tên bucket
thực trước khi áp dụng. Không đổi template thành policy có `s3:DeleteObject`.

Backup IAM user phải không có console password và chỉ dùng access key riêng cho
automation này. Trước khi tiếp tục, operator cần xác nhận:

- `GetBucketLocation` và list prefix `postgresql/staging/` được phép;
- upload/download multipart trong prefix được phép;
- list bucket root, list mọi bucket, IAM read và `DeleteObject` bị từ chối;
- upload thiếu `x-amz-server-side-encryption: AES256` bị bucket policy từ chối.

## Chuẩn bị credential input

Không sửa `backup.env.example` thành file chứa secret trong repository. Trên EC2,
tạo input tạm trong `/run` để nó nằm trên tmpfs và chỉ root đọc được:

```bash
cd /opt/dentflow
sudo install -o root -g root -m 0600 \
  deploy/postgres-backup/backup.env.example \
  /run/dentflow-backup-input.env
sudoedit /run/dentflow-backup-input.env
```

Điền access key của đúng IAM user `dentflow-staging-backup`. Không truyền secret
qua command line, shell history, ticket, chat hoặc runbook. Nếu key được tải dưới
dạng CSV về operator machine, giữ CSV ngoài repository và trong encrypted storage;
không copy nguyên CSV lên EC2.

## Cài trên EC2 mới

Yêu cầu stack staging đã chạy healthy, image `postgres:16-alpine` đã có local,
AWS CLI v2, Docker và systemd đã cài. Checkout phải là commit đã review.

```bash
cd /opt/dentflow
sudo bash deploy/postgres-backup/install.sh \
  --credentials /run/dentflow-backup-input.env
sudo rm -f /run/dentflow-backup-input.env
```

Installer thực hiện các gate sau nhưng không tạo backup:

1. kiểm tra input `root:root` mode `0400` hoặc `0600`, từ chối symlink/unknown key;
2. xác minh STS đúng backup IAM user, region, bucket và prefix-scoped listing;
3. fail nếu principal list được bucket root/all buckets hoặc có `DeleteObject`;
4. cài atomic `/etc/dentflow/backup.env` với mode `0600`;
5. cài script `0750`, systemd units `0644`, chạy syntax/unit verification;
6. giữ timer disabled/inactive.

Không chạy installer khi service đang chạy. Nếu cập nhật một EC2 đã có timer,
dừng timer trong maintenance window trước; installer cố ý fail thay vì tự tắt lịch:

```bash
sudo systemctl disable --now dentflow-postgres-backup.timer
```

## Manual acceptance và bật timer

Lệnh sau tạo một backup thật. Nó chỉ bật timer sau khi S3/SHA-256/readability,
container/volume identity, resource và HTTPS/API gates đều pass:

```bash
cd /opt/dentflow
sudo bash deploy/postgres-backup/verify.sh \
  --domain staging.lephuchau.online \
  --enable-timer
```

Không dùng `--enable-timer` nếu chỉ muốn manual verification:

```bash
sudo bash deploy/postgres-backup/verify.sh --domain staging.lephuchau.online
```

## Vận hành và xử lý lỗi

```bash
sudo systemctl status dentflow-postgres-backup.timer --no-pager
sudo systemctl list-timers dentflow-postgres-backup.timer --no-pager
sudo systemctl status dentflow-postgres-backup.service --no-pager
sudo journalctl -u dentflow-postgres-backup.service --since '2 days ago' --no-pager
```

Một run thành công có `status=PASS` và service `Result=success`. Khi fail, journal
ghi `stage`/`reason` nhưng không ghi credential. Không tự xóa object thất bại;
archive không có sidecar sẽ được lifecycle xử lý.

## Credential rotation

1. Tạo access key mới cho cùng backup IAM user và lưu an toàn.
2. Tạo `/run/dentflow-backup-input.env` root-only với key mới.
3. Disable/stop timer, chạy lại `install.sh`, xóa input tạm.
4. Chạy `verify.sh --enable-timer`.
5. Chỉ sau khi PASS mới deactivate/delete key cũ trong AWS Console.

## Phase 3D: restore drill cô lập

Tải một cặp `.dump` và `.dump.sha256` đã hoàn tất từ bucket backup về máy
operator. Giữ file ngoài repository và không commit archive. Không dùng application
IAM user để đọc bucket backup; dùng quyền operator/AWS Console hoặc một restore
principal read-only được duyệt.

Chạy drill trên máy local có Docker Desktop và image `postgres:16-alpine` sẵn có:

```bash
bash deploy/postgres-backup/restore-drill.sh \
  --dump /path/to/dentflow-staging-<timestamp>-<sha>.dump \
  --checksum /path/to/dentflow-staging-<timestamp>-<sha>.dump.sha256
```

Runner xác minh sidecar SHA-256 và archive, sau đó restore vào một PostgreSQL 16
container disposable. Container dùng `network=none`, không publish port và lưu data
trên `tmpfs`; trap luôn xóa container khi PASS, fail hoặc nhận signal. Acceptance chỉ
PASS khi migration history, các bảng lõi, dữ liệu synthetic, constraint/index và kích
thước database đều hợp lệ. Runner không kết nối EC2, không dùng staging Compose và
không in row data.

Sau drill, xóa an toàn hai file backup local. Chỉ cập nhật Phase 3D thành PASS sau khi
lưu output `Phase 3D restore drill PASS` và xác nhận không còn container
`dentflow-phase3d-*`.

## Drift check

Repository là nguồn chuẩn. So sánh bản đã review với EC2 mà không in secret:

```bash
sha256sum deploy/postgres-backup/dentflow-postgres-backup.sh
sudo sha256sum /usr/local/sbin/dentflow-postgres-backup
sudo stat -c '%U:%G %a %n' \
  /etc/dentflow/backup.env \
  /usr/local/sbin/dentflow-postgres-backup
```

Nếu checksum script khác nhau, không copy ngược file tùy ý từ EC2. Review diff,
dừng timer trong maintenance window và cài lại từ commit đã duyệt.
