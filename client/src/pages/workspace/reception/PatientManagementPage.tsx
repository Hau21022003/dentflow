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
import { PatientFormDialog } from "@/features/patients/components/PatientFormDialog";
import { useBranchPatientsQuery } from "@/features/patients/patients.hooks";
import type {
  Patient,
  PatientListQuery,
  PatientSortBy,
} from "@/features/patients/patients.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import type { ColumnDef, ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { Ellipsis, Pencil, Plus, RefreshCw, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

function toSortBy(sorting: SortingState): PatientSortBy | undefined {
  const id = sorting[0]?.id;
  return id === "fullName" || id === "dateOfBirth" || id === "createdAt"
    ? id
    : undefined;
}

export function PatientManagementPage() {
  const { i18n, t } = useTranslation("patients");
  const { t: tCommon } = useTranslation("common");
  const { branch, branchSlug, tenant, tenantSlug } = useRouteWorkspaceContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | undefined>();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const sortBy = toSortBy(sorting);
  const query = useMemo<PatientListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sorting[0] ? { sortOrder: sorting[0].desc ? "DESC" : "ASC" } : {}),
    }),
    [debouncedSearch, pagination, sortBy, sorting],
  );
  const patientsQuery = useBranchPatientsQuery(tenantSlug, branchSlug, query);
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

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.fullName")} />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-52 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <UsersRound aria-hidden="true" className="size-4" />
            </span>
            <span className="font-semibold">{row.original.fullName}</span>
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: () => t("table.phone"),
        cell: ({ row }) => row.original.phone,
        enableSorting: false,
      },
      {
        accessorKey: "gender",
        header: () => t("table.gender"),
        cell: ({ row }) => t(`genders.${row.original.gender}`),
        enableSorting: false,
      },
      {
        accessorKey: "dateOfBirth",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.dateOfBirth")} />
        ),
        cell: ({ row }) =>
          row.original.dateOfBirth
            ? dateFormatter.format(new Date(`${row.original.dateOfBirth}T00:00:00`))
            : t("table.notProvided"),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.createdAt")} />
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
                aria-label={t("actions.openActions", { name: row.original.fullName })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingPatient(row.original)}>
                <Pencil aria-hidden="true" />
                {t("actions.edit")}
              </DropdownMenuItem>
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
      setEditingPatient(undefined);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">
            {t("eyebrow", { tenantName, branchName })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
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
          {patientsQuery.isFetching && !patientsQuery.isLoading && (
            <RefreshCw
              aria-label={t("loading")}
              className="size-4 animate-spin text-muted-foreground"
            />
          )}
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={patientsQuery.data?.items ?? []}
            emptyState={
              patientsQuery.isError ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersRound aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("errors.listTitle")}</EmptyTitle>
                    <EmptyDescription>{getErrorMessage(patientsQuery.error)}</EmptyDescription>
                    <Button
                      onClick={() => void patientsQuery.refetch()}
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
                      <UsersRound aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>{t("empty.title")}</EmptyTitle>
                    <EmptyDescription>{t("empty.description")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            }
            isFetching={patientsQuery.isFetching}
            isLoading={patientsQuery.isLoading}
            locale={dataTableLocale}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: patientsQuery.data?.meta.total ?? 0,
              onPaginationChange: (next) =>
                setPagination((current) => ({
                  pageIndex: next.pageSize === current.pageSize ? next.pageIndex : 0,
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
                onColumnFiltersChange: setColumnFilters,
              },
            }}
            toolbar={{ search: true, viewOptions: true }}
          />
        </CardContent>
      </Card>

      <PatientFormDialog
        branchSlug={branchSlug}
        onOpenChange={handleFormOpenChange}
        open={createOpen || Boolean(editingPatient)}
        patient={editingPatient}
        tenantSlug={tenantSlug}
      />
    </div>
  );
}
