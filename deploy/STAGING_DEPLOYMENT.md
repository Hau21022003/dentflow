# Bàn giao triển khai DentFlow staging

> Tài liệu này ghi nhận trạng thái triển khai staging hiện có trên branch
> `docker-cicd`. Đây là tài liệu bàn giao, không phải xác nhận rằng staging đã
> được triển khai trên EC2. Không ghi credentials, private key hoặc giá trị
> secret vào tài liệu này.

## Phạm vi và trạng thái hiện tại

Triển khai staging gồm đúng mười file ứng dụng và deployment dưới đây. Các file
này đang có trong working tree tại thời điểm viết tài liệu, nhưng chưa được
commit, push hoặc triển khai.

| File | Trạng thái | Mục đích |
| --- | --- | --- |
| `.dockerignore` | tạo mới | Không đưa source secret, thư mục dependencies, build output và test artifact vào Docker build context. |
| `backend/Dockerfile` | tạo mới | Build NestJS bằng Node 22, sau đó chạy ứng dụng đã compile trong image Node 22 chỉ có production dependencies. |
| `client/Dockerfile` | tạo mới | Build Vite ở mode `staging` và phục vụ SPA tạo ra bằng Nginx. |
| `client/nginx.conf` | tạo mới | Cấu hình Nginx nội bộ cho frontend, gồm fallback cho React Router SPA. |
| `docker-compose.staging.yml` | tạo mới | Topology staging gồm PostgreSQL, Redis, backend và frontend. |
| `client/.env.staging` | chỉnh sửa | Đặt `VITE_API_ENDPOINT=/api`. |
| `client/src/config/env.ts` | chỉnh sửa | Chỉ cho phép đúng `/api` khi Vite mode là `staging`; mọi mode khác vẫn yêu cầu URL tuyệt đối. |
| `deploy/nginx/dentflow-staging.conf` | tạo mới | Nginx virtual-host template trên EC2 cho frontend, API proxy và bước khởi tạo Certbot. |
| `.github/workflows/browser-e2e.yml` | chỉnh sửa | Workflow CI tên `CI`, chỉ nhắm branch `docker-cicd`. |
| `.github/workflows/deploy-staging.yml` | tạo mới | Workflow CD staging qua SSH, chỉ dùng commit SHA đã được CI kiểm tra thành công. |

### Ma trận hoàn thành

- [x] Dockerfile, Docker Compose, Nginx template, relative API URL cho frontend staging, CI workflow và CD workflow đã được viết ở local.
- [x] Đã kiểm tra local: backend build; 70 backend unit test; frontend lint; frontend production và staging build; Docker image backend/frontend; Docker Compose YAML parsing; Nginx syntax; GitHub Actions workflow linting.
- [x] Compose không public PostgreSQL/Redis và chỉ bind backend/frontend vào `127.0.0.1`.
- [ ] Mười file triển khai chưa được commit hoặc push.
- [ ] EC2, IAM role, cấu hình S3 bucket, DNS, Nginx host, certificate, GitHub Secrets và GitHub Actions run chưa được cấu hình hoặc xác minh thực tế bởi công việc này.
- [ ] Chưa thêm hoặc sửa production configuration.
- [ ] Chưa chạy migration, seed, reset database, xóa volume hoặc deploy nào trên staging.

## Kiến trúc đã implement

```text
Internet
  |
  | HTTPS :443 / HTTP :80
  v
Nginx trên EC2 host (cài trực tiếp trên Ubuntu)
  |-- /         -> 127.0.0.1:8080 -> Nginx trong frontend container -> Vite SPA
  `-- /api/     -> 127.0.0.1:3000 -> backend container -> PostgreSQL / Redis

Docker Compose network: dentflow-staging_default
  |-- postgres  -> named volume: dentflow-staging_postgres_data
  |-- redis     -> named volume: dentflow-staging_redis_data
  |-- backend
  `-- frontend
```

### Hoạt động của Docker Compose

`docker-compose.staging.yml` định nghĩa đúng bốn services:

- `postgres`: `postgres:16-alpine`, dùng named volume `postgres_data`. Service
  không có `ports`, nên không public ra EC2 host.
- `redis`: `redis:7-alpine`, chạy `redis-server --appendonly yes`, dùng named
  volume `redis_data`, và cũng không có host port.
- `backend`: build từ `backend/Dockerfile`, nhận `/etc/dentflow/staging.env`,
  và chỉ publish `127.0.0.1:3000:3000`. Compose override DB/Redis endpoint thành
  `postgres:5432` và `redis:6379`; đồng thời ép `NODE_ENV=staging`,
  `RUNTIME_ENV_ONLY=true` và `DB_SYNCHRONIZE=false`.
- `frontend`: build từ `client/Dockerfile` và chỉ publish
  `127.0.0.1:8080:80`.

Luôn truyền `/etc/dentflow/staging.env` bằng option `--env-file` của Compose.
Option này cần thiết vừa để nội suy `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` cho
PostgreSQL, vừa để lệnh thủ công khớp với CD:

```bash
docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml <command>
```

Backend image bao gồm TypeORM data source, migrations và seed SQL assets đã
compile. Lệnh mặc định của container là `node dist/main.js`. Image không tự
chạy migration hoặc seed.

### Route API và cookie

Ứng dụng NestJS không có global `/api` prefix. Các controller hiện có phục vụ
route trực tiếp, ví dụ `/auth`. Host Nginx template chủ động thực hiện ánh xạ
external prefix:

- `GET /api` trả permanent redirect về `/api/`.
- `location /api/` dùng `proxy_pass http://127.0.0.1:3000/`; dấu `/` cuối bỏ
  external prefix `/api/` đúng một lần. Ví dụ `/api/auth/refresh` đến backend
  route `/auth/refresh`.
- `proxy_cookie_path /auth /api/auth` rewrite refresh-cookie path hiện có để
  browser gửi cookie về external refresh/logout routes.
- Mọi path khác proxy đến frontend container. Frontend container dùng
  `try_files ... /index.html`, giữ được React Router deep link.

Browser chỉ gọi `/api` trong Vite `staging` mode. Local development và mọi build
mode khác giữ validation URL tuyệt đối trước đây. `FRONTEND_ORIGIN` trong backend
environment phải là frontend origin đã deploy vì CORS policy hiện có so sánh
incoming origin với giá trị này.

### CI workflow

`.github/workflows/browser-e2e.yml` nay có tên `CI` và chạy cho event `push` và
`pull_request` nhắm đúng `docker-cicd`. Workflow dùng Node 22, bật PostgreSQL và
Redis service container của GitHub Actions, sau đó:

1. copy `backend/.env.test.example` thành `backend/.env.test`;
2. chạy `npm ci` trong `backend`, `client`, `browser-e2e`;
3. chạy `npm --prefix backend test -- --runInBand`;
4. chạy `npm --prefix backend run build`;
5. chạy `npm --prefix client run lint`;
6. chạy `npm --prefix client run build:staging`;
7. cài Chromium và chạy `npm --prefix browser-e2e run test`.

Browser E2E setup hiện có tự khởi động MinIO Compose stack. CI không có SSH,
deploy step, AWS credential hoặc backend lint. Backend lint được chủ động loại
khỏi CI vì baseline repository hiện có lint errors.

### CD workflow

`.github/workflows/deploy-staging.yml` là workflow riêng có tên
`Deploy Staging`.

- `workflow_run` chỉ nhận CI `push` thành công có head branch là `docker-cicd`.
- `workflow_dispatch` nhận input `ref`, nhưng workflow hiện tại chủ động chỉ
  cho phép `docker-cicd`.
- Workflow resolve đúng CI SHA, kiểm tra branch vẫn ở SHA đó, và tuần tự hóa
  deploy bằng concurrency group `dentflow-staging-deploy`.
- Workflow chỉ dùng GitHub Secrets `SSH_PRIVATE_KEY`, `EC2_HOST`, `EC2_USER`.
  Application secret ở `/etc/dentflow/staging.env`, ngoài GitHub và Docker image.
- Trên EC2, workflow yêu cầu `/opt/dentflow` sạch, fetch `docker-cicd`, kiểm tra
  `origin/docker-cicd` đúng SHA đã CI, sau đó checkout SHA đó ở detached HEAD.
- Workflow build image, chỉ start PostgreSQL/Redis, chạy compiled TypeORM
  migration, rồi mới `docker compose up -d --wait`.
- Workflow không seed, reset database, xóa volume hoặc prune Docker data.

Lệnh migration chính xác trong CD là:

```bash
docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml \
  run --rm --no-deps backend \
  node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
```

`workflow_run` và nút manual dispatch chỉ hoạt động khi CD workflow đã tồn tại
trên default branch (`master`). Bước bootstrap riêng này vẫn do người dùng kiểm
soát; không tự merge, rebase, reset hoặc đổi branch state.

## Checklist triển khai staging lần đầu

Hoàn thành các bước theo thứ tự dưới đây. Mọi mục `[ ]` chưa được thực hiện.

### 1. EC2 Ubuntu và deploy checkout

- [ ] Tạo hoặc chọn một Ubuntu EC2 staging instance duy nhất.
- [ ] Security Group mở inbound TCP 80 và 443. SSH TCP 22 có thể giữ theo lựa
  chọn staging hiện tại, nhưng chỉ dùng SSH key; tắt password authentication
  sau khi đã xác nhận deploy key hoạt động.
- [ ] Cài Docker Engine và Docker Compose plugin tương ứng với Ubuntu release
  đang dùng. Repository này yêu cầu đúng lệnh `docker compose`; kiểm tra:

  ```bash
  docker --version
  docker compose version
  ```

- [ ] Bảo đảm deploy user hiện có chạy được `docker compose` mà không cần nhập
  mật khẩu tương tác.
- [ ] Clone approved repository remote vào `/opt/dentflow`, checkout
  `docker-cicd`, và để deploy user sở hữu working tree. CD giả định
  `/opt/dentflow` đã tồn tại, có `origin` remote hoạt động và luôn sạch giữa các
  lần deploy.
- [ ] Bật IMDSv2 trên instance và đặt metadata response hop limit bằng `2`, để
  backend container nhận được credential từ EC2 IAM role.

### 2. IAM role và S3 bucket staging private

- [ ] Gắn EC2 instance role thay vì AWS static credential.
- [ ] Giữ staging bucket private, bật Block Public Access và encryption at rest.
- [ ] Chỉ cấp cho instance role object permissions mà upload implementation hiện
  có cần: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` trên `temp/*`,
  `avatars/*`, `clinical/*`. Bộ quyền này phục vụ presigned upload, Head/Get,
  Copy và cleanup; không cấp public read hoặc broad list access.
- [ ] Cấu hình bucket CORS chỉ cho staging frontend origin và browser presigned
  `POST` upload flow. Chỉ cho methods/headers thực sự cần.
- [ ] Tạo lifecycle rule hết hạn object dưới `temp/` sau một ngày.

### 3. DNS

- [ ] Tạo DNS A record cho staging domain trỏ đến EC2 public IPv4.
- [ ] Xác nhận DNS resolve trước khi yêu cầu certificate:

  ```bash
  getent hosts STAGING_DOMAIN
  ```

Thay `STAGING_DOMAIN` trong command và Nginx configuration bằng domain thực tế;
không ghi domain vào tài liệu này nếu nó được xem là nhạy cảm trong deployment
context.

### 4. Runtime environment file

- [ ] Tạo `/etc/dentflow` với quyền hạn chế, sau đó tạo
  `/etc/dentflow/staging.env` với owner/permissions hạn chế. Giữ file ngoài
  `/opt/dentflow` và ngoài Git.
- [ ] Dùng `backend/.env.example` làm danh sách field, không dùng giá trị
  placeholder trong file đó làm staging credential.
- [ ] Đặt các runtime value không bí mật mà validator hiện tại yêu cầu:
  `NODE_ENV=staging`, `APP_URL`, `FRONTEND_ORIGIN` đã deploy, `APP_NAME`,
  `APP_SHORT_NAME`, database name/user/password, Redis TTL, token expiry,
  login limits, upload size limit và billing provider/currency đã chọn.
- [ ] Tạo giá trị riêng biệt cho JWT access/refresh, audit IP HMAC, idempotency
  HMAC và tenant invitation token secret. Đặt default password variable bắt buộc
  nhưng không ghi giá trị vào source control hoặc tài liệu này.
- [ ] Cấu hình đúng một mail provider được hỗ trợ. SMTP cần `MAIL_HOST`,
  `MAIL_PORT`, và phải có cả `MAIL_USER`/`MAIL_PASS` nếu dùng một trong hai.
  SES cần `AWS_SES_REGION`; credential pair của SES phải hoặc có đủ cả hai, hoặc
  cùng bỏ trống. Staging bắt buộc `MAIL_REDIRECT_TO`.
- [ ] Cho S3 staging, đặt `S3_ENABLED=true`, `AWS_BUCKET`,
  `AWS_DEFAULT_REGION`, `AWS_USE_PATH_STYLE_ENDPOINT=false`, `S3_ENDPOINT`
  rỗng và `S3_PRESIGNED_POST_TTL` phù hợp. Khi dùng EC2 IAM role, để trống S3
  access-key pair; validator chấp nhận pair cùng trống và AWS SDK dùng default
  credential chain.
- [ ] Cấu hình SaaS billing provider được chọn bằng staging credential cần thiết:
  Stripe cần secret key và webhook secret; PayPal cần client ID, client secret
  và webhook ID. Dùng Stripe test hoặc PayPal sandbox.

Compose cung cấp `DB_HOST=postgres`, `DB_PORT=5432`, `REDIS_HOST=redis`,
`REDIS_PORT=6379`, `DB_SYNCHRONIZE=false`, `NODE_ENV=staging` và
`RUNTIME_ENV_ONLY=true` cho backend container. Giữ database credentials trong
`staging.env`, vì Compose dùng chúng để khởi tạo PostgreSQL.

### 5. Khởi động PostgreSQL/Redis lần đầu, migration và seed

- [ ] Từ `/opt/dentflow`, kiểm tra Compose configuration đã resolve đầy đủ:

  ```bash
  docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml config
  ```

- [ ] Build image và chỉ start hai dependency:

  ```bash
  docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml build
  docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml up -d postgres redis
  ```

- [ ] Chạy compiled migration command đúng một lần cho database rỗng ban đầu.
  Đây cũng chính là lệnh CD sử dụng:

  ```bash
  docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml \
    run --rm --no-deps backend \
    node ./node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
  ```

- [ ] Seed synthetic development fixtures đúng một lần, chỉ sau migration và
  chỉ với database staging vừa khởi tạo:

  ```bash
  docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml \
    run --rm --no-deps -e NODE_ENV=development backend \
    node dist/database/seed-runner.js
  ```

  Compiled seed runner map `NODE_ENV=development` sang data
  `dist/database/seeds/dev` đã có trong image. Seed cố ý không nằm trong CD.
  Không chạy lệnh này trên database đã có staging data.

- [ ] Start ứng dụng và chờ Compose health check:

  ```bash
  docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml \
    up -d --wait --wait-timeout 120
  docker compose --env-file /etc/dentflow/staging.env -f docker-compose.staging.yml ps
  ```

### 6. Host Nginx và Certbot

- [ ] Cài Nginx và Certbot Nginx plugin trên EC2.
- [ ] Copy `deploy/nginx/dentflow-staging.conf` từ repository đã checkout vào
  vị trí Nginx site configuration của Ubuntu. Chỉ thay placeholder
  `STAGING_DOMAIN`, enable site theo Nginx layout của host, và giữ nguyên proxy
  directives.
- [ ] Validate và reload trước khi yêu cầu certificate:

  ```bash
  sudo nginx -t
  sudo systemctl reload nginx
  ```

- [ ] Lấy certificate và bật HTTP-to-HTTPS redirect bằng Nginx plugin:

  ```bash
  sudo certbot --nginx -d STAGING_DOMAIN --redirect
  ```

- [ ] Bật Certbot timer, thêm deploy hook reload Nginx sau renewal, rồi kiểm tra
  toàn bộ renewal path:

  ```bash
  sudo systemctl enable --now certbot.timer
  sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
  printf '%s\n' '#!/bin/sh' 'systemctl reload nginx' | \
    sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx >/dev/null
  sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
  sudo certbot renew --dry-run --run-deploy-hooks
  ```

- [ ] Xác minh external routing sau khi cấu hình HTTPS:

  ```bash
  curl -I http://STAGING_DOMAIN
  curl -I https://STAGING_DOMAIN
  curl -i https://STAGING_DOMAIN/api/
  ```

  Dùng authenticated refresh flow để kiểm tra refresh cookie trả về có
  `Path=/api/auth`, không phải backend-internal `/auth` path.

### 7. GitHub Secrets và bootstrap CD

- [ ] Thêm đúng GitHub Actions Secrets: `SSH_PRIVATE_KEY`, `EC2_HOST`,
  `EC2_USER`. SSH key phải tương ứng với EC2 deploy user.
- [ ] Giữ application/AWS settings trong `/etc/dentflow/staging.env` và EC2 IAM
  role. Không thêm chúng thành GitHub Secrets hoặc Docker build arguments.
- [ ] Sau khi review, đưa riêng `deploy-staging.yml` lên default branch
  (`master`) qua branch process đã được duyệt. Đây là điều kiện cần cho
  `workflow_run` trigger và manual dispatch button. Không merge toàn bộ
  `docker-cicd` trong bootstrap này nếu chưa được duyệt riêng.
- [ ] Xác nhận bản CD file trên `master` vẫn lắng nghe workflow tên `CI` và
  branch `docker-cicd` trước khi trigger deployment.

### 8. Xác minh push → CI → CD → staging

- [ ] Commit và push các staging file đã review lên `docker-cicd`.
- [ ] Xác nhận `CI` chạy đầy đủ unit/build/lint/E2E và không dùng deployment
  credential hoặc AWS credential.
- [ ] Giải quyết Browser E2E failure bên dưới trước khi kỳ vọng CI thành công
  để trigger CD.
- [ ] Sau CI push run thành công, xác nhận `Deploy Staging` nhận đúng run,
  resolve cùng `head_sha` và chờ thay vì chạy chồng một staging deployment khác.
- [ ] Trong EC2 deployment log, xác nhận checkout SHA và dòng cuối
  `Deployed <sha>` khớp với CI SHA.
- [ ] Xác nhận migration xong trước backend recreate, `docker compose ps` khỏe,
  PostgreSQL volume giữ nguyên data, và public HTTPS frontend/API check pass.
- [ ] Test manual `workflow_dispatch` với `ref=docker-cicd`. Workflow chỉ được
  deploy branch tip hiện tại khi chính SHA đó có push CI run thành công.

## Vấn đề còn tồn tại và lưu ý vận hành

### Browser E2E hiện chặn CI xanh

- [x] Lần chạy local hoàn thành 57/58 Browser E2E tests.
- [ ] Suite chưa xanh: `browser-e2e/tests/visits.spec.ts`, test
  `Dentist starts, saves, completes, and adds to a Visit`, fail vì exact-text
  locator cho `Female` resolve thành hai phần tử. Các staging file không sửa UI
  hoặc test này.
- [ ] Vì CD chỉ nhận CI thành công, lỗi này phải được giải quyết hoặc đánh giá
  trong một thay đổi ứng dụng/test được duyệt riêng trước khi automatic CD chạy
  thành công.

### Rủi ro synthetic seed

- [ ] Development seed là synthetic nhưng tạo test account dùng default password
  dùng chung đã biết, bao gồm Platform Admin account. Không ghi password vào đây
  hoặc chia sẻ nó ngoài staging team được cấp quyền.
- [ ] Khi staging domain public, bất cứ ai biết fixture credential có thể truy
  cập synthetic staging data. Hạn chế access phù hợp và quyết định riêng việc
  có cần đổi fixture credential trước khi chia sẻ rộng rãi hay không.
- [ ] Không bao giờ chạy seed command trong regular CD hoặc với database staging
  đã tồn tại. Seed cố ý không có trong `deploy-staging.yml`.

### Các implementation fact khác

- [ ] CD workflow lấy EC2 host key bằng `ssh-keyscan` lúc deploy vì bộ secret đã
  thống nhất không có pinned known-hosts value. Cách này đơn giản cho staging,
  nhưng không có cơ chế xác minh host fingerprint out-of-band.
- [x] Docker image tag/base-image version đúng như Dockerfile/Compose hiện có:
  `node:22-bookworm-slim`, `nginx:1.27-alpine`, `postgres:16-alpine`,
  `redis:7-alpine`.
- [x] Implementation chủ động không có production infrastructure, CloudFront,
  Route 53 automation, Terraform, ECR, ECS, Kubernetes, database reset/prune,
  automatic seeding, backup hoặc monitoring system.

## Workflow branch hiện tại và chuyển sang `master` sau này

### Giai đoạn hiện tại: `docker-cicd`

- [x] CI trigger cho push và pull request nhắm `docker-cicd`.
- [x] CD được viết để chỉ deploy `docker-cicd` sau CI push run thành công.
- [ ] CD chưa trigger được cho đến khi workflow file của nó tồn tại riêng trên
  default branch `master`.
- [ ] Không xóa `docker-cicd` khi nó vẫn là staging CI/CD target.

### Giai đoạn sau: chuyển staging automation sang `master`

Chỉ thực hiện sau khi staging ổn định và việc merge vào `master` đã được duyệt.

- [ ] Merge application changes qua approved process.
- [ ] Đổi CI `push` và `pull_request` branch filters từ `docker-cicd` sang
  `master`.
- [ ] Đổi CD `workflow_run.branches` filter, dispatch default và cả hai
  branch-equality guard từ `docker-cicd` sang `master`.
- [ ] Push workflow changes qua approved process và xác minh một `master` CI run
  thành công trigger CD đúng cùng SHA.
- [ ] Chỉ sau bước xác minh này mới quyết định riêng việc giữ hoặc xóa
  `docker-cicd`.

## Resume trong Codex session mới

Dùng prompt ngắn sau trong session mới:

> Đọc kỹ `deploy/STAGING_DEPLOYMENT.md`. Chúng ta đang tiếp tục triển khai
> DentFlow staging từ branch `docker-cicd`. Trước hết kiểm tra Git status hiện
> tại và đối chiếu mười staging file được ghi trong tài liệu với working tree.
> Không sửa application, Docker, Compose, Nginx, CI/CD hoặc branch state nếu tôi
> chưa duyệt checklist item tiếp theo. Báo cáo bước an toàn tiếp theo và mọi
> điểm không khớp giữa tài liệu với code.

