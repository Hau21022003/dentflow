# DentFlow Backend

Backend NestJS cho DentFlow. Tài liệu sản phẩm, tenant isolation, phân quyền,
payment và background jobs nằm tại [../docs/README.md](../docs/README.md).

## Chạy local

```powershell
cd backend
npm install
Copy-Item .env.development.example .env.development
npm run setup:dev
npm run start:dev
```

Khi thay đổi fixture development, dùng các lệnh sau thay vì xóa/tạo lại database:

```powershell
# Chỉ reset data trong schema public, giữ lại migration history, rồi nạp seeds/dev.
npm run reset:dev

# Apply migration pending trước, sau đó reset và nạp lại development fixtures.
npm run refresh:dev
```

`reset:dev` và `refresh:dev` chỉ chạy khi `.env.development` đặt
`ALLOW_DEV_DB_RESET=true`. Chúng xóa toàn bộ data tự tạo trong schema `public`
(trừ migration history), không xóa Redis hay object storage. Dùng database development
local riêng và không chạy lúc backend đang phục vụ request.

`setup:dev` chạy migration và seed dữ liệu synthetic. Chỉ cấu hình
`.env.development` trỏ vào database local dành riêng cho development.

Các lệnh thường dùng:

```powershell
npm test
npm run build
npm run lint
```

`npm run lint` chạy ESLint với `--fix`. Dùng `npx eslint
"{src,apps,libs,test}/**/*.ts"` khi chỉ muốn kiểm tra mà không sửa file.

Để chạy E2E, tạo database test riêng và dùng configuration test:

```powershell
Copy-Item .env.test.example .env.test
npm run setup:test
npm run test:e2e
```

## Cấu trúc mã nguồn

```text
src/
  common/           # HTTP và cross-cutting primitives dùng chung
  config/           # env validation, typed runtime configuration
  database/         # TypeORM data source, migrations và synthetic seeds
  infrastructure/   # adapter cho external providers
  i18n/             # translations và i18n services
  modules/          # domain/application modules
  app.module.ts     # application composition root
```

### `common/`

Chỉ chứa thành phần không thuộc một domain cụ thể: decorators, pipes, filters,
request context, logging và utility thuần. Không đặt provider SDK, repository
hay business workflow vào đây.

### `config/`

Chịu trách nhiệm validate biến môi trường và chuyển chúng thành các contract
typed dùng tại runtime. Cấu hình provider có type riêng, ví dụ
`email.config.ts`, để infrastructure không phải phụ thuộc vào
`AppConfigService` chỉ để dùng type.

### `infrastructure/`

Chứa integration adapter có side effect với hệ thống bên ngoài. Mỗi capability
có Nest module riêng; `InfrastructureModule` chỉ tổng hợp và export chúng tại
application composition root. Domain module cần một integration phải import
module nhỏ nhất cần dùng, không dựa vào provider global.

Hiện có `infrastructure/email`:

- Export `EMAIL_SENDER`, một port nội bộ với `send({ to, subject, text, html })`.
- Chọn adapter SMTP (`nodemailer`) hoặc Amazon SESv2 theo `MAIL_PROVIDER`.
- Sender address luôn là `MAIL_FROM`; caller không thể override.
- Ở development và staging, mọi recipient được thay bằng `MAIL_REDIRECT_TO`.
  Production gửi đến recipient gốc.
- Adapter không có template, queue, controller, notification state hoặc business
  knowledge. Notification workflow tương lai thuộc `modules/notifications` và
  phải theo [background-job architecture](../docs/10-background-jobs-architecture.md).

Ví dụ domain module inject email port:

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  EMAIL_SENDER,
  EmailSender,
} from 'src/infrastructure/email';

@Injectable()
export class ExampleService {
  constructor(
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}
}
```

### `modules/`

Mỗi thư mục là một domain/application capability, ví dụ auth, authorization,
tenant, branch, audit và subscription plans. Module sở hữu controller, service,
repository, entity và policy của domain đó. Infrastructure adapter không được
import module nghiệp vụ hoặc quyết định business state.

## Quy tắc dependency và tenant isolation

```text
HTTP controller -> domain module -> infrastructure port -> external provider
```

- `common/` không phụ thuộc `modules/` hoặc `infrastructure/`.
- Infrastructure không biết tenant workflow hay business entity; domain module
  chịu trách nhiệm xác thực authorization và tenant context trước khi gọi adapter.
- Mọi dữ liệu tenant-owned phải query theo tenant context đã xác thực ở server,
  không theo tenant ID do client tự cung cấp.
- Không đưa dữ liệu bệnh nhân thật vào seed, test hoặc log.

## Cấu hình email

Chọn một provider trong file environment phù hợp:

```dotenv
MAIL_PROVIDER=smtp # hoặc ses
MAIL_FROM=no-reply@example.test
```

Với SMTP, `MAIL_HOST` và `MAIL_PORT` là bắt buộc. `MAIL_USER` và `MAIL_PASS`
hoặc cùng được cấu hình, hoặc cùng để trống. `MAIL_SECURE` mặc định là `true`
khi port là `465`, còn lại mặc định `false`.

Với SES, `AWS_SES_REGION` là bắt buộc. Có thể cấu hình cả
`AWS_SES_ACCESS_KEY_ID` và `AWS_SES_SECRET_ACCESS_KEY`, hoặc để trống cả hai để
AWS SDK dùng default credential chain (IAM role, AWS profile hoặc environment
credentials).

`MAIL_REDIRECT_TO` là bắt buộc ở development/staging và không có tác dụng ở
production. Không commit file `.env.*` chứa credential thật.
