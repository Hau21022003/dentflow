import { DataTable } from "@/components/shadcntable/data-table";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { agendaRange, formatAppointmentTime } from "@/features/appointments/appointment-time";
import {
  useAppointmentDentistsQuery,
  useAppointmentsListQuery,
} from "@/features/appointments/appointments.hooks";
import {
  APPOINTMENT_STATUSES,
  type Appointment,
  type AppointmentListQuery,
  type AppointmentStatus,
} from "@/features/appointments/appointments.types";
import { AppointmentStatusBadge } from "@/features/appointments/components/AppointmentStatusBadge";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { localeForLanguage } from "@/shared/lib/money";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { CalendarDays, ChevronRight, Search, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const ALL = "__all__";
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DENTIST_QUERY = { page: 1, limit: 100 };

type Props = {
  branchSlug: string;
  date: string;
  onViewAppointment: (appointment: Appointment) => void;
  tenantSlug: string;
  timeZone: string;
};

export function AppointmentListView({
  branchSlug,
  date,
  onViewAppointment,
  tenantSlug,
  timeZone,
}: Props) {
  const { i18n, t } = useTranslation("appointments");
  const { t: tCommon } = useTranslation("common");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [status, setStatus] = useState<string>(ALL);
  const [dentistId, setDentistId] = useState<string>(ALL);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const range = useMemo(() => agendaRange(date, timeZone), [date, timeZone]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const query = useMemo<AppointmentListQuery>(
    () => ({
      ...range,
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== ALL ? { status: status as AppointmentStatus } : {}),
      ...(dentistId !== ALL ? { dentistUserId: dentistId } : {}),
    }),
    [debouncedSearch, dentistId, pagination, range, status],
  );
  const appointmentsQuery = useAppointmentsListQuery(tenantSlug, branchSlug, query);
  const dentistsQuery = useAppointmentDentistsQuery(
    tenantSlug,
    branchSlug,
    DENTIST_QUERY,
  );
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("list.searchPlaceholder") },
      }),
    [t, tCommon],
  );
  const columns = useMemo<ColumnDef<Appointment>[]>(
    () => [
      {
        id: "time",
        header: () => t("list.columns.time"),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatAppointmentTime(row.original.startAt, timeZone, locale)} – {formatAppointmentTime(row.original.endAt, timeZone, locale)}
          </span>
        ),
      },
      {
        id: "patient",
        header: () => t("list.columns.patient"),
        cell: ({ row }) => (
          <div className="min-w-44">
            <p className="font-semibold">{row.original.patient.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.original.patient.phone}</p>
          </div>
        ),
      },
      {
        id: "dentist",
        header: () => t("list.columns.dentist"),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Stethoscope aria-hidden="true" className="size-3.5" />
            {row.original.assignedDentist?.fullName ?? t("form.unassigned")}
          </span>
        ),
      },
      {
        id: "service",
        header: () => t("list.columns.service"),
        cell: ({ row }) => row.original.service?.name ?? row.original.visitReason ?? t("detail.notProvided"),
      },
      {
        id: "status",
        header: () => t("list.columns.status"),
        cell: ({ row }) => <AppointmentStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">{t("list.columns.actions")}</span>,
        cell: ({ row }) => (
          <Button
            aria-label={t("actions.view")}
            onClick={() => onViewAppointment(row.original)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        ),
      },
    ],
    [locale, onViewAppointment, t, timeZone],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <div className="space-y-4 p-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1.35fr)_minmax(13rem,1fr)_minmax(13rem,1fr)]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={t("list.searchPlaceholder")}
            className="pl-9"
            disabled={appointmentsQuery.isLoading}
            onChange={(event) => {
              setGlobalFilter(event.target.value);
              resetToFirstPage();
            }}
            placeholder={t("list.searchPlaceholder")}
            value={globalFilter}
          />
        </div>
        <Select
          onValueChange={(value) => {
            setDentistId(value);
            resetToFirstPage();
          }}
          value={dentistId}
        >
          <SelectTrigger aria-label={t("agenda.filterDentist")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("agenda.filterDentist")}</SelectItem>
            {(dentistsQuery.data?.items ?? []).map((dentist) => (
              <SelectItem key={dentist.id} value={dentist.id}>
                {dentist.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) => {
            setStatus(value);
            resetToFirstPage();
          }}
          value={status}
        >
          <SelectTrigger aria-label={t("agenda.filterStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("agenda.filterStatus")}</SelectItem>
            {APPOINTMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`statuses.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={appointmentsQuery.data?.items ?? []}
        emptyState={
          appointmentsQuery.isError ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>{t("list.loadErrorTitle")}</EmptyTitle>
                <EmptyDescription>{getErrorMessage(appointmentsQuery.error)}</EmptyDescription>
                <Button onClick={() => void appointmentsQuery.refetch()} size="sm" type="button">
                  {t("agenda.retry")}
                </Button>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>{t("list.emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("list.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        }
        isFetching={appointmentsQuery.isFetching}
        isLoading={appointmentsQuery.isLoading}
        locale={dataTableLocale}
        onRowClick={onViewAppointment}
        pagination={{
          manual: true,
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          rowCount: appointmentsQuery.data?.meta.total ?? 0,
          onPaginationChange: (next) =>
            setPagination((current) => ({
              pageIndex: next.pageSize === current.pageSize ? next.pageIndex : 0,
              pageSize: next.pageSize,
            })),
        }}
        serverState={{
          filtering: {
            globalFilter,
            columnFilters,
            onGlobalFilterChange: (value) => {
              setGlobalFilter(value);
              resetToFirstPage();
            },
            onColumnFiltersChange: setColumnFilters,
          },
        }}
        toolbar={{ search: false, viewOptions: false }}
      />
    </div>
  );
}
