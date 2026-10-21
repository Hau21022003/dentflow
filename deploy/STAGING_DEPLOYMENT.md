# Bàn giao triển khai DentFlow staging

> Tài liệu này ghi nhận trạng thái staging trên branch `docker-cicd` đến ngày
> 2026-10-21. Không ghi credentials, private key hoặc giá trị secret vào đây.
> Staging vẫn deploy từ `docker-cicd`; chỉ chuyển cả CI và CD sang `master` sau
> khi application, Dockerfiles và Compose đã được merge vào `master` qua review.

## Trạng thái hiện tại

- Docker và Docker Compose đã được cài trên EC2 Ubuntu 24.04 `t3.micro` 1 GB RAM;
  SSH và Docker hiện hoạt động ổn định sau sự cố tài nguyên.
- Repository đã được clone tại `/opt/dentflow`; staging target vẫn là branch
  `docker-cicd`, không phải `master`.
- S3 hiện dùng một IAM user qua cặp static AWS credentials trong
  `/etc/dentflow/staging.env`; backend container nhận cùng credentials qua runtime
  environment. File env có mode `0640`, thư mục cha có mode `0750`, và giá trị
  credential không được ghi vào log/runbook. Chuyển sang EC2 IAM Role/IMDSv2 là
  cải tiến hardening tùy chọn trong tương lai, không phải blocker của staging hiện
  tại. S3 CORS/lifecycle đã được cấu hình; `MAIL_REDIRECT_TO` staging đã được sửa
  về một email hợp lệ và Compose config validation thành công.
- Docker build trực tiếp trên EC2 đã chạy hơn hai giờ, sau đó EC2 mất SSH và
  Instance Status Check failed. Build trên EC2 đã được loại khỏi quy trình;
  trạng thái `2/2` trên AWS Console vẫn cần được kiểm tra định kỳ riêng.
- Ba GitHub Actions secrets đã được cấu hình. Workflow CD đã được bootstrap lên
  `master`, còn Compose và application staging vẫn ở `docker-cicd`.
- Manual CD run `39293268686` đã thành công cho commit
  `882742db804b9722ec40cc766bb9ae1e1fe9fdb4`: build/push GHCR, pull trên EC2,
  migration, recreate application, healthcheck và OCI revision verification đều
  hoàn tất. Log kết thúc bằng `Deployed <full-sha>`.
- CI push run `39297680549`, attempt 2, đã thành công tại full SHA
  `c8bb78d59ec9555b7f62e7efacf5838655642475`. Test discovery có **58 Browser
  E2E tests trong 19 files** và attempt 2 pass đủ **58/58**. Con số 13 chỉ là số
  test đã pass ở attempt 1 trước khi run bị `@Hau21022003` hủy thủ công, không
  phải tổng số test của suite.
- Automatic CD run `39304553130` đã được kích hoạt bằng event `workflow_run` từ
  CI push thành công ở trên, không dùng `workflow_dispatch`. Cả ba job `resolve`,
  `build-and-push` và `deploy` đều thành công; hai GHCR images, OCI revisions,
  checkout trên EC2 và application containers đều dùng cùng full SHA
  `c8bb78d59ec9555b7f62e7efacf5838655642475`. Log kết thúc bằng
  `Deployed c8bb78d59ec9555b7f62e7efacf5838655642475`.
- PostgreSQL, Redis, backend và frontend hiện chạy healthy; backend/frontend có
  restart count `0` và `OOMKilled=false`. Hai named volumes PostgreSQL/Redis giữ
  nguyên identity, không bị xóa hoặc recreate trong deploy.
- Hotfix ngăn migration container tiêu thụ phần còn lại của SSH heredoc đã merge
  vào `master` qua PR #8 và `docker-cicd` qua PR #9.
- Current successful SHA là `c8bb78d59ec9555b7f62e7efacf5838655642475`;
  previous successful SHA là `882742db804b9722ec40cc766bb9ae1e1fe9fdb4`.
- Edge-only CD run `39398441286` đã hoàn tất Phase 1 với config SHA
  `4c3596ff2c882dd5eab85893e6a91eb757394575`; application SHA vẫn là
  `c8bb78d59ec9555b7f62e7efacf5838655642475`. Nginx/Certbot, certificate
  Let's Encrypt, HTTP redirect, HTTPS frontend và `/api/` đều hoạt động.
- EC2 có swapfile 1 GiB, permission `0600`, persist qua `/etc/fstab` và
  `vm.swappiness=10`. Postflight Phase 2 ghi nhận swap dùng khoảng 185 MiB,
  root disk 19 GB còn khoảng 13 GB và `MemAvailable` khoảng 387 MiB; sáu
  container healthy, restart count `0`, `OOMKilled=false` và không có kernel OOM.
- Phase 2 đã hoàn tất ngày 2026-10-20: dùng đúng dev seed synthetic hiện có trên
  database staging trống, rồi xác nhận HTTPS/API, login, refresh, cookie flags,
  logout và postflight container/volume/resource. Phase 3A resource/health
  preflight và Phase 3B browser upload/download smoke đã chạy ngày 2026-10-21.
  Browser S3 flow pass; quyền `s3:ListBucket` không cần thiết được operator chấp
  nhận như một deviation và không chặn Phase 3. Phase 3C đã cấu hình backup
  PostgreSQL hằng ngày lên S3 và manual backup đầu tiên đã pass. Lần chạy tự động
  lúc `02:30 Asia/Ho_Chi_Minh` đã tạo đủ dump/sidecar; restore drill cô lập Phase
  3D đã pass ngày 2026-10-21.

## Phạm vi implementation GHCR

Ba file được thay đổi:

| File | Thay đổi |
| --- | --- |
| `docker-compose.staging.yml` | Backend/frontend dùng private GHCR image được tag bằng full commit SHA; không còn `build` trên EC2. |
| `.github/workflows/deploy-staging.yml` | Xác minh CI SHA, build/push hai image trên GitHub runner, rồi SSH để pull/migrate/up. |
| `deploy/STAGING_DEPLOYMENT.md` | Cập nhật kiến trúc, bootstrap, migration, rollback và rủi ro vận hành. |

Không sửa Dockerfile, CI, application logic, API, schema, migration, auth hoặc
business logic trong implementation GHCR. Không seed/reset database, xóa volume
hoặc prune Docker data. Các bước xác minh vận hành sau đó chỉ pull/deploy image,
kiểm tra trạng thái và cấu hình swap; không build trên EC2.

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

Khối Internet -> Nginx ở trên đã hoạt động từ Phase 1. Tại postflight Phase 2
ngày 2026-10-20, HTTP redirect đúng sang HTTPS, frontend, `/api/` và
`/nginx-health` đều trả `200` với TLS hợp lệ. IAM Role và cấu hình S3 hiện có
không thay đổi. PostgreSQL/Redis không public host ports; backend/frontend vẫn
chỉ bind vào `127.0.0.1`.

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
4. chạy compiled TypeORM migrations bằng backend image đã pull, với interactive
   input và TTY bị tắt để migration không thể đọc phần còn lại của SSH script;
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

## Bootstrap CD lên `master` (đã thực hiện)

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

Bootstrap workflow và ba repository secrets đã hoàn tất. Manual CD run
`39293268686` đã xác nhận đường build/push/pull/deploy ban đầu. Automatic path
cũng đã được xác nhận bằng CI push run `39297680549` attempt 2 và `workflow_run`
CD run `39304553130`, cùng deploy full SHA
`c8bb78d59ec9555b7f62e7efacf5838655642475`.

## Migration và seed

CD dùng đúng lệnh migration sau khi database dependencies healthy:

```bash
docker compose --env-file /etc/dentflow/staging.env \
  -f docker-compose.staging.yml \
  run --rm --no-deps --interactive=false -T backend \
  node ./node_modules/typeorm/cli.js migration:run \
  -d dist/database/data-source.js </dev/null
```

`--interactive=false`, `-T` và `</dev/null` là bắt buộc khi lệnh chạy trong SSH
heredoc. Nếu thiếu chúng, `docker compose run` có thể tiêu thụ các dòng script
phía sau migration, làm workflow trả success trước khi application được start và
kiểm tra health.

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

- Swapfile 1 GiB đã active và persist, `vm.swappiness=10`; sau deploy swap dùng
  `0 B`. Swap chỉ là vùng đệm, không thay thế RAM.
- Theo dõi `free -h`, `docker stats --no-stream` và kernel OOM logs sau deploy.
- Baseline sau deploy: `MemAvailable` khoảng 350 MiB, cả bốn container healthy,
  restart count `0` và không có dấu hiệu OOM mới.
- Chưa thêm hard memory limits cho PostgreSQL/Redis vì limit thấp có thể giết
  stateful service. Nếu đo thực tế cho thấy backend/frontend là nguồn spike, có
  thể review riêng giới hạn khoảng backend `384m`, frontend `64m`.
- `t3.small` 2 GB vẫn là lựa chọn an toàn hơn nếu staging có nhiều người dùng,
  background jobs hoặc migration nặng.

### Disk

- Mỗi SHA tạo image version mới; EC2 giữ image cũ để rollback và GHCR tiếp tục
  tích lũy package versions.
- PostgreSQL volume, Redis AOF và Docker JSON logs tiếp tục tăng.
- Theo dõi `df -h` và `docker system df`; root disk hiện là 19 GB và còn khoảng
  13 GB sau khi tạo swapfile. Root disk 8 GB có rủi ro cao, nên giữ tối thiểu
  khoảng 16-20 GB.
- Không tự động prune trong CD. Chỉ dọn unused images thủ công sau rollback
  window và không bao giờ prune volumes.

### Database

Named volume giữ dữ liệu qua container recreate nhưng không phải backup. Phase 3C
đã tách backup PostgreSQL sang private S3 bucket cùng region, dùng SSE-S3 và
lifecycle 30 ngày. Phase 3D đã restore backup tự động vào Docker local cô lập và
pass; không reset database hoặc restore vào staging để thử nghiệm.

## Checklist sau triển khai

- [ ] Xác nhận lại EC2 đạt `2/2` status checks trên AWS Console; SSH hiện ổn
  định và quy trình mới không chạy Docker build trên EC2. Tài khoản AWS dùng khi
  kiểm tra chưa có quyền `DescribeInstances`, nên chưa xác nhận độc lập được mục
  `2/2` từ Console/API.
- [x] Đã đo lại tài nguyên khi đủ sáu container chạy: root disk 19 GB còn khoảng
  13 GB, swapfile 1 GiB đang active và dùng khoảng 185 MiB, `MemAvailable` khoảng
  387 MiB; restart count `0`, `OOMKilled=false` và không có kernel OOM mới.
- [x] Workflow CD đã được review và tồn tại trên `master`.
- [x] Ba GitHub Secrets tồn tại và `GITHUB_TOKEN` đã build/push/pull GHCR thành
  công.
- [x] CI push run `39297680549` attempt 2 thành công tại tip `docker-cicd`
  `c8bb78d59ec9555b7f62e7efacf5838655642475`; backend pass 70 tests và Browser
  E2E pass đủ 58/58. Attempt 1 bị hủy thủ công sau khi mới pass 13/58.
- [x] Automatic CD run `39304553130` resolve đúng workflow ID/path, event `push`,
  repository, branch và full SHA; run được tạo bằng `workflow_run`, không phải
  manual dispatch.
- [x] Hai GHCR image tags, OCI revisions, EC2 checkout và application containers
  cùng bằng `c8bb78d59ec9555b7f62e7efacf5838655642475`.
- [x] EC2 deployment logs không có `docker build`; chỉ có pull/migrate/up.
- [x] Migration hoàn tất trước application recreate; lần chạy xác nhận báo
  `No migrations are pending`.
- [x] `docker compose ps` báo PostgreSQL, Redis, backend và frontend healthy.
- [x] Containers backend/frontend chạy đúng image revision đã deploy.
- [x] PostgreSQL và Redis named volumes không bị xóa hoặc recreate trong deploy.
- [x] HTTPS frontend, `/api/`, login/refresh/logout và cookie flags hoạt động.
  Refresh cookie có `Path=/api/auth`; cả access/refresh cookie đều có `Secure`,
  `HttpOnly`, `SameSite=Lax`, và bị clear đúng path khi logout.
- [x] S3 presigned POST, browser upload/CORS, avatar copy, presigned GET/download,
  unsigned access denial và avatar cleanup hoạt động với IAM user/static
  credentials hiện tại. IAM Role/IMDSv2 là hardening tùy chọn trong tương lai.
- [x] IAM user còn quyền `s3:ListBucket` dù application không cần; operator chấp
  nhận đây là deviation của staging. Không thay đổi IAM policy trong Phase 3B.
- [x] Current successful SHA là
  `c8bb78d59ec9555b7f62e7efacf5838655642475`; previous successful SHA là
  `882742db804b9722ec40cc766bb9ae1e1fe9fdb4`.
- [x] Thiết lập database backup S3, SSE-S3, SHA-256, lịch hằng ngày và retention
  30 ngày; manual backup/readability check đã pass mà không thay đổi named volume.
- [x] Restore drill từ S3 trong Docker local cô lập đã pass với PostgreSQL 16;
  không restore vào staging và không còn container/file backup local sau drill.
- [x] Đã thu baseline RAM, swap, disk, Docker restart/OOM sau deploy. Tiếp tục
  checklist thủ công; CloudWatch alarms tạm hoãn và không cài CloudWatch Agent.

## Chuyển staging sang `master` sau này

Không thực hiện trong giai đoạn này. Chỉ sau khi staging ổn định và application
merge vào `master` được duyệt mới đổi CI/CD branch filters và guards từ
`docker-cicd` sang `master`.

## Phase 1: edge-only Nginx + Certbot trong Docker Compose

Phần này là runbook triển khai đã được code hoá nhưng **chưa chạy**. Edge dùng file
`docker-compose.edge.yml` bổ sung vào project Compose hiện hữu
`dentflow-staging`. Nginx và Certbot là hai service mới; PostgreSQL, Redis,
backend và frontend vẫn do `docker-compose.staging.yml` quản lý. Hai certificate
volumes mới là `dentflow-staging_letsencrypt_conf` và
`dentflow-staging_letsencrypt_webroot`; chúng không liên quan tới
`dentflow-staging_postgres_data` hoặc `dentflow-staging_redis_data`.

Nginx publish duy nhất `80:80` và `443:443`. Backend/frontend vẫn chỉ publish
loopback `127.0.0.1:3000` và `127.0.0.1:8080`; PostgreSQL/Redis không có host
port. Trong Docker network, Nginx resolve động `frontend:80` và `backend:3000`,
không ghi IP container. `/api/` bỏ prefix khi proxy tới backend và giữ rule
`proxy_cookie_path /auth /api/auth`.

### Tách phần cần đưa lên `master` và `docker-cicd`

- `.github/workflows/deploy-staging.yml` phải được review và cập nhật riêng trên
  `master` trước, vì GitHub chỉ dùng workflow `workflow_run` từ default branch.
  Commit bootstrap workflow này không phải edge commit và không được ghép vào
  commit edge trên `docker-cicd`.
- `docker-compose.edge.yml`, `deploy/nginx/*`, hai script edge và phần runbook này
  mới thuộc commit edge trên `docker-cicd`. Không đưa thay đổi application vào
  commit đó.
- Nếu `.github/workflows/deploy-staging.yml` xuất hiện cùng edge files trong commit
  `docker-cicd`, bộ phân loại coi đó là mixed edge/application và fail closed. Vì
  vậy phải tách hai thay đổi trên thành hai PR/commit được review độc lập sau khi
  kết thúc review local.

Workflow có ba lựa chọn manual: `auto`, `full`, `edge-only`. Hai giá trị cụ thể là
assertion, không phải override; khác kết quả phân loại sẽ fail. Automatic deployment
dùng `auto`. Commit trộn edge path và non-edge path cũng fail để buộc tách deploy.
GitHub runner phân loại file của commit; EC2 kiểm tra lại toàn bộ diff từ
`config_sha` đang checkout đến target SHA. Edge-only chỉ chấp nhận:

```text
docker-compose.edge.yml
deploy/nginx/*
deploy/scripts/bootstrap-staging-tls.sh
deploy/scripts/check-staging-edge.sh
deploy/STAGING_DEPLOYMENT.md
```

Chỉ `full` chạy Buildx, push/pull application image và migration; full giữ nguyên
pipeline application cũ và không recreate Nginx/Certbot. Edge-only không đăng nhập
GHCR, không build/push, không migration và chỉ gọi:

```bash
docker compose \
  --env-file /etc/dentflow/staging.env \
  -f docker-compose.staging.yml \
  -f docker-compose.edge.yml \
  up -d --no-deps --force-recreate --wait --wait-timeout 120 nginx certbot
```

Danh sách service ở cuối lệnh cùng `--no-deps` là invariant bắt buộc. Workflow
snapshot ID, image, restart count, OOM state và health của bốn application
containers, đồng thời snapshot identity/mountpoint của hai data volumes trước và
sau lệnh; khác biệt bất kỳ làm deployment fail và kích hoạt rollback edge.

Sau khi cả remote checks và external smoke pass, trạng thái không chứa secret được
ghi atomically vào `/opt/dentflow/.git/dentflow-staging-state`:

```text
application_sha=<OCI revision hiện vẫn chạy cho backend/frontend>
config_sha=<Git SHA chứa edge config đã triển khai>
```

Với edge-only, `application_sha` phải giữ nguyên còn `config_sha` tiến tới target
SHA. Ngay trước khi mutate edge, workflow ghi file `dentflow-edge-pending` chứa các
SHA và checksum snapshot; file này chỉ bị finalize sau external smoke hoặc bị xóa
sau rollback đã xác minh. Các file nằm trong `.git`, nên không làm working tree
bẩn.

### Preflight bắt buộc và resource gate

Thực hiện theo thứ tự dưới đây. Nếu một mục không pass thì dừng, không chạy
workflow:

1. Trên AWS Console xác nhận EC2 `2/2 status checks`, public/Elastic IPv4 đúng với
   A record `staging.lephuchau.online`, và Security Group inbound cho TCP `80` và
   `443` từ Internet. Giữ SSH giới hạn theo IP quản trị; không mở port PostgreSQL
   hoặc Redis. Đây là gate thủ công vì workflow không có AWS permission.
2. Xác nhận DNS public trả đúng IP bằng ít nhất hai resolver. Port `80` phải tới
   được từ Internet để ACME HTTP-01 hoạt động; port `443` phải mở trước smoke test.
3. Thêm hai key vào `/etc/dentflow/staging.env`, không commit giá trị và giữ
   permission hiện tại của file:

   ```dotenv
   STAGING_DOMAIN=staging.lephuchau.online
   CERTBOT_EMAIL=<email vận hành nhận cảnh báo hết hạn>
   ```

4. Xác nhận repository EC2 sạch, current application OCI revision của backend và
   frontend giống nhau, PostgreSQL/Redis/backend/frontend đều healthy, không có
   `OOMKilled=true`, và port `80`/`443` không bị listener ngoài Compose chiếm.
5. Script `check-staging-edge.sh resource-gate` yêu cầu `MemAvailable >= 200 MiB`,
   swap active xấp xỉ `1 GiB` (`SwapTotal >= 1040000 KiB`), root free ít nhất
   `5 GiB`, root usage không quá `80%`, bốn application containers healthy, và
   không có kernel OOM trong 24 giờ
   trước đó. Deploy user phải có passwordless sudo để đọc kernel journal. Gate
   fail thì không checkout target và không thay đổi container.

Trên `t3.micro` 1 GiB, Nginx Alpine và Certbot idle dự kiến nhỏ hơn đáng kể so với
backend/PostgreSQL, nhưng lúc pull image, cấp cert và dry-run renewal sẽ tạo spike
RAM/disk tạm thời. Hai image pinned theo digest tăng disk lần đầu; certificate và
ACME state thường chỉ chiếm vài MiB. Không thêm memory limit cho database/Redis và
không prune. Nếu `MemAvailable` dưới gate hoặc swap/disk không đạt, dừng và xử lý
tài nguyên trước thay vì ép deploy.

### Bootstrap certificate lần đầu

Nginx khởi động bằng template HTTP bootstrap. Chỉ `/nginx-health` và
`/.well-known/acme-challenge/` được phục vụ; mọi application path HTTP trả `503`,
do đó application không bị lộ plaintext trước khi có certificate.

`bootstrap-staging-tls.sh` thực hiện các bước sau:

1. validate merged Compose và xác nhận domain trong env khớp chính xác
   `staging.lephuchau.online`;
2. tạo một challenge file ngẫu nhiên trong persistent webroot, rồi đọc lại qua
   URL HTTP public;
3. nếu chưa có certificate persistent, gọi đúng **một** lần `certbot certonly`
   bằng webroot; lỗi sẽ dừng để tránh rate limit;
4. ghi reload marker; Nginx watcher render HTTPS config, chạy `nginx -t` rồi reload;
5. xác minh certificate thật qua HTTPS và chạy `certbot renew --dry-run` một lần.

Nếu certificate đã tồn tại, script không request lại mà chỉ validate Nginx/HTTPS.
Certbot service sau đó chạy `renew` mỗi 12 giờ. Deploy hook cập nhật marker trong
persistent webroot; watcher chỉ reload sau `nginx -t`. Không mount Docker socket và
không chia sẻ PID namespace.

Acceptance criteria bootstrap:

- ACME HTTP-01 pass, certificate chain hợp lệ cho đúng domain và HTTPS health trả
  success;
- `docker compose ... ps nginx certbot` cho thấy Nginx và Certbot đều healthy;
- renewal dry-run pass và reload marker hoạt động;
- chỉ hai TLS volumes mới được tạo; identity của PostgreSQL/Redis volumes không đổi.

Điểm dừng: DNS/SG/port sai, email Certbot thiếu, challenge không đọc được, Let's
Encrypt rate-limit/error, certificate không hợp lệ, Nginx config test fail hoặc
resource gate fail. Không retry issuance tự động và không chuyển sang Phase 2.

### Smoke test và acceptance criteria Phase 1

Workflow kiểm tra cả từ EC2 và từ GitHub-hosted runner:

- HTTP `/` trả `308` tới đúng HTTPS URL; HTTP `/nginx-health` vẫn phục vụ ACME
  bootstrap/diagnostic;
- HTTPS `/nginx-health`, frontend `/` và backend `/api/` trả success;
- Nginx và Certbot healthy, không OOM;
- application snapshot và data-volume snapshot trước/sau giống hoàn toàn;
- postflight resource gate pass, không có kernel OOM mới từ thời điểm phase bắt đầu;
- log ghi riêng `application_sha` và `config_sha`, không in env hoặc secret.

Phase 1 kết thúc ở acceptance hạ tầng edge: AWS/DNS/80/443, bootstrap, renewal,
external HTTPS smoke và invariants của edge-only deployment. Auth/cookie và
postflight application/resource được xác nhận ở Phase 2 bằng tài khoản synthetic;
repository/workflow không lưu staging login secret hoặc cookie/token.

### Rollback edge-only

Rollback có hai lớp. Trap trong phiên SSH được arm sau khi preflight và snapshot
pass để bắt lỗi apply/bootstrap/remote smoke. Một bước `if: failure()` riêng xử lý
lỗi external smoke hoặc finalize dựa trên `dentflow-edge-pending`. Workflow:

1. stop/remove chỉ container `nginx` và `certbot` của target config;
2. checkout lại previous `config_sha`;
3. nếu previous SHA đã có edge Compose, recreate đúng hai edge services bằng
   `--no-deps --force-recreate`; lần bootstrap đầu chưa có previous edge thì giữ
   application như cũ và để port 80/443 đóng;
4. so sánh lại application/container và PostgreSQL/Redis volume snapshots.

Rollback không chạy `docker compose down`, không xóa hai TLS volumes, không pull
hoặc đổi application image, không migration, không chạm database/Redis và không
xóa/recreate data volumes. Nếu rollback edge cũng fail, dừng thủ công; không thử
khởi động lại toàn stack. Certificate volumes được giữ để lần triển khai sau có thể
tái sử dụng an toàn.

Nếu workflow bị hủy hoặc mất kết nối đúng khoảng giữa remote apply và bước
finalize/rollback, file pending còn lại làm lần edge deployment sau fail closed.
Operator phải review trạng thái thực tế và chạy rollback theo đúng previous SHA;
không xóa file pending chỉ để bỏ qua gate.

## Phase 2: synthetic seed và application acceptance

Phase 2 hoàn tất ngày 2026-10-20 trên application SHA
`c8bb78d59ec9555b7f62e7efacf5838655642475` và config SHA
`4c3596ff2c882dd5eab85893e6a91eb757394575`.

### Seed được sử dụng

Preflight xác nhận 15 file SQL trong `dist/database/seeds/dev`, seed runner và
application image cùng thuộc application SHA ở trên. `seed-runner.js` chỉ chạy
các file theo thứ tự trong một transaction; không gọi reset, `TRUNCATE`, migration,
build hoặc deploy. Trước khi chạy, toàn bộ bảng đích có `0` row và chỉ bảng
`migrations` có 29 row, nên không có dữ liệu hiện hữu bị ghi đè hoặc trùng lặp.

Seed được chạy đúng một lần bằng cơ chế hiện có:

```bash
docker compose --env-file /etc/dentflow/staging.env \
  -f docker-compose.staging.yml \
  run --rm --no-deps --interactive=false -T \
  -e NODE_ENV=development backend node dist/database/seed-runner.js
```

Không dùng `reset:dev`, `refresh:dev`, migration hoặc seed tự viết. Một one-off
container dùng đúng backend image đã deploy và được xóa bởi `--rm`; sáu container
dịch vụ không bị recreate. Kết quả commit đủ 15 file seed:

| Dữ liệu synthetic | Số lượng |
| --- | ---: |
| Email-template revision | 4 |
| Tenant / Branch / User | 3 / 5 / 11 |
| Tenant membership / Platform role / Tenant-branch role | 10 / 1 / 14 |
| SaaS plan / Subscription / Tenant owner | 6 / 3 / 3 |
| Service group / Service / Operatory | 18 / 117 / 20 |
| Patient / Appointment / Status transition / Visit | 22 / 80 / 178 / 18 |
| Treatment plan / Item / Event | 30 / 56 / 39 |
| Patient alert / Tenant display counter | 5 / 3 |

11 tài khoản đều là fixture synthetic `@dentflow.local` đã mô tả trong
`docs/08-demo-and-testing.md`; tài liệu triển khai không ghi password hay giá trị
credential. Treatment Plan có đúng 5 row cho mỗi trạng thái `DRAFT`, `PROPOSED`,
`ACCEPTED`, `PARTIALLY_COMPLETED`, `COMPLETED`, `CANCELLED`.

### Auth/cookie và postflight

Smoke chạy qua public HTTPS, không in token hoặc giá trị cookie:

- login `200`; `GET /api/auth/me` sau login `200` và trả đúng synthetic user;
- refresh `200`, rồi `GET /api/auth/me` tiếp tục `200`;
- login và refresh đều set đúng hai cookie: access cookie `Path=/`, refresh cookie
  `Path=/api/auth`; cả hai có `Secure`, `HttpOnly`, `SameSite=Lax`;
- logout `204`, clear cả hai cookie theo đúng path; `me` và refresh sau logout đều
  trả `401`;
- một session synthetic từ lần thu thập metadata bị dừng sớm do client parser đã
  được revoke ngay; postflight có `0` auth session active.

Postflight pass:

- HTTP `/` trả `308` tới đúng HTTPS URL; HTTPS `/`, `/api/` và `/nginx-health`
  trả `200` với TLS verification thành công; unauthenticated `/api/auth/me` trả
  `401`;
- PostgreSQL, Redis, backend, frontend, Nginx và Certbot đều healthy, restart
  count `0`, `OOMKilled=false`; application SHA/config SHA và container identity
  không đổi;
- hai data volume `dentflow-staging_postgres_data` và
  `dentflow-staging_redis_data` giữ nguyên identity/mountpoint; không có volume bị
  xóa hoặc recreate;
- resource gate pass với `MemAvailable` khoảng 387 MiB, swap total 1023 MiB dùng
  khoảng 185 MiB, root disk dùng 35% và còn khoảng 12.1 GiB; không có kernel OOM
  mới trong Phase 2.

Acceptance Phase 2: **PASS**. AWS IAM identity dùng cho kiểm tra vẫn không có
`ec2:DescribeInstances`, nên checklist vận hành `2/2 status checks` phải được xác
nhận định kỳ trên AWS Console. Trạng thái Phase 3 hiện tại được ghi ở phần tiếp
theo; backup Phase 3C và restore drill cô lập Phase 3D đều đã pass.

## Phase 3: S3 smoke và database recovery drill

Phase 3 dùng lại application SHA
`c8bb78d59ec9555b7f62e7efacf5838655642475` và config SHA
`4c3596ff2c882dd5eab85893e6a91eb757394575`. Không build, migration, seed,
reset, deploy, recreate container hoặc thay đổi named volume.

### Phase 3A: read-only preflight

Phase 3A hoàn tất ngày 2026-10-21:

- đủ sáu container healthy, restart count `0`, `OOMKilled=false`; application và
  volume identity khớp baseline Phase 2;
- HTTPS frontend, `/api/` và `/nginx-health` trả `200`; HTTP redirect và TLS
  verification pass từ EC2 và operator machine;
- không có kernel OOM trong 24 giờ; `MemAvailable` khoảng 395 MiB, swap total
  1023 MiB dùng khoảng 186 MiB, root disk dùng 35% và còn khoảng 12.3 GiB;
- S3 runtime config đã enable; bucket, region và presigned TTL đều có giá trị,
  custom endpoint không được cấu hình;
- backend dùng static credentials của IAM user, không dùng instance role. Cấu
  hình này đã được operator chấp nhận cho staging; IAM Role/IMDSv2 chỉ là cải
  tiến hardening tùy chọn trong tương lai.

Acceptance Phase 3A: **PASS**.

### Phase 3B: S3 browser smoke và IAM least privilege

Smoke chỉ dùng fixture ảnh synthetic 512x512 dưới 2 MiB và các dev account
synthetic hiện có. Không chạy Browser E2E suite hiện tại vì suite có hook reset
database. Script chẩn đoán một lần chỉ dùng UI/API production path, không được
commit vào repository và không ghi login, cookie, object key, presigned URL hoặc
presigned fields.

Browser/API checks đã pass:

- unauthenticated upload intent trả `401`; branch-scoped user được phép ở branch
  đã gán, branch khác cùng tenant và cross-tenant đều trả `403`; tenant admin được
  phép ở branch khác cùng tenant;
- MIME không hỗ trợ trả `422`, generic image vượt 2 MiB trả `413`;
- browser lấy upload intent `201` rồi POST trực tiếp tới S3 `204`; URL dùng HTTPS,
  CORS trả đúng staging origin, server-generated key đúng tenant/branch prefix và
  intent có TTL ngắn;
- thay `Content-Type` hoặc object key trong signed POST đều bị S3 từ chối `403`;
  raw unsigned object URL trả `403`;
- avatar flow upload temp, `HeadObject`/copy, update profile và presigned GET đều
  pass; frontend render được ảnh, download trả `200`, đúng MIME và SHA-256 bytes
  khớp fixture; URL bỏ signature trả `403`;
- xóa avatar qua UI trả profile về `avatarUrl=null`; signed URL cũ trả `404`, xác
  nhận permanent avatar object đã bị xóa. Generic temp object của diagnostic
  upload được để lại cho lifecycle; IAM user hiện không có quyền đọc lifecycle
  configuration để xác minh độc lập từ CLI/API.

Credential và IAM checks, chỉ xuất trạng thái `allowed/denied`:

- STS xác nhận principal là IAM user; không ghi ARN, account ID hoặc access key;
- application-required Put/Head/Get/Copy/Delete path đã pass qua browser/avatar
  flow;
- `ListBuckets`, bucket policy/public-access/encryption/CORS/lifecycle reads và
  IAM self-inspection đều bị từ chối;
- `ListObjectsV2` trên application bucket lại được phép. Application không dùng
  quyền này, vì vậy IAM policy chưa đạt least privilege. Operator chấp nhận đây
  là staging deviation và không coi là blocker của Phase 3;
- không thể xác nhận access-key age/last-used hoặc policy document bằng principal
  hiện tại vì các IAM read calls bị từ chối. Các mục này cần operator kiểm tra qua
  AWS Console hoặc một audit principal read-only;
- `/etc/dentflow/staging.env` có mode `0640`, thư mục cha `0750`. Static key vẫn
  hiện diện trong container runtime environment, nên mọi principal có Docker
  access trên EC2 có thể đọc được; giới hạn SSH/Docker access và rotation định kỳ
  là bắt buộc khi còn dùng static credentials.

Một browser run chẩn đoán đầu tiên dừng trước upload do locator không duy nhất và
đóng context trước logout. Sau khi được duyệt, transaction có guard xác nhận đúng
một active session của synthetic tenant-admin rồi revoke đúng row đó; active
session của user này giảm từ `1` xuống `0`, tổng active session giảm từ `2` xuống
`1`. Session còn lại thuộc synthetic user khác và không bị thay đổi. Run tiếp theo
logout thành công. Không có credential/token/cookie được ghi lại.

Postflight vẫn pass: sáu container healthy, restart count `0`, `OOMKilled=false`,
container/data-volume identity không đổi, HTTPS/API pass, `MemAvailable` khoảng
395 MiB, root disk dùng 35% và không có kernel OOM mới.

Acceptance browser upload/download/authorization: **PASS**. Acceptance IAM least
privilege: **ACCEPTED DEVIATION** cho quyền `s3:ListBucket`. Acceptance Phase 3B
tổng thể: **PASS**. IAM policy, static credentials và S3 infrastructure giữ
nguyên. Generic temp object được để lifecycle xử lý.

### Phase 3C: automated PostgreSQL backup lên S3

Phase 3C hoàn tất ngày 2026-10-21 bằng phương án S3 thay cho ổ D operator:

- bucket riêng `dentflow-staging-pg-backups` ở `ap-southeast-1`, private, dùng
  SSE-S3 (`AES256`) và lifecycle 30 ngày. Backup IAM user không có quyền đọc
  bucket configuration; lifecycle/default-encryption/public-access settings được
  operator xác nhận trên AWS Console, còn SSE-S3 được xác minh trực tiếp bằng
  `HeadObject` và policy thực tế từ chối upload thiếu encryption header;
- IAM user riêng `dentflow-staging-backup` chỉ list được prefix
  `postgresql/staging/`, có quyền ghi/đọc object và hoàn tất/abort multipart cần
  cho backup. Principal không list được bucket root hoặc toàn account, không đọc
  IAM và không có `s3:DeleteObject`;
- static backup credential nằm riêng tại `/etc/dentflow/backup.env`, owner
  `root:root`, mode `0600`; không dùng lại `/etc/dentflow/staging.env`, không đưa
  credential vào application container, command line, journal hoặc runbook;
- script `/usr/local/sbin/dentflow-postgres-backup` có owner `root:root`, mode
  `0750`. Service và timer nằm tại `/etc/systemd/system/` với mode `0644`; service
  chạy root, `Nice=10`, best-effort I/O priority, có lock chống chạy trùng và
  resource gate yêu cầu tối thiểu 300,000 KiB `MemAvailable`;
- timer chạy lúc `02:30 Asia/Ho_Chi_Minh` mỗi ngày, `Persistent=true`. Chỉ sau khi
  manual backup và toàn bộ postflight pass, timer mới được bật; trạng thái hiện là
  `enabled` và `active`.

Script dùng đúng `pg_dump 16.15`, custom format, Zstandard level 3, một process,
`--no-owner`, `--no-privileges` và lock wait timeout 10 giây. Dump được stream qua
FIFO đồng thời tính SHA-256 và upload trực tiếp bằng HTTPS với SSE-S3; không có
plaintext dump file trên EC2. Sau upload, script kiểm tra object size/encryption,
stream object từ S3 về để tính lại SHA-256 và chạy `pg_restore --list` bằng
`postgres:16-alpine` one-off container có `--network none`, read-only filesystem,
không mount volume. File `.sha256` chỉ được upload sau khi cả checksum và
readability check pass. Nếu verification fail, không có success sidecar; object
chưa hoàn chỉnh được lifecycle xử lý vì backup principal cố ý không có quyền xóa.

Manual backup đầu tiên pass:

- source database size 11,451,415 bytes; archive 175,091 bytes;
- `pg_dump`, upload, `HeadObject`, SSE-S3, tải lại, SHA-256 byte-for-byte và
  `pg_restore --list` đều pass; independent verification sau service cũng pass;
- không còn thư mục temp trong `/run`; không ghi plaintext dump xuống EC2 hoặc
  operator machine;
- sáu staging container vẫn healthy, restart count `0`, `OOMKilled=false`;
  PostgreSQL container và named volume `dentflow-staging_postgres_data` giữ nguyên
  identity; HTTPS frontend và API đều trả `200`;
- postflight ghi nhận `MemAvailable` khoảng 387 MiB, swap dùng khoảng 169 MiB,
  root disk dùng 35% và không có kernel OOM mới.

Kiểm tra vận hành mà không in credential:

```bash
sudo systemctl status dentflow-postgres-backup.timer --no-pager
sudo systemctl list-timers dentflow-postgres-backup.timer --no-pager
sudo systemctl status dentflow-postgres-backup.service --no-pager
sudo journalctl -u dentflow-postgres-backup.service --since '2 days ago' --no-pager
```

Một run thành công phải có `status=PASS`, service `Result=success`, object `.dump`
và sidecar `.sha256` cùng SSE-S3. Khi fail, xem `stage`/`reason` trong journal;
không tự chạy migration, reset, restore hoặc xóa object để xử lý lỗi. Credential
rotation phải thay atomic file `backup.env` bằng quyền `0600`, xác minh STS đúng
backup user rồi chạy manual service trước khi giữ timer active.

Nguồn tái lập cho EC2 mới nằm tại `deploy/postgres-backup/`, gồm backup script,
systemd service/timer, environment example, AWS policy/lifecycle templates,
installer và acceptance verifier. Các file này không chứa credential. Installer
chỉ cài file sau khi kiểm tra IAM boundary và luôn giữ timer disabled; verifier
chỉ bật timer với option `--enable-timer` sau khi manual backup cùng toàn bộ
resource, HTTPS/API, container và volume gates pass. Xem
`deploy/postgres-backup/README.md` để cài mới, rotate key và kiểm tra drift.

Việc thêm nguồn tái lập không tự reconcile hoặc deploy lại EC2 hiện tại. Khi cần
đưa instance đang chạy về đúng bản trong repository, phải dùng maintenance window,
disable timer, review diff/checksum, chạy installer và lặp lại manual acceptance;
không copy credential hoặc file runtime ngược vào repository.

Acceptance Phase 3C: **PASS**.

### Phase 3D: isolated PostgreSQL restore drill

Phase 3D hoàn tất ngày 2026-10-21 với backup tự động tạo lúc
`02:30 Asia/Ho_Chi_Minh`. Operator tải đúng cặp `.dump`/`.sha256` từ private S3
bucket; application IAM user bị từ chối truy cập bucket backup đúng theo boundary
Phase 3C. Không sao chép backup credential khỏi EC2 và không kết nối PostgreSQL
staging.

Runner tái lập nằm tại `deploy/postgres-backup/restore-drill.sh`. Trước restore,
runner xác minh sidecar chỉ chứa một SHA-256 và đúng tên dump, checksum khớp
byte-for-byte, archive có kích thước `175,088` bytes và `pg_restore --list` đọc
được bằng image `postgres:16-alpine` có sẵn local.

Restore thực tế pass với các guard sau:

- container disposable dùng PostgreSQL 16, `network=none`, không publish host
  port, giới hạn CPU/RAM/PID và lưu PostgreSQL data trên `tmpfs`;
- `pg_restore` dùng `--exit-on-error`, `--single-transaction`, `--no-owner` và
  `--no-privileges` vào database local mới;
- database sau restore có 32 bảng public, 29 migration records, 41 rows tổng ở
  bốn bảng lõi `users`/`tenants`/`branches`/`patients` và kích thước 11,205,655
  bytes; runner không in nội dung row;
- đủ năm bảng lõi gồm `appointments`, không có constraint chưa validate hoặc
  index invalid;
- trap đã xóa container sau PASS; kiểm tra sau drill không còn container
  `dentflow-phase3d-*`. Hai file backup local được xóa sau khi ghi nhận acceptance;
  object S3 và staging containers/volumes không bị thay đổi.

Acceptance Phase 3D: **PASS**. Phase 3 hoàn tất với IAM `s3:ListBucket` deviation
đã được chấp nhận ở Phase 3B; tiếp tục theo dõi backup timer và retention định kỳ.
