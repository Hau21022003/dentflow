# Bàn giao triển khai DentFlow staging

> Tài liệu này ghi nhận trạng thái staging trên branch `docker-cicd` tại ngày
> 2026-10-19. Không ghi credentials, private key hoặc giá trị secret vào đây.
> Không dùng tài liệu này như xác nhận rằng EC2 hiện đang khỏe hoặc deployment
> thực tế đã hoàn tất.

## Trạng thái hiện tại

- Docker và Docker Compose đã được cài trên EC2 Ubuntu 24.04 `t3.micro` 1 GB RAM.
- Repository đã được clone tại `/opt/dentflow`; staging target vẫn là branch
  `docker-cicd`, không phải `master`.
- IAM Role, IMDSv2, S3 CORS/lifecycle và `/etc/dentflow/staging.env` đã được cấu
  hình. Compose config đã từng validate thành công trước thay đổi GHCR.
- Docker build trực tiếp trên EC2 đã chạy hơn hai giờ, sau đó EC2 mất SSH và
  Instance Status Check failed. EC2 đang trong quá trình khôi phục và chưa được
  xác nhận hoạt động bình thường.
- CI push gần nhất trước thay đổi GHCR đã pass tại commit
  `7b1d841b27b975b392a273cd50276773eff3b059`. Lỗi Browser E2E 57/58 ghi trong
  bản tài liệu cũ đã được sửa.
- Thay đổi GHCR hiện chỉ có trong working tree local. Chưa commit, push, merge,
  bootstrap workflow lên `master` hoặc deploy.

## Phạm vi implementation GHCR

Ba file được thay đổi:

| File | Thay đổi |
| --- | --- |
| `docker-compose.staging.yml` | Backend/frontend dùng private GHCR image được tag bằng full commit SHA; không còn `build` trên EC2. |
| `.github/workflows/deploy-staging.yml` | Xác minh CI SHA, build/push hai image trên GitHub runner, rồi SSH để pull/migrate/up. |
| `deploy/STAGING_DEPLOYMENT.md` | Cập nhật kiến trúc, bootstrap, migration, rollback và rủi ro vận hành. |

Không sửa Dockerfile, CI, Nginx, application logic, API, schema, migration, auth
hoặc business logic. Không seed/reset database, xóa volume, prune Docker data,
SSH vào EC2 hoặc thao tác AWS trong implementation này.

## Kiến trúc staging

```text
Pull request vào docker-cicd
  `-> CI: backend unit/build + frontend lint/build + Browser E2E
      `-> không deploy từ pull_request

Push/merge vào docker-cicd
  `-> CI push thành công
      `-> Deploy Staging trên default branch
          |-> resolve đúng CI workflow, branch tip và head SHA
          |-> GitHub runner build backend/frontend
          |-> push ghcr.io/hau21022003/dentflow-{backend,frontend}:<full-sha>
          `-> SSH EC2: pull -> dependencies healthy -> migration -> up --wait

Internet -> Nginx trên EC2
  |-- /     -> 127.0.0.1:8080 -> frontend container
  `-- /api/ -> 127.0.0.1:3000 -> backend container

Docker Compose
  |-- postgres:16-alpine -> named volume postgres_data
  |-- redis:7-alpine     -> named volume redis_data
  |-- backend            -> immutable GHCR SHA tag
  `-- frontend           -> immutable GHCR SHA tag
```

Host Nginx, Certbot, IAM Role, S3 và external `/api` routing không thay đổi.
PostgreSQL/Redis không public host ports. Backend/frontend vẫn chỉ bind vào
`127.0.0.1`.

## Docker Compose sau thay đổi

Backend và frontend dùng đúng hai image:

```text
ghcr.io/hau21022003/dentflow-backend:<full-commit-sha>
ghcr.io/hau21022003/dentflow-frontend:<full-commit-sha>
```

`DENTFLOW_IMAGE_TAG` là bắt buộc và không có fallback `latest`. Biến này do CD
export tại thời điểm deploy; không ghi nó vào `/etc/dentflow/staging.env`.
Mọi lệnh Compose thủ công phải truyền cùng SHA:

```bash
export DENTFLOW_IMAGE_TAG=FULL_40_CHARACTER_SHA
docker compose --env-file /etc/dentflow/staging.env \
  -f docker-compose.staging.yml config
```

Compose project name vẫn là `dentflow-staging`, và tên hai volumes vẫn là
`dentflow-staging_postgres_data` và `dentflow-staging_redis_data`. Không đổi
project name, không dùng `down -v`, không xóa hoặc recreate volumes.

## CI

`.github/workflows/browser-e2e.yml` vẫn là workflow CI riêng và không được sửa
trong thay đổi này. Workflow chạy khi push hoặc có pull request nhắm
`docker-cicd`, dùng PostgreSQL/Redis service containers và thực hiện:

1. cài dependencies bằng `npm ci`;
2. backend unit tests;
3. backend build;
4. frontend lint;
5. frontend staging build;
6. Chromium Browser E2E và upload Playwright report.

CD chỉ chấp nhận CI có event `push`. CI thành công của pull request không được
dùng để deploy.

## CD và kiểm soát commit SHA

`Deploy Staging` là workflow riêng với concurrency group
`dentflow-staging-deploy`; deployment không bị cancel giữa chừng.

### Resolve

- `workflow_run` chỉ nhận branch `docker-cicd` và chỉ tiếp tục khi conclusion là
  `success`, event là `push`, head repository đúng repository hiện tại.
- Workflow ID được lấy từ path cố định `.github/workflows/browser-e2e.yml` và
  đối chiếu lại với Actions run. Việc này tránh tin vào display name `CI` đơn
  thuần; trigger chấp nhận cả tên hiện tại và tên cũ đang đăng ký trên `master`.
- `head_sha` phải là full 40-character SHA và phải vẫn là tip hiện tại của
  `docker-cicd`. Nếu branch tiến thêm commit, run cũ bị từ chối và CD chờ CI mới.
- Manual `workflow_dispatch` phải chạy từ workflow definition trên `master`, chỉ
  nhận `ref=docker-cicd`, resolve branch tip và tìm đúng successful push CI run
  của workflow ID và SHA đó.

### Build và publish

Job build checkout đúng resolved SHA, sau đó dùng `backend/Dockerfile` và
`client/Dockerfile` để build trên GitHub-hosted runner. Hai image được push lên
GHCR bằng full SHA tag và có OCI labels. Checkout không persist GitHub credential
trong working tree; các reusable Actions trong privileged CD cũng được pin bằng
full commit SHA:

- `org.opencontainers.image.source=https://github.com/Hau21022003/dentflow`
- `org.opencontainers.image.revision=<resolved-sha>`

Không publish hoặc deploy tag `latest`.

### Deploy trên EC2

CD yêu cầu `/opt/dentflow` sạch, fetch `docker-cicd`, xác minh
`origin/docker-cicd` vẫn đúng resolved SHA và checkout detached SHA đó. Sau đó:

1. validate Compose với `DENTFLOW_IMAGE_TAG=<resolved-sha>`;
2. pull backend/frontend images;
3. start và chờ PostgreSQL/Redis healthy;
4. chạy compiled TypeORM migrations bằng backend image đã pull;
5. `up -d --wait` toàn bộ stack;
6. kiểm tra OCI revision của container backend/frontend đúng resolved SHA;
7. in Compose status và deployed SHA.

CD không có `docker compose build`, seed, database reset, volume deletion hoặc
Docker prune.

## Permissions và secrets

Workflow đặt mặc định `permissions: {}` rồi cấp tối thiểu theo job:

| Job | Permission |
| --- | --- |
| `resolve` | `actions: read`, `contents: read` |
| `build-and-push` | `contents: read`, `packages: write` |
| `deploy` | `contents: read`, `packages: read` |

GitHub cần đúng ba Actions Secrets:

- `SSH_PRIVATE_KEY`
- `EC2_HOST`
- `EC2_USER`

Không cần lưu PAT GHCR dài hạn. Job build và deploy dùng `GITHUB_TOKEN` riêng với
permission tương ứng. Token pull được pipe qua SSH vào
`docker login --password-stdin`, không xuất hiện trong command line, repository,
Docker image hoặc `/etc/dentflow/staging.env`. Workflow cố gắng `docker logout`
khi thành công hoặc thất bại; token cũng hết hiệu lực sau GitHub Actions job.

Nếu GHCR package đã tồn tại nhưng không kế thừa repository permissions, vào
package settings và cấp repository `Hau21022003/dentflow` Actions access. Chỉ khi
repository policy không cho dùng `GITHUB_TOKEN` mới xem xét PAT classic có
`read:packages` như phương án riêng được duyệt.

SSH host key hiện vẫn được thu thập bằng `ssh-keyscan` lúc chạy. Đây là cách đơn
giản cho staging nhưng không xác minh fingerprint out-of-band; có thể chuyển sang
pinned known-host secret trong một hardening change riêng.

## Bootstrap CD lên `master`

`workflow_run` và nút `workflow_dispatch` chỉ hoạt động khi
`.github/workflows/deploy-staging.yml` tồn tại trên default branch. Không cần
merge application hoặc Compose vào `master`; chỉ bootstrap cùng bản workflow CD
đã review.

Thứ tự đề xuất:

1. Khôi phục EC2 và xác nhận Instance Status Checks đạt `2/2`.
2. Kiểm tra SSH, `free -h`, `swapon --show`, `df -h`, `docker version`,
   `docker compose version`, `docker ps -a`; không chạy Docker build.
3. Xác nhận `/opt/dentflow` sạch, deploy user dùng Docker không cần mật khẩu tương
   tác và `/etc/dentflow/staging.env` còn owner/permissions hạn chế.
4. Thêm ba GitHub Secrets ở trên.
5. Qua pull request/review riêng, đưa đúng bản `deploy-staging.yml` này lên
   `master`. Không đưa application changes vào PR bootstrap.
6. Commit/push ba file implementation đã duyệt lên `docker-cicd` theo workflow
   review hiện có.
7. Chờ CI push của commit mới pass. SHA cũ không thay thế CI cho commit mới.
8. Chạy `Deploy Staging` từ workflow trên `master`, input
   `ref=docker-cicd`; hoặc để lần push CI thành công tiếp theo tự kích hoạt.
9. Xác nhận hai GHCR packages/tags được tạo, rồi kiểm tra deployment logs và
   post-deploy checklist.

Workflow file chạy trên `master`, nhưng source, Dockerfiles, Compose và image đều
được lấy từ verified SHA trên `docker-cicd`.

## Migration và seed

CD dùng đúng lệnh migration sau khi database dependencies healthy:

```bash
docker compose --env-file /etc/dentflow/staging.env \
  -f docker-compose.staging.yml \
  run --rm --no-deps backend \
  node ./node_modules/typeorm/cli.js migration:run \
  -d dist/database/data-source.js
```

Nếu migration fail, workflow không chạy bước `up` application mới. Không tự động
revert vì độ an toàn phụ thuộc migration cụ thể. Với migration có thay đổi dữ
liệu/schema đáng kể, tạo backup/snapshot trước deploy và chỉ dùng
`migration:revert` khi `down` đã được review và kiểm thử. Migration tương lai cần
giữ backward compatibility với backend cũ đang chạy trong thời gian migration.

Development seed là synthetic nhưng không nằm trong regular CD. Chỉ chạy một lần
trên database staging mới, bằng image SHA đã duyệt:

```bash
export DENTFLOW_IMAGE_TAG=FULL_40_CHARACTER_SHA
docker compose --env-file /etc/dentflow/staging.env \
  -f docker-compose.staging.yml \
  run --rm --no-deps -e NODE_ENV=development backend \
  node dist/database/seed-runner.js
```

Không chạy lại seed trên database staging đã có dữ liệu.

## Rollback đơn giản

Ghi lại current SHA và previous successful SHA sau mỗi deploy. Để rollback
application về image đã pass CI trước đó, trước hết xác nhận hai image vẫn còn
trong local cache của EC2. CD không prune nên image của lần deploy trước phải còn
trừ khi operator đã dọn thủ công:

```bash
export DENTFLOW_IMAGE_TAG=PREVIOUS_SUCCESSFUL_40_CHARACTER_SHA
docker image inspect \
  ghcr.io/hau21022003/dentflow-backend:$DENTFLOW_IMAGE_TAG \
  ghcr.io/hau21022003/dentflow-frontend:$DENTFLOW_IMAGE_TAG
docker compose --env-file /etc/dentflow/staging.env \
  -f docker-compose.staging.yml up -d --wait --wait-timeout 120
```

Nếu image cũ không còn local, cần login GHCR tạm thời bằng credential read-only
được cấp qua quy trình đã duyệt rồi mới `pull`; không ghi PAT vào shell history,
repository hoặc `staging.env`. Manual CD hiện cố ý chỉ deploy branch tip đã pass
CI, không nhận historic SHA.

Rollback application không đồng nghĩa rollback database. Chỉ revert migration
khi đã xác nhận application cũ tương thích và migration `down` an toàn. Không
xóa volumes để rollback.

## RAM, disk và database risk trên `t3.micro`

### RAM

1 GB RAM chỉ phù hợp staging tải nhẹ. Bỏ build khỏi EC2 loại bỏ nguồn áp lực lớn
nhất, nhưng Ubuntu, Docker daemon, host Nginx, PostgreSQL, Redis, NestJS và
frontend Nginx vẫn có thể gây OOM, nhất là trong migration hoặc traffic burst.

- Xác nhận có 1-2 GB swap làm vùng đệm; swap không thay thế RAM.
- Theo dõi `free -h`, `docker stats --no-stream` và kernel OOM logs sau deploy.
- Chưa thêm hard memory limits cho PostgreSQL/Redis vì limit thấp có thể giết
  stateful service. Nếu đo thực tế cho thấy backend/frontend là nguồn spike, có
  thể review riêng giới hạn khoảng backend `384m`, frontend `64m`.
- `t3.small` 2 GB vẫn là lựa chọn an toàn hơn nếu staging có nhiều người dùng,
  background jobs hoặc migration nặng.

### Disk

- Mỗi SHA tạo image version mới; EC2 giữ image cũ để rollback và GHCR tiếp tục
  tích lũy package versions.
- PostgreSQL volume, Redis AOF và Docker JSON logs tiếp tục tăng.
- Theo dõi `df -h` và `docker system df`; root disk 8 GB có rủi ro cao, nên cân
  nhắc tối thiểu khoảng 16-20 GB.
- Không tự động prune trong CD. Chỉ dọn unused images thủ công sau rollback
  window và không bao giờ prune volumes.

### Database

Named volume giữ dữ liệu qua container recreate nhưng không phải backup. EC2 và
EBS vẫn là single point of failure. Cần có backup/snapshot trước migration rủi ro
và một chính sách backup riêng trước khi coi staging là bền vững.

## Checklist sau triển khai

- [ ] EC2 đạt `2/2` status checks, SSH ổn định và không còn build process cũ.
- [ ] `free`, swap và disk còn đủ headroom; kernel không có OOM mới.
- [ ] Workflow CD đã được review và tồn tại trên `master`.
- [ ] Ba GitHub Secrets tồn tại và GHCR package Actions access đúng repository.
- [ ] CI push thành công cho đúng tip SHA của `docker-cicd`.
- [ ] CD resolve đúng workflow ID/path, event `push`, branch và full SHA.
- [ ] Hai GHCR image tags và OCI revision cùng bằng resolved SHA.
- [ ] EC2 logs không có `docker build`; chỉ có pull/migrate/up.
- [ ] Migration hoàn tất trước application recreate.
- [ ] `docker compose ps` báo PostgreSQL, Redis, backend và frontend healthy.
- [ ] Containers backend/frontend chạy đúng image revision đã deploy.
- [ ] PostgreSQL và Redis named volumes giữ nguyên dữ liệu.
- [ ] HTTPS frontend, `/api/`, login/refresh cookie path hoạt động.
- [ ] S3 presigned upload và IAM Role qua IMDSv2 hoạt động từ backend container.
- [ ] Ghi lại current SHA và previous successful SHA để rollback.
- [ ] Theo dõi RAM, disk, Docker logs và EC2 status checks sau deploy.

## Chuyển staging sang `master` sau này

Không thực hiện trong giai đoạn này. Chỉ sau khi staging ổn định và application
merge vào `master` được duyệt mới đổi CI/CD branch filters và guards từ
`docker-cicd` sang `master`.
