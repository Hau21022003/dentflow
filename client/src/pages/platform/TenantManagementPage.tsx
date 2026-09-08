import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
import { StaticPageHeader } from "@/components/static-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptionPlansQuery } from "@/features/subscription-plans/subscription-plans.hooks";
import { usePlatformTenantsQuery } from "@/features/tenants/tenants.hooks";
import type {
  PlatformTenant,
  PlatformTenantListQuery,
  PlatformTenantSortBy,
  TenantStatus,
} from "@/features/tenants/tenants.types";
import { createDataTableLocale } from "@/i18n/data-table";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

const tenantStatusLabels: Record<TenantStatus, string> = {
  PROVISIONING: "Đang khởi tạo",
  ACTIVE: "Đang hoạt động",
  TRIAL: "Dùng thử",
  PAST_DUE: "Quá hạn thanh toán",
  SUSPENDED: "Đã tạm khóa",
  CANCELED: "Đã hủy",
};

const tenantStatusBadgeVariants: Record<
  TenantStatus,
  "default" | "secondary" | "destructive" | "outline" | "ghost"
> = {
  PROVISIONING: "outline",
  ACTIVE: "default",
  TRIAL: "secondary",
  PAST_DUE: "outline",
  SUSPENDED: "destructive",
  CANCELED: "ghost",
};

function stringFilter(
  columnFilters: ColumnFiltersState,
  columnId: string,
): string | undefined {
  const value = columnFilters.find((filter) => filter.id === columnId)?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toSortBy(sorting: SortingState): PlatformTenantSortBy | undefined {
  const id = sorting[0]?.id;
  return id === "displayName" ||
    id === "planName" ||
    id === "branchCount" ||
    id === "status" ||
    id === "createdAt"
    ? id
    : undefined;
}

export function TenantManagementPage() {
  const { i18n, t } = useTranslation("common");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const plansQuery = useSubscriptionPlansQuery();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(globalFilter.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const status = stringFilter(columnFilters, "status") as
    TenantStatus | undefined;
  const planId = stringFilter(columnFilters, "planName");
  const sortBy = toSortBy(sorting);
  const query = useMemo<PlatformTenantListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status } : {}),
      ...(planId ? { planId } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sorting[0] ? { sortOrder: sorting[0].desc ? "DESC" : "ASC" } : {}),
    }),
    [debouncedSearch, pagination, planId, sortBy, sorting, status],
  );
  const tenantsQuery = usePlatformTenantsQuery(query);
  const dataTableLocale = useMemo(() => createDataTableLocale(t), [t]);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "vi-VN", {
        dateStyle: "medium",
      }),
    [i18n.resolvedLanguage],
  );

  const columns = useMemo<ColumnDef<PlatformTenant>[]>(
    () => [
      {
        accessorKey: "displayName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tenant" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="font-semibold">{row.original.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {row.original.legalName}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "planName",
        accessorFn: (tenant) => tenant.subscription?.plan.name ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gói dịch vụ" />
        ),
        cell: ({ row }) =>
          row.original.subscription?.plan.name ?? "Chưa có gói",
        meta: {
          filterConfig: {
            variant: "select",
            title: "Lọc theo gói dịch vụ",
            description: "Chỉ hiển thị tenant đang dùng gói đã chọn.",
            placeholder: "Chọn gói dịch vụ",
            options:
              plansQuery.data?.map((plan) => ({
                label: plan.name,
                value: plan.id,
              })) ?? [],
          },
        },
      },
      {
        id: "branchCount",
        accessorFn: (tenant) => tenant.usage.branchCount,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Chi nhánh" />
        ),
        cell: ({ row }) => `${row.original.usage.branchCount} chi nhánh`,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Trạng thái" />
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge variant={tenantStatusBadgeVariants[status]}>
              {tenantStatusLabels[status]}
            </Badge>
          );
        },
        meta: {
          filterConfig: {
            variant: "select",
            title: "Lọc theo trạng thái",
            description: "Chỉ hiển thị tenant có trạng thái đã chọn.",
            placeholder: "Chọn trạng thái",
            options: Object.entries(tenantStatusLabels).map(
              ([value, label]) => ({
                label,
                value,
              }),
            ),
          },
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Ngày tạo" />
        ),
        cell: ({ row }) =>
          dateFormatter.format(new Date(row.original.createdAt)),
      },
    ],
    [dateFormatter, plansQuery.data],
  );

  const resetToFirstPage = () => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  return (
    <div className="space-y-7">
      <StaticPageHeader
        context="PLATFORM_ADMIN · platform.tenant.manage"
        description="Danh sách tenant và thông tin SaaS được tải trực tiếp từ Platform API."
        eyebrow="DentFlow Platform"
        title="Quản lý tenant"
      />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/70">
          <div>
            <CardTitle>Tenant trên hệ thống</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Tìm kiếm, lọc, sắp xếp và phân trang được xử lý trên server.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={tenantsQuery.data?.items ?? []}
            emptyState={
              tenantsQuery.isError ? (
                <div className="space-y-3 py-10 text-center text-sm text-muted-foreground">
                  <p>Không thể tải danh sách tenant.</p>
                  <Button
                    onClick={() => void tenantsQuery.refetch()}
                    size="sm"
                    type="button"
                  >
                    Thử lại
                  </Button>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Không tìm thấy tenant phù hợp.
                </div>
              )
            }
            isFetching={tenantsQuery.isFetching}
            isLoading={tenantsQuery.isLoading}
            locale={dataTableLocale}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: tenantsQuery.data?.meta.total ?? 0,
              onPaginationChange: (next) => {
                setPagination((current) => ({
                  pageIndex:
                    next.pageSize === current.pageSize ? next.pageIndex : 0,
                  pageSize: next.pageSize,
                }));
              },
            }}
            serverState={{
              sorting: {
                value: sorting,
                onChange: (next) => {
                  setSorting(next);
                  resetToFirstPage();
                },
              },
              filtering: {
                globalFilter,
                columnFilters,
                onGlobalFilterChange: (next) => {
                  setGlobalFilter(next);
                  resetToFirstPage();
                },
                onColumnFiltersChange: (next) => {
                  setColumnFilters(next);
                  resetToFirstPage();
                },
              },
            }}
            toolbar={{ search: true, viewOptions: true }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
