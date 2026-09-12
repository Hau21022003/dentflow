import { DataTable } from "@/components/shadcntable/data-table";
import { DataTableColumnHeader } from "@/components/shadcntable/data-table-column-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ServiceFormDialog } from "@/features/services/components/ServiceFormDialog";
import {
  ServiceLifecycleDialog,
  type ServiceLifecycleAction,
} from "@/features/services/components/ServiceLifecycleDialog";
import { ServiceStatusBadge } from "@/features/services/components/ServiceStatusBadge";
import { useTenantServicesQuery } from "@/features/services/services.hooks";
import { formatServiceAmount } from "@/features/services/services.price";
import type {
  Service,
  ServiceListQuery,
  ServiceSortBy,
} from "@/features/services/services.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Clock3,
  Ellipsis,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWorkspaceContext } from "../use-workspace-context";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

type LifecycleSelection = {
  action: ServiceLifecycleAction;
  service: Service;
};

function stringFilter(
  columnFilters: ColumnFiltersState,
  columnId: string,
): string | undefined {
  const value = columnFilters.find((filter) => filter.id === columnId)?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toSortBy(sorting: SortingState): ServiceSortBy | undefined {
  const id = sorting[0]?.id;
  return id === "code" ||
    id === "name" ||
    id === "serviceGroupName" ||
    id === "amount" ||
    id === "durationMinutes" ||
    id === "createdAt"
    ? id
    : undefined;
}

export function ServiceManagementPage() {
  const { i18n, t } = useTranslation("services");
  const { t: tCommon } = useTranslation("common");
  const { tenant, tenantSlug } = useWorkspaceContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | undefined>();
  const [lifecycleSelection, setLifecycleSelection] =
    useState<LifecycleSelection | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const status = stringFilter(columnFilters, "isActive");
  const isActive =
    status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined;
  const sortBy = toSortBy(sorting);
  const query = useMemo<ServiceListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sorting[0] ? { sortOrder: sorting[0].desc ? "DESC" : "ASC" } : {}),
    }),
    [debouncedSearch, isActive, pagination, sortBy, sorting],
  );
  const servicesQuery = useTenantServicesQuery(tenantSlug, query);
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  const columns = useMemo<ColumnDef<Service>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.name")} />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-52 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Tags aria-hidden="true" className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">{row.original.name}</span>
              <span className="block font-mono text-xs text-muted-foreground">
                {row.original.code}
              </span>
            </span>
          </div>
        ),
      },
      {
        accessorKey: "serviceGroupName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.groupName")} />
        ),
        cell: ({ row }) => row.original.serviceGroup.name,
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.price")} />
        ),
        cell: ({ row }) =>
          formatServiceAmount(
            row.original.amount,
            row.original.currency,
            locale,
          ),
      },
      {
        accessorKey: "durationMinutes",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.duration")} />
        ),
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Clock3
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            {t("table.durationValue", {
              minutes: row.original.durationMinutes,
            })}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.status")} />
        ),
        cell: ({ row }) => (
          <ServiceStatusBadge isActive={row.original.isActive} />
        ),
        enableSorting: false,
        meta: {
          filterConfig: {
            variant: "select",
            title: t("filters.statusTitle"),
            description: t("filters.statusDescription"),
            options: ["ACTIVE", "INACTIVE"].map((value) => ({
              label: t(`statuses.${value}`),
              value,
            })),
          },
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.createdAt")} />
        ),
        cell: ({ row }) =>
          dateFormatter.format(new Date(row.original.createdAt)),
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t("table.actions")}</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("actions.openActions", {
                  name: row.original.name,
                })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingService(row.original)}>
                <Pencil aria-hidden="true" />
                {t("actions.edit")}
              </DropdownMenuItem>
              {row.original.isActive ? (
                <DropdownMenuItem
                  onClick={() =>
                    setLifecycleSelection({
                      action: "deactivate",
                      service: row.original,
                    })
                  }
                  variant="destructive"
                >
                  <PowerOff aria-hidden="true" />
                  {t("actions.deactivate")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    setLifecycleSelection({
                      action: "activate",
                      service: row.original,
                    })
                  }
                >
                  <Power aria-hidden="true" />
                  {t("actions.activate")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [dateFormatter, locale, t],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function handleFormOpenChange(open: boolean) {
    if (!open) {
      setCreateOpen(false);
      setEditingService(undefined);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">
            {t("eyebrow", { tenantName })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} type="button">
          <Plus aria-hidden="true" />
          {t("actions.create")}
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("table.title")}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("table.description")}
            </p>
          </div>
          {servicesQuery.isFetching && !servicesQuery.isLoading && (
            <RefreshCw
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          )}
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={servicesQuery.data?.items ?? []}
            emptyState={
              servicesQuery.isError ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Tags aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("errors.listTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {getErrorMessage(servicesQuery.error)}
                    </EmptyDescription>
                    <Button
                      onClick={() => void servicesQuery.refetch()}
                      size="sm"
                      type="button"
                    >
                      {t("actions.retry")}
                    </Button>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Tags aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("empty.title")}</EmptyTitle>
                    <EmptyDescription>
                      {t("empty.description")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            }
            isFetching={servicesQuery.isFetching}
            isLoading={servicesQuery.isLoading}
            locale={dataTableLocale}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: servicesQuery.data?.meta.total ?? 0,
              onPaginationChange: (next) =>
                setPagination((current) => ({
                  pageIndex:
                    next.pageSize === current.pageSize ? next.pageIndex : 0,
                  pageSize: next.pageSize,
                })),
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

      <ServiceFormDialog
        onOpenChange={handleFormOpenChange}
        open={createOpen || Boolean(editingService)}
        service={editingService}
        tenantSlug={tenantSlug}
      />
      {lifecycleSelection && (
        <ServiceLifecycleDialog
          action={lifecycleSelection.action}
          key={lifecycleSelection.service.id}
          onOpenChange={(open) => {
            if (!open) setLifecycleSelection(null);
          }}
          service={lifecycleSelection.service}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
}
