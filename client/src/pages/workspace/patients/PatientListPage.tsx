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
import { Input } from "@/components/ui/input";
import { PatientFormDialog } from "@/features/patients/components/PatientFormDialog";
import {
  useAssignedBranchPatientsQuery,
  useBranchPatientsQuery,
} from "@/features/patients/patients.hooks";
import type {
  AssignedPatientListItem,
  Patient,
  PatientListItem,
  PatientListQuery,
  PatientScheduleFilter,
  PatientSortBy,
} from "@/features/patients/patients.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";
import {
  CalendarDays,
  Ellipsis,
  FileCheck2,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const PAGE_SIZE_OPTIONS = [5, 10, 25];
const AVATAR_CLASSES = [
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
] as const;
type PatientListMode = "administrative" | "doctor";
type PatientRow = PatientListItem | AssignedPatientListItem;

function toSortBy(sorting: SortingState): PatientSortBy | undefined {
  const id = sorting[0]?.id;
  return id === "fullName" || id === "nextAppointmentAt" || id === "lastVisitAt"
    ? id
    : undefined;
}
function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}
function avatarClass(fullName: string): string {
  const value = Array.from(fullName).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return AVATAR_CLASSES[value % AVATAR_CLASSES.length];
}
function ageFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthday = new Date(`${dateOfBirth}T00:00:00`);
  let age = today.getFullYear() - birthday.getFullYear();
  if (
    today.getMonth() < birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() &&
      today.getDate() < birthday.getDate())
  )
    age -= 1;
  return age;
}
function scheduleFilterClass(isActive: boolean): string {
  return isActive
    ? "h-10 gap-2 rounded-xl border-primary bg-primary/5 px-3.5 text-foreground hover:border-primary hover:bg-primary/10 hover:text-foreground"
    : "h-10 gap-2 rounded-xl border-primary/30 bg-muted/35 px-3.5 text-foreground hover:border-primary/60 hover:bg-muted hover:text-foreground";
}
function scheduleCountClass(isActive: boolean): string {
  return isActive
    ? "rounded-md bg-primary px-1.5 py-0.5 text-xs leading-none font-semibold text-primary-foreground"
    : "rounded-md bg-background/80 px-1.5 py-0.5 text-xs leading-none font-semibold text-muted-foreground";
}

export function PatientListPage({ mode }: { mode: PatientListMode }) {
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
  const [scheduleFilter, setScheduleFilter] = useState<
    PatientScheduleFilter | undefined
  >();
  const isDoctorView = mode === "doctor";
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
  const branchTimeZone = branch?.branch.timezone;

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
      ...(scheduleFilter ? { scheduleFilter } : {}),
      ...(sortBy ? { sortBy } : {}),
      ...(sorting[0] ? { sortOrder: sorting[0].desc ? "DESC" : "ASC" } : {}),
    }),
    [debouncedSearch, pagination, scheduleFilter, sortBy, sorting],
  );
  const administrativeQuery = useBranchPatientsQuery(
    tenantSlug,
    branchSlug,
    query,
    !isDoctorView,
  );
  const assignedQuery = useAssignedBranchPatientsQuery(
    tenantSlug,
    branchSlug,
    query,
    isDoctorView,
  );
  const patientsQuery = isDoctorView ? assignedQuery : administrativeQuery;
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("table.searchPlaceholder") },
      }),
    [t, tCommon],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: branchTimeZone,
      }),
    [branchTimeZone, locale],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: branchTimeZone,
      }),
    [branchTimeZone, locale],
  );

  const columns = useMemo<ColumnDef<PatientRow>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.patient")} />
        ),
        cell: ({ row }) => {
          const age = ageFromDateOfBirth(row.original.dateOfBirth);
          return (
            <div className="flex min-w-56 items-center gap-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${avatarClass(row.original.fullName)}`}
              >
                {initials(row.original.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {row.original.fullName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`genders.${row.original.gender}`)}
                  {age !== null ? ` · ${t("table.age", { count: age })}` : ""}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: () => t("table.contact"),
        cell: ({ row }) => (
          <span className="flex min-w-36 items-center gap-2 text-sm">
            <Phone
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            {row.original.phone}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "nextAppointmentAt",
        accessorFn: (row) => row.nextAppointment?.startAt ?? null,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("table.nextAppointment")}
          />
        ),
        cell: ({ row }) => {
          const appointment = row.original.nextAppointment;
          if (!appointment)
            return <span className="text-muted-foreground">—</span>;
          return (
            <div className="min-w-52">
              <p className="flex items-center gap-2 font-medium">
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                {dateTimeFormatter.format(new Date(appointment.startAt))}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {appointment.serviceName ??
                  appointment.visitReason ??
                  t("table.notProvided")}
              </p>
            </div>
          );
        },
      },
      {
        id: "lastVisitAt",
        accessorFn: (row) => row.lastVisit?.completedAt ?? null,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("table.lastVisit")} />
        ),
        cell: ({ row }) => {
          const lastVisit = row.original.lastVisit;
          if (!lastVisit)
            return <span className="text-muted-foreground">—</span>;
          return (
            <div className="min-w-36">
              <p className="flex items-center gap-2 font-medium">
                <FileCheck2
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                {dateFormatter.format(new Date(lastVisit.completedAt))}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("table.completed")}
              </p>
            </div>
          );
        },
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => t("table.actions"),
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              aria-label={t("actions.viewProfile", {
                name: row.original.fullName,
              })}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t("actions.view")}
            </Button>
            {!isDoctorView && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("actions.openActions", {
                      name: row.original.fullName,
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
                    onClick={() => setEditingPatient(row.original as Patient)}
                  >
                    <Pencil aria-hidden="true" />
                    {t("actions.edit")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ),
      },
    ],
    [dateFormatter, dateTimeFormatter, isDoctorView, t],
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
  function setNextScheduleFilter(value: string) {
    setScheduleFilter(
      value === "ALL" ? undefined : (value as PatientScheduleFilter),
    );
    resetToFirstPage();
  }
  const selectedScheduleFilter = scheduleFilter ?? "ALL";
  const scheduleCounts = patientsQuery.data?.meta.scheduleCounts;
  const tenantName = tenant?.tenant.displayName ?? tenantSlug;
  const branchName = branch?.branch.name ?? branchSlug;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold text-primary">
            {isDoctorView
              ? t("doctor.eyebrow", { tenantName, branchName })
              : t("eyebrow", { tenantName, branchName })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t(isDoctorView ? "doctor.title" : "title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {t(isDoctorView ? "doctor.description" : "description")}
          </p>
        </div>
        {!isDoctorView && (
          <Button onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" />
            {t("actions.create")}
          </Button>
        )}
      </div>
      <Card>
        <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              {t(isDoctorView ? "doctor.tableTitle" : "table.title")}
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t(
                isDoctorView ? "doctor.tableDescription" : "table.description",
              )}
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label={t("table.searchPlaceholder")}
                className="h-10 rounded-xl border-primary/30 bg-muted/20 pl-10 shadow-none focus-visible:border-primary"
                disabled={patientsQuery.isLoading}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  resetToFirstPage();
                }}
                placeholder={t("table.searchPlaceholder")}
                value={globalFilter}
              />
            </div>
            <div
              aria-label={t("table.filter")}
              className="flex flex-wrap items-center gap-2"
              role="group"
            >
              <Button
                aria-pressed={selectedScheduleFilter === "ALL"}
                className={scheduleFilterClass(
                  selectedScheduleFilter === "ALL",
                )}
                onClick={() => setNextScheduleFilter("ALL")}
                type="button"
                variant="outline"
              >
                {t("filters.all")}
                <span
                  className={scheduleCountClass(
                    selectedScheduleFilter === "ALL",
                  )}
                >
                  {scheduleCounts?.all ?? 0}
                </span>
              </Button>
              <Button
                aria-pressed={selectedScheduleFilter === "WITH_UPCOMING"}
                className={scheduleFilterClass(
                  selectedScheduleFilter === "WITH_UPCOMING",
                )}
                onClick={() => setNextScheduleFilter("WITH_UPCOMING")}
                type="button"
                variant="outline"
              >
                {t("filters.withUpcoming")}
                <span
                  className={scheduleCountClass(
                    selectedScheduleFilter === "WITH_UPCOMING",
                  )}
                >
                  {scheduleCounts?.withUpcoming ?? 0}
                </span>
              </Button>
              <Button
                aria-pressed={selectedScheduleFilter === "WITHOUT_UPCOMING"}
                className={scheduleFilterClass(
                  selectedScheduleFilter === "WITHOUT_UPCOMING",
                )}
                onClick={() => setNextScheduleFilter("WITHOUT_UPCOMING")}
                type="button"
                variant="outline"
              >
                {t("filters.withoutUpcoming")}
                <span
                  className={scheduleCountClass(
                    selectedScheduleFilter === "WITHOUT_UPCOMING",
                  )}
                >
                  {scheduleCounts?.withoutUpcoming ?? 0}
                </span>
              </Button>
            </div>
          </div>
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
                    <EmptyDescription>
                      {getErrorMessage(patientsQuery.error)}
                    </EmptyDescription>
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
                    <EmptyTitle>
                      {t(isDoctorView ? "doctor.emptyTitle" : "empty.title")}
                    </EmptyTitle>
                    <EmptyDescription>
                      {t(
                        isDoctorView
                          ? "doctor.emptyDescription"
                          : "empty.description",
                      )}
                    </EmptyDescription>
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
                onColumnFiltersChange: setColumnFilters,
              },
            }}
            toolbar={{ search: false, viewOptions: false }}
          />
        </CardContent>
      </Card>
      {!isDoctorView && (
        <PatientFormDialog
          branchSlug={branchSlug}
          onOpenChange={handleFormOpenChange}
          open={createOpen || Boolean(editingPatient)}
          patient={editingPatient}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
}
