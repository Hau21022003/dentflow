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

## Thêm hoặc sửa workspace route

Đọc phần này trước khi thêm route dưới `/workspace`. Mục tiêu là giữ URL,
navigation và authorization nhất quán; giao diện không bao giờ là lớp quyết
định quyền truy cập dữ liệu.

1. Xác định scope trước: `platform`, `tenant` hay `branch`. Route dùng tenant
   phải nằm dưới `RequireTenantAccess`; route quản trị tenant thêm
   `RequireTenantPermission`. Route branch phải nằm dưới `RequireBranchAccess`
   và route thao tác cụ thể thêm `RequireBranchPermission` với đúng permission.
   Backend vẫn phải xác minh tenant/branch context cho từng request.
2. Khai báo template trong `PATHS` và builder encode segment tương ứng trong
   `pathFor` tại `src/app/router/paths.ts`. Không ghép URL workspace thủ công
   trong page hoặc layout.
3. Đăng ký page và guard theo cây route tại `src/app/router/routes.tsx`. Page
   workspace dùng `useRouteWorkspaceContext()` để đọc context theo URL đang mở;
   không dùng context preference của thanh điều hướng để gọi API cho page.
4. Nếu route cần hiện trong sidebar, thêm một item vào
   `src/app/workspace/workspace-navigation.ts` với `scope`, `permission`,
   `labelKey`, `icon`, `order` và builder `to`. Bộ lọc navigation chỉ là UX;
   luôn thêm route guard tương ứng. Thêm bản dịch `vi` và `en` cho `labelKey`.
   Bộ chọn header duy nhất là `WorkspaceSwitcher`; không thêm lại các Select
   tenant/branch riêng lẻ trong layout hoặc page.
5. Không tự lưu tenant/branch trong page. `useNavigationWorkspaceContext()` là
   nơi duy nhất resolve selection theo thứ tự: route hiện tại, preference của
   đúng `userId` còn hợp lệ, rồi lựa chọn mặc định. Preference trong
   `workspace-preference.store.ts` chỉ là gợi ý UX, phải được kiểm tra lại
   quyền và trạng thái `ACTIVE` trước khi dùng.
6. Tenant Admin có `branch.manage` lấy toàn bộ branch `ACTIVE` trong tenant;
   role branch-scoped (ví dụ Branch Admin) chỉ nhận các branch được gán trực
   tiếp từ authorization snapshot. Không thay đổi quy tắc này chỉ để mở rộng
   danh sách Select.
7. Dùng `WorkspaceRootRedirect` cho `/workspace` và `WorkspaceTenantRedirect`
   cho `/workspace/:tenantSlug`. Khi đổi URL cũ, thêm redirect tương thích thay
   vì để link đã chia sẻ rơi vào trang lỗi.

Sau thay đổi, bổ sung/chỉnh E2E phù hợp (đặc biệt tenant/branch ngoài scope)
và chạy `npm run lint`, `npm run build`.

## Quy ước frontend

- Dùng alias `@/` cho `src/`; utilities là `@/shared/lib/utils`.
- Icon mặc định là `lucide-react`. Khi Lucide không có icon phù hợp, dùng
  `@tabler/icons-react`; cả hai đều dùng named export để Vite tree-shake những
  icon không được sử dụng:

  ```tsx
  import { IconCalendar } from "@tabler/icons-react";

  <IconCalendar aria-hidden="true" size={20} stroke={2} />
  ```

  Không import toàn bộ package, dùng icon font, hoặc tải SVG từ CDN lúc chạy.
  Giữ cùng kích thước (thường `16`, `20`, hoặc `24`) và `stroke={2}` trong một
  khu vực UI. Tabler Icons dùng MIT license. Nếu cả hai package đều chưa có
  icon nghiệp vụ cần thiết, thêm SVG local vào `src/components/icons/`, dùng
  `currentColor`, nhận SVG props, và ghi rõ URL nguồn cùng license trong
  `src/components/icons/SOURCES.md`. Không lấy icon từ một trang tổng hợp nếu
  chưa xác minh license của icon pack gốc.
- API đi qua HTTP client tại `src/shared/lib/http.ts`. Tạo service và React
  Query hook trong feature phù hợp, thay vì gọi `fetch` trực tiếp trong page.
  Endpoint chỉ được một service/feature dùng thì khai báo trực tiếp tại service;
  chỉ đưa vào `src/shared/constants/endpoint.constants.ts` khi URL thực sự được
  tái sử dụng ở nhiều nơi.

### Xử lý lỗi API và feedback mutation

- Chuẩn hoá lỗi tại mutation boundary bằng `handleApiError` từ
  `src/shared/lib/error.ts`; không tự parse payload lỗi ở từng component. Luôn ưu tiên
  thông điệp backend trả về, chỉ dùng fallback khi response không có message hợp lệ.
- Form dùng React Hook Form truyền `setError` vào `handleApiError`. Lỗi theo field được
  hiển thị tại field tương ứng; lỗi không gắn field được gán vào `root.server` và phải
  được render bằng `<Alert variant="destructive">` trong form.
- Dialog hoặc form không dùng React Hook Form truyền callback `onMessage` để lưu lỗi
  cấp form, rồi render cùng `<Alert variant="destructive">`. Không truyền state setter
  của `useState` vào tham số `setError`, vì tham số đó chỉ dành cho React Hook Form.
- Dùng `Alert` cho lỗi người dùng cần sửa hoặc retry khi form/dialog vẫn mở. Toast chỉ
  dành cho feedback thành công sau khi dialog đóng, hoặc lỗi không thuộc một form/dialog
  đang mở.

- Route guard chỉ phục vụ UX. Backend vẫn phải xác thực quyền và tenant context
  cho mọi request.
- Chỉ dùng dữ liệu demo synthetic. Không đưa dữ liệu bệnh nhân thật vào mock,
  story hoặc screenshot.
- Text hiển thị mới cần được đưa vào i18n. Các namespace hiện đăng ký tại
  `src/i18n/index.ts`; thêm namespace theo domain khi cần, thay vì dồn mọi thứ
  vào `common`.
- Kiểm tra `npm run lint` và `npm run build` sau thay đổi.

## UI primitives

`components.json` dùng style `radix-nova`. Primitive trong `src/components/ui`
dựa trên Radix UI; hãy tạo và sử dụng component theo API Radix đang có trong
codebase. Khi primitive Radix cần render child trigger/action, dùng `asChild`
theo mẫu hiện có; không dùng prop `render` của Base UI.

Không ghi đè component trong `src/components/ui` bằng lệnh registry nếu chưa
xem `--dry-run` và `--diff`, vì chúng là UI foundation đang được các page dùng
chung.

## React Hook Form fields

Form dùng React Hook Form được ưu tiên các wrapper tại `src/components/form` để
giữ nhất quán label, required marker, accessibility và hiển thị helper/validation
message:

```tsx
import {
  RHFCombobox,
  RHFSelect,
  RHFTextarea,
  RHFTextField,
} from "@/components/form";
```

- Dùng `RHFTextField` cho input native (bao gồm `type`, `inputMode`, `min`,
  `max`); dùng `RHFTextarea` cho nội dung nhiều dòng.
- Dùng `RHFSelect` cho tập option nhỏ, ổn định; dùng `RHFCombobox` khi người
  dùng cần tìm trong danh sách option. `RHFCombobox` chỉ tìm local trong options
  đã tải; danh sách phân trang hoặc có thể lớn phải dùng server-side search có
  debounce.
- Truyền placeholder, search placeholder và empty message qua i18n (ưu tiên
  namespace domain khi text mang ngữ cảnh nghiệp vụ).
- Chỉ dùng `Controller` trực tiếp khi control chưa có wrapper tại đây hoặc có
  hành vi đặc thù không thể tạo thành component dùng chung.

## DataTable

DataTable dùng chung nằm tại `src/components/shadcntable/data-table.tsx` và dựa
trên `@tanstack/react-table` v8.21.3. POC read-only hiện có tại route
`/platform/tenants` trong `src/pages/platform/TenantManagementPage.tsx`.

```tsx
import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
```

- Dùng `DataTableColumnHeader` cho cột cần sort, filter hoặc ẩn/hiện.
- Locale chung của DataTable phải tạo bằng `createDataTableLocale()` từ
  `src/i18n/data-table.ts`; không tạo lại object locale hoặc gọi lặp từng key
  như `t("table.pagination.goToFirstPage")` trong page.
- Chuỗi điều khiển dùng chung nằm ở `common.dataTable` (pagination, sort,
  filter, ẩn/hiện cột, chọn dòng). Text mang ngữ cảnh domain vẫn đặt trong
  namespace domain và chỉ truyền qua override typed khi thực sự cần.

```tsx
const { t: tCommon } = useTranslation("common");
const { t: tPlans } = useTranslation("plans");

const dataTableLocale = useMemo(
  () =>
    createDataTableLocale(tCommon, {
      toolbar: { searchPlaceholder: tPlans("table.searchPlaceholder") },
    }),
  [tCommon, tPlans],
);

<DataTable columns={columns} data={data} locale={dataTableLocale} />;
```

- `createDataTableLocale(tCommon, overrides?)` luôn trả về đủ
  `DataTableLocale`; override được merge theo từng nhóm và chỉ dành cho text
  đặc thù bảng. Select/multi-select không cần `filterConfig.placeholder` nếu
  dùng placeholder chung từ locale.
- `DataTable` hỗ trợ server-side state: `pagination.manual` cho `pageIndex`,
  `pageSize`, `rowCount`, `onPaginationChange`; `serverState.sorting` và
  `serverState.filtering` cho sort, global search và column filters. Khi dùng
  `serverState`, TanStack không sort/lọc local trên một trang đã tải.
- Trang `/platform/tenants` là reference implementation: API dùng page 1-based,
  client đổi từ `pageIndex` 0-based, debounce search 300ms, reset về trang đầu
  khi đổi search/filter/sort/page size, và truyền `meta.total` vào `rowCount`.
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
