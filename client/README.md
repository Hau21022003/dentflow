# DentFlow frontend

Frontend của DentFlow được xây bằng React, TypeScript, Vite, Tailwind CSS và
React Router. File này là bản đồ ngắn gọn cho người phát triển và AI trước khi
thêm hoặc sửa giao diện.

## Chạy dự án

Tại thư mục `client`:

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Cấu trúc chính

| Đường dẫn | Vai trò |
| --- | --- |
| `src/app` | Providers, layout, router, route guards và điều hướng theo vai trò. |
| `src/pages` | Các page theo route; page không chứa logic gọi HTTP phức tạp nếu có thể tách vào feature. |
| `src/features` | Logic theo domain phía client: types, service, hooks React Query và state cục bộ. Hiện có `auth`. |
| `src/components/ui` | UI primitives theo cấu hình shadcn `base-nova`. Tái sử dụng trước khi tạo component mới. |
| `src/components/shadcntable` | DataTable dùng chung, dựa trên TanStack Table v8. Xem phần DataTable bên dưới. |
| `src/shared` | HTTP client, constants, utilities và component dùng chung không thuộc một feature. |
| `src/i18n` | Cấu hình i18next, namespace và bản dịch `vi`/`en`. |
| `src/config` | Cấu hình môi trường phía client. |

Đường dẫn route tập trung ở `src/app/router/paths.ts`; khai báo route và guard
ở `src/app/router/routes.tsx`.

## Quy ước frontend

- Dùng alias `@/` cho `src/`; utilities là `@/shared/lib/utils`.
- API đi qua HTTP client tại `src/shared/lib/http.ts`. Tạo service và React
  Query hook trong feature phù hợp, thay vì gọi `fetch` trực tiếp trong page.
  Endpoint chỉ được một service/feature dùng thì khai báo trực tiếp tại service;
  chỉ đưa vào `src/shared/constants/endpoint.constants.ts` khi URL thực sự được
  tái sử dụng ở nhiều nơi.
- Route guard chỉ phục vụ UX. Backend vẫn phải xác thực quyền và tenant context
  cho mọi request.
- Chỉ dùng dữ liệu demo synthetic. Không đưa dữ liệu bệnh nhân thật vào mock,
  story hoặc screenshot.
- Text hiển thị mới cần được đưa vào i18n. Các namespace hiện đăng ký tại
  `src/i18n/index.ts`; thêm namespace theo domain khi cần, thay vì dồn mọi thứ
  vào `common`.
- Kiểm tra `npm run lint` và `npm run build` sau thay đổi.

## UI primitives

`components.json` dùng style `base-nova`. Một số primitive hiện dùng Base UI;
hãy giữ đúng API của primitive đang import. Ví dụ trigger Base UI nhận element
qua prop `render`, không dùng `asChild` của Radix.

Không ghi đè component trong `src/components/ui` bằng lệnh registry nếu chưa
xem `--dry-run` và `--diff`, vì chúng là UI foundation đang được các page dùng
chung.

## DataTable

DataTable dùng chung nằm tại `src/components/shadcntable/data-table.tsx` và dựa
trên `@tanstack/react-table` v8.21.3. POC read-only hiện có tại route
`/platform/tenants` trong `src/pages/platform/TenantManagementPage.tsx`.

```tsx
import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
```

- Dùng `DataTableColumnHeader` cho cột cần sort, filter hoặc ẩn/hiện.
- Truyền `locale` cho text của bảng; về sau map object này từ i18n `vi`/`en`.
- POC hiện xử lý search, filter, sort và pagination ở client với mock data.
- DataTable đã hỗ trợ server-side pagination qua `pagination.manual`,
  `pageIndex`, `pageSize`, `rowCount` và `onPaginationChange`. Khi nối API thật,
  cần mở rộng tiếp server-side search, filter và sort; không được chỉ lọc/sort
  trên một trang dữ liệu đã tải.
- Khi dùng `DropdownMenuLabel` với Base UI, đặt nó trong `DropdownMenuGroup`.

Thư mục này là source đã được đưa vào dự án và chỉnh tương thích với UI
foundation hiện tại. **Không chạy lại** lệnh sau để cài DataTable:

```bash
npx shadcn@latest add https://shadcntable.com/r/data-table.json
```

Lệnh registry này không giữ cấu trúc `shadcntable` của dự án và có thể ghi đè
các primitive trong `src/components/ui`. Nếu cần nâng cấp, so sánh source bằng
`--dry-run` và `--diff`, rồi áp dụng thủ công các thay đổi cần thiết.

## Tài liệu nghiệp vụ

Trước thay đổi liên quan đến nghiệp vụ, API, quyền, billing hoặc workflow, đọc
[`../docs/README.md`](../docs/README.md) và tài liệu domain liên quan. Tenant
isolation là bất biến: UI không thay thế việc backend xác minh tenant context.
