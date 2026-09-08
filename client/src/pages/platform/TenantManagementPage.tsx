import { pathFor } from "@/app/router/paths";
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
import { Label } from "@/components/ui/label";
import { useSubscriptionPlansQuery } from "@/features/subscription-plans/subscription-plans.hooks";
import { TenantFormDialog } from "@/features/tenants/components/TenantFormDialog";
import { TenantStatusBadge } from "@/features/tenants/components/TenantStatusBadge";
import { usePlatformTenantsQuery } from "@/features/tenants/tenants.hooks";
import type {
  PlatformTenant,
  PlatformTenantListQuery,
  PlatformTenantSortBy,
  TenantStatus,
} from "@/features/tenants/tenants.types";
import { createDataTableLocale } from "@/i18n/data-table";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Building2,
  Ellipsis,
  ExternalLink,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

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
  const { i18n, t } = useTranslation("tenants");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [trialEndingBefore, setTrialEndingBefore] = useState("");
  const plansQuery = useSubscriptionPlansQuery();

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const status = stringFilter(columnFilters, "status") as
    | TenantStatus
    | undefined;
  const planId = stringFilter(columnFilters, "planName");
  const sortBy = toSortBy(sorting);
  const query = useMemo<PlatformTenantListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status } : {}),
      ...(planId ? { planId } : {}),
      ...(trialEndingBefore ? { trialEndingBefore } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sorting[0] ? { sortOrder: sorting[0].desc ? "DESC" : "ASC" } : {}),
    }),
    [
      debouncedSearch,
      pagination,
      planId,
      sortBy,
      sorting,
      status,
      trialEndingBefore,
    ],
  );
  const tenantsQuery = usePlatformTenantsQuery(query);
  const dataTableLocale = useMemo(
    () => createDataTableLocale(tCommon),
    [tCommon],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "vi", {
        dateStyle: "medium",
      }),
    [i18n.resolvedLanguage],
  );
  const activePlans = (plansQuery.data ?? []).filter((plan) => plan.isActive);

  const columns = useMemo<ColumnDef<PlatformTenant>[]>(
    () => [
      {
        accessorKey: "displayName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.tenant")} />
        ),
        cell: ({ row }) => (
          <Link
            className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={pathFor.platformTenantDetail(row.original.id)}
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 aria-hidden="true" className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">
                {row.original.displayName}
              </span>
              <span className="block text-sm text-muted-foreground">
                {row.original.legalName}
              </span>
            </span>
          </Link>
        ),
      },
      {
        id: "owner",
        accessorFn: (tenant) => tenant.owner?.email ?? "",
        header: () => <span>{t("table.owner")}</span>,
        cell: ({ row }) =>
          row.original.owner ? (
            <div>
              <p className="font-medium">{row.original.owner.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {row.original.owner.email}
              </p>
            </div>
          ) : (
            t("detail.noOwner")
          ),
      },
      {
        id: "planName",
        accessorFn: (tenant) => tenant.subscription?.plan.name ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.plan")} />
        ),
        cell: ({ row }) =>
          row.original.subscription?.plan.name ?? t("detail.noSubscription"),
        meta: {
          filterConfig: {
            variant: "select",
            title: t("filters.planTitle"),
            description: t("filters.planDescription"),
            placeholder: t("filters.planPlaceholder"),
            options: (plansQuery.data ?? []).map((plan) => ({
              label: plan.name,
              value: plan.id,
            })),
          },
        },
      },
      {
        id: "trialEnding",
        accessorFn: (tenant) => tenant.subscription?.currentPeriodEnd ?? "",
        header: () => <span>{t("table.trialEnd")}</span>,
        cell: ({ row }) =>
          row.original.subscription?.status === "TRIAL" &&
          row.original.subscription.currentPeriodEnd
            ? dateFormatter.format(
                new Date(row.original.subscription.currentPeriodEnd),
              )
            : "—",
      },
      {
        id: "branchCount",
        accessorFn: (tenant) => tenant.usage.branchCount,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.branches")} />
        ),
        cell: ({ row }) =>
          t("table.branchCount", { count: row.original.usage.branchCount }),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.status")} />
        ),
        cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
        meta: {
          filterConfig: {
            variant: "select",
            title: t("filters.statusTitle"),
            description: t("filters.statusDescription"),
            placeholder: t("filters.statusPlaceholder"),
            options: (
              [
                "PROVISIONING",
                "TRIAL",
                "ACTIVE",
                "PAST_DUE",
                "SUSPENDED",
                "CANCELED",
              ] as TenantStatus[]
            ).map((value) => ({ label: t(`statuses.${value}`), value })),
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
                  name: row.original.displayName,
                })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={pathFor.platformTenantDetail(row.original.id)}>
                  <ExternalLink aria-hidden="true" />
                  {t("actions.viewDetail")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [dateFormatter, plansQuery.data, t],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">
            DentFlow Platform
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t("description")}
          </p>
        </div>
        <div className="flex gap-2">
          {activePlans.length === 0 && (
            <Button asChild type="button" variant="outline">
              <Link to="/platform/plans">{t("actions.openPlans")}</Link>
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" />
            {t("actions.create")}
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("table.title")}</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("table.description")}
            </p>
          </div>
          {tenantsQuery.isFetching && !tenantsQuery.isLoading && (
            <RefreshCw
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          )}
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="tenant-trial-ending-before">
              {t("filters.trialEndingBefore")}
            </Label>
            <input
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              id="tenant-trial-ending-before"
              onChange={(event) => {
                setTrialEndingBefore(event.target.value);
                resetToFirstPage();
              }}
              type="date"
              value={trialEndingBefore}
            />
          </div>
          <DataTable
            columns={columns}
            data={tenantsQuery.data?.items ?? []}
            emptyState={
              tenantsQuery.isError ? (
                <div className="space-y-3 py-10 text-center text-sm text-muted-foreground">
                  <p>{t("errors.list")}</p>
                  <Button
                    onClick={() => void tenantsQuery.refetch()}
                    size="sm"
                    type="button"
                  >
                    {t("actions.retry")}
                  </Button>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {t("empty")}
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
      <TenantFormDialog
        onCreated={(tenant) =>
          navigate(pathFor.platformTenantDetail(tenant.id))
        }
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
    </div>
  );
}
