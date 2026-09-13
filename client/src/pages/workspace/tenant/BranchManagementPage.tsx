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
import {
  BranchFormDialog,
} from "@/features/branches/components/BranchFormDialog";
import {
  BranchLifecycleDialog,
  type BranchLifecycleAction,
} from "@/features/branches/components/BranchLifecycleDialog";
import { BranchStatusBadge } from "@/features/branches/components/BranchStatusBadge";
import { useTenantBranchesQuery } from "@/features/branches/branches.hooks";
import type {
  Branch,
  BranchListQuery,
  BranchSortBy,
  BranchStatus,
} from "@/features/branches/branches.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Building2,
  Ellipsis,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceContext } from "../use-workspace-context";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

type LifecycleSelection = {
  action: BranchLifecycleAction;
  branch: Branch;
};

function stringFilter(
  columnFilters: ColumnFiltersState,
  columnId: string,
): string | undefined {
  const value = columnFilters.find((filter) => filter.id === columnId)?.value;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toSortBy(sorting: SortingState): BranchSortBy | undefined {
  const id = sorting[0]?.id;
  return id === "name" || id === "status" || id === "createdAt"
    ? id
    : undefined;
}

export function BranchManagementPage() {
  const { i18n, t } = useTranslation("branches");
  const { t: tCommon } = useTranslation("common");
  const { tenant, tenantSlug } = useWorkspaceContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | undefined>();
  const [lifecycleSelection, setLifecycleSelection] =
    useState<LifecycleSelection | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const status = stringFilter(columnFilters, "status") as
    | BranchStatus
    | undefined;
  const sortBy = toSortBy(sorting);
  const query = useMemo<BranchListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sorting[0] ? { sortOrder: sorting[0].desc ? "DESC" : "ASC" } : {}),
    }),
    [debouncedSearch, pagination, sortBy, sorting, status],
  );
  const branchesQuery = useTenantBranchesQuery(tenantSlug, query);
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "vi", {
        dateStyle: "medium",
      }),
    [i18n.resolvedLanguage],
  );

  const columns = useMemo<ColumnDef<Branch>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.name")} />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-52 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 aria-hidden="true" className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">{row.original.name}</span>
              <span className="block font-mono text-xs text-muted-foreground">
                {row.original.slug}
              </span>
            </span>
          </div>
        ),
      },
      {
        accessorKey: "address",
        header: () => <span>{t("table.address")}</span>,
        cell: ({ row }) => (
          <span className="flex min-w-48 items-start gap-2 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{row.original.address}</span>
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: () => <span>{t("table.phone")}</span>,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 text-sm">
            <Phone aria-hidden="true" className="size-4 text-muted-foreground" />
            {row.original.phone}
          </span>
        ),
      },
      {
        accessorKey: "timezone",
        header: () => <span>{t("table.timezone")}</span>,
        cell: ({ row }) =>
          row.original.timezone ?? (
            <span className="text-sm text-muted-foreground">
              {t("table.inheritsTenantTimezone")}
            </span>
          ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.status")} />
        ),
        cell: ({ row }) => <BranchStatusBadge status={row.original.status} />,
        meta: {
          filterConfig: {
            variant: "select",
            title: t("filters.statusTitle"),
            description: t("filters.statusDescription"),
            options: (["ACTIVE", "INACTIVE"] as BranchStatus[]).map(
              (value) => ({
                label: t(`statuses.${value}`),
                value,
              }),
            ),
          },
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.createdAt")}
          />
        ),
        cell: ({ row }) => dateFormatter.format(new Date(row.original.createdAt)),
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
                aria-label={t("actions.openActions", { name: row.original.name })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingBranch(row.original)}>
                <Pencil aria-hidden="true" />
                {t("actions.edit")}
              </DropdownMenuItem>
              {row.original.status === "ACTIVE" ? (
                <DropdownMenuItem
                  onClick={() =>
                    setLifecycleSelection({
                      action: "deactivate",
                      branch: row.original,
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
                      branch: row.original,
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
      setEditingBranch(undefined);
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
          {branchesQuery.isFetching && !branchesQuery.isLoading && (
            <RefreshCw
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          )}
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={branchesQuery.data?.items ?? []}
            emptyState={
              branchesQuery.isError ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Building2 aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("errors.listTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {getErrorMessage(branchesQuery.error)}
                    </EmptyDescription>
                    <Button
                      onClick={() => void branchesQuery.refetch()}
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
                      <Building2 aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("empty.title")}</EmptyTitle>
                    <EmptyDescription>{t("empty.description")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            }
            isFetching={branchesQuery.isFetching}
            isLoading={branchesQuery.isLoading}
            locale={dataTableLocale}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: branchesQuery.data?.meta.total ?? 0,
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

      <BranchFormDialog
        branch={editingBranch}
        onOpenChange={handleFormOpenChange}
        open={createOpen || Boolean(editingBranch)}
        tenantSlug={tenantSlug}
      />
      {lifecycleSelection && (
        <BranchLifecycleDialog
          action={lifecycleSelection.action}
          branch={lifecycleSelection.branch}
          key={lifecycleSelection.branch.id}
          onOpenChange={(open) => {
            if (!open) setLifecycleSelection(null);
          }}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
}
