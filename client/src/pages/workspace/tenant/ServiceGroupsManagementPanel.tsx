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
import { Badge } from "@/components/ui/badge";
import { ServiceGroupFormDialog } from "@/features/service-groups/components/ServiceGroupFormDialog";
import {
  ServiceGroupLifecycleDialog,
  type ServiceGroupLifecycleAction,
} from "@/features/service-groups/components/ServiceGroupLifecycleDialog";
import { useTenantServiceGroupsQuery } from "@/features/service-groups/service-groups.hooks";
import type {
  ServiceGroup,
  ServiceGroupListQuery,
  ServiceGroupSortBy,
} from "@/features/service-groups/service-groups.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Ellipsis,
  FolderTree,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

type LifecycleSelection = {
  action: ServiceGroupLifecycleAction;
  serviceGroup: ServiceGroup;
};

function stringFilter(
  columnFilters: ColumnFiltersState,
  columnId: string,
): string | undefined {
  const value = columnFilters.find((filter) => filter.id === columnId)?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toSortBy(sorting: SortingState): ServiceGroupSortBy | undefined {
  const id = sorting[0]?.id;
  return id === "name" || id === "createdAt" ? id : undefined;
}

export function ServiceGroupsManagementPanel({
  tenantSlug,
}: {
  tenantSlug: string;
}) {
  const { i18n, t } = useTranslation("serviceGroups");
  const { t: tCommon } = useTranslation("common");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingServiceGroup, setEditingServiceGroup] =
    useState<ServiceGroup | undefined>();
  const [lifecycleSelection, setLifecycleSelection] =
    useState<LifecycleSelection | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const query = useMemo<ServiceGroupListQuery>(
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
  const serviceGroupsQuery = useTenantServiceGroupsQuery(tenantSlug, query);
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

  const columns = useMemo<ColumnDef<ServiceGroup>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.name")} />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-52 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <FolderTree aria-hidden="true" className="size-4" />
            </span>
            <span className="font-semibold">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.status")} />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "outline"}>
            {t(row.original.isActive ? "statuses.ACTIVE" : "statuses.INACTIVE")}
          </Badge>
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
              <DropdownMenuItem
                onClick={() => setEditingServiceGroup(row.original)}
              >
                <Pencil aria-hidden="true" />
                {t("actions.edit")}
              </DropdownMenuItem>
              {row.original.isActive ? (
                <DropdownMenuItem
                  onClick={() =>
                    setLifecycleSelection({
                      action: "deactivate",
                      serviceGroup: row.original,
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
                      serviceGroup: row.original,
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
    [dateFormatter, t],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function handleFormOpenChange(open: boolean) {
    if (!open) {
      setCreateOpen(false);
      setEditingServiceGroup(undefined);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
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
          {serviceGroupsQuery.isFetching && !serviceGroupsQuery.isLoading && (
            <RefreshCw
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          )}
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={serviceGroupsQuery.data?.items ?? []}
            emptyState={
              serviceGroupsQuery.isError ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FolderTree aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("errors.listTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {getErrorMessage(serviceGroupsQuery.error)}
                    </EmptyDescription>
                    <Button
                      onClick={() => void serviceGroupsQuery.refetch()}
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
                      <FolderTree aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("empty.title")}</EmptyTitle>
                    <EmptyDescription>{t("empty.description")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            }
            isFetching={serviceGroupsQuery.isFetching}
            isLoading={serviceGroupsQuery.isLoading}
            locale={dataTableLocale}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: serviceGroupsQuery.data?.meta.total ?? 0,
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

      <ServiceGroupFormDialog
        onOpenChange={handleFormOpenChange}
        open={createOpen || Boolean(editingServiceGroup)}
        serviceGroup={editingServiceGroup}
        tenantSlug={tenantSlug}
      />
      {lifecycleSelection && (
        <ServiceGroupLifecycleDialog
          action={lifecycleSelection.action}
          key={lifecycleSelection.serviceGroup.id}
          onOpenChange={(open) => {
            if (!open) setLifecycleSelection(null);
          }}
          serviceGroup={lifecycleSelection.serviceGroup}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
}
