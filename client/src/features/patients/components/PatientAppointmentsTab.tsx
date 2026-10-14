import { DataTable } from "@/components/shadcntable/data-table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addDaysInTimeZone,
  formatAppointmentTime,
  fromAppointmentDateAndTime,
  todayInTimeZone,
} from "@/features/appointments/appointment-time";
import { AppointmentActionDialog, type AppointmentAction } from "@/features/appointments/components/AppointmentActionDialog";
import { AppointmentAssignmentDialog } from "@/features/appointments/components/AppointmentAssignmentDialog";
import { AppointmentDetailSheet } from "@/features/appointments/components/AppointmentDetailSheet";
import { AppointmentFormDialog } from "@/features/appointments/components/AppointmentFormDialog";
import { AppointmentStatusBadge } from "@/features/appointments/components/AppointmentStatusBadge";
import { useAppointmentDentistsQuery } from "@/features/appointments/appointments.hooks";
import { APPOINTMENT_STATUSES, type Appointment, type AppointmentStatus } from "@/features/appointments/appointments.types";
import { usePatientAppointmentsQuery } from "@/features/patients/patients.hooks";
import type {
  Patient,
  PatientAppointmentListItem,
  PatientAppointmentListQuery,
  PatientOverview,
} from "@/features/patients/patients.types";
import { createDataTableLocale } from "@/i18n/data-table";
import { getErrorMessage } from "@/shared/lib/error";
import { localeForLanguage } from "@/shared/lib/money";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, ChevronRight, Clock3, MapPin, Plus, RotateCcw, Search, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { DateRange } from "react-day-picker";

const ALL = "__all__";
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DENTIST_QUERY = { page: 1, limit: 100 };

type Props = {
  branchSlug: string;
  canAssign: boolean;
  nextAppointment: PatientOverview["nextAppointment"];
  patient: Patient;
  tenantSlug: string;
  timeZone: string;
};

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function durationMinutes(startAt: string, endAt: string): number {
  return Math.max(
    0,
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000),
  );
}

export function PatientAppointmentsTab({
  branchSlug,
  canAssign,
  nextAppointment,
  patient,
  tenantSlug,
  timeZone,
}: Props) {
  const { i18n, t } = useTranslation("patients");
  const { t: tAppointments } = useTranslation("appointments");
  const { t: tCommon } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [status, setStatus] = useState<string>(ALL);
  const [dentistId, setDentistId] = useState<string>(ALL);
  const [globalFilter, setGlobalFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | undefined>();
  const [assigning, setAssigning] = useState<Appointment | null>(null);
  const [actionSelection, setActionSelection] = useState<{
    action: AppointmentAction;
    appointment: Appointment;
  } | null>(null);
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const detailId = searchParams.get("appointmentId");
  const defaultDate = todayInTimeZone(timeZone);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }),
    [locale, timeZone],
  );
  const longDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone }),
    [locale, timeZone],
  );
  const calendarDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(globalFilter.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [globalFilter]);

  const selectedRange = useMemo(() => {
    if (!dateRange?.from || !dateRange.to) return null;
    const fromDate = dateInputValue(dateRange.from);
    const throughDate = dateInputValue(dateRange.to);
    const toDate = addDaysInTimeZone(throughDate, 1, timeZone);
    const from = fromAppointmentDateAndTime(fromDate, "00:00", timeZone);
    const to = fromAppointmentDateAndTime(toDate, "00:00", timeZone);
    return from && to ? { from, to } : null;
  }, [dateRange, timeZone]);

  const query = useMemo<PatientAppointmentListQuery>(
    () => ({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      sortBy: "startAt",
      sortOrder: "DESC",
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== ALL ? { status: status as AppointmentStatus } : {}),
      ...(dentistId !== ALL ? { dentistUserId: dentistId } : {}),
      ...(selectedRange ?? {}),
    }),
    [debouncedSearch, dentistId, pagination, selectedRange, status],
  );
  const appointmentsQuery = usePatientAppointmentsQuery(
    tenantSlug,
    branchSlug,
    patient.id,
    query,
  );
  const dentistsQuery = useAppointmentDentistsQuery(
    tenantSlug,
    branchSlug,
    DENTIST_QUERY,
  );
  const dataTableLocale = useMemo(
    () =>
      createDataTableLocale(tCommon, {
        toolbar: { searchPlaceholder: t("detail.appointments.searchPlaceholder") },
      }),
    [t, tCommon],
  );

  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function clearFilters() {
    setGlobalFilter("");
    setDebouncedSearch("");
    setStatus(ALL);
    setDentistId(ALL);
    setDateRange(undefined);
    resetToFirstPage();
  }

  const openDetail = useCallback((appointmentId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "appointments");
    params.set("appointmentId", appointmentId);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  function closeDetail() {
    const params = new URLSearchParams(searchParams);
    params.delete("appointmentId");
    setSearchParams(params, { replace: true });
  }

  function closeForm(open: boolean) {
    if (!open) {
      setCreateOpen(false);
      setEditing(undefined);
    }
  }

  const columns = useMemo<ColumnDef<PatientAppointmentListItem>[]>(
    () => [
      {
        id: "dateTime",
        header: () => t("detail.appointments.columns.dateTime"),
        cell: ({ row }) => (
          <div className="min-w-28">
            <p className="font-medium">{dateFormatter.format(new Date(row.original.startAt))}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatAppointmentTime(row.original.startAt, timeZone, locale)} – {formatAppointmentTime(row.original.endAt, timeZone, locale)}
            </p>
          </div>
        ),
      },
      {
        id: "service",
        header: () => t("detail.appointments.columns.service"),
        cell: ({ row }) => row.original.service?.name ?? row.original.visitReason ?? t("table.notProvided"),
      },
      {
        id: "dentist",
        header: () => t("detail.appointments.columns.dentist"),
        cell: ({ row }) => row.original.assignedDentist?.fullName ?? tAppointments("form.unassigned"),
      },
      {
        id: "operatory",
        header: () => t("detail.appointments.columns.operatory"),
        cell: ({ row }) => row.original.operatory?.name ?? t("table.notProvided"),
      },
      {
        id: "duration",
        header: () => t("detail.appointments.columns.duration"),
        cell: ({ row }) => tAppointments("detail.duration", { count: durationMinutes(row.original.startAt, row.original.endAt) }),
      },
      {
        id: "status",
        header: () => t("detail.appointments.columns.status"),
        cell: ({ row }) => <AppointmentStatusBadge status={row.original.status} />,
      },
      {
        id: "note",
        header: () => t("detail.appointments.columns.note"),
        cell: ({ row }) => <span className="line-clamp-2 min-w-32">{row.original.operationalNote ?? t("table.notProvided")}</span>,
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">{t("detail.appointments.columns.actions")}</span>,
        cell: ({ row }) => (
          <Button aria-label={t("detail.appointments.viewDetails")} onClick={() => openDetail(row.original.id)} size="icon-sm" type="button" variant="ghost">
            <ChevronRight aria-hidden="true" />
          </Button>
        ),
      },
    ],
    [dateFormatter, locale, openDetail, t, tAppointments, timeZone],
  );

  const dateRangeLabel = dateRange?.from
    ? dateRange.to
      ? t("detail.appointments.dateRangeValue", {
          from: calendarDateFormatter.format(dateRange.from),
          to: calendarDateFormatter.format(dateRange.to),
        })
      : calendarDateFormatter.format(dateRange.from)
    : t("detail.appointments.dateRangePlaceholder");
  const hasActiveFilters = Boolean(
    globalFilter.trim() ||
      status !== ALL ||
      dentistId !== ALL ||
      dateRange,
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center gap-3 border-b p-5">
          <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><CalendarDays aria-hidden="true" className="size-5" /></span>
          <CardTitle>{t("detail.appointments.upcomingTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {nextAppointment ? (
            <div className="flex flex-col gap-5 rounded-xl bg-muted/60 p-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold">{longDateFormatter.format(new Date(nextAppointment.startAt))}</p>
                  <AppointmentStatusBadge status={nextAppointment.status} />
                </div>
                <p className="font-semibold">{nextAppointment.serviceName ?? nextAppointment.visitReason ?? t("table.notProvided")}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-4" />{formatAppointmentTime(nextAppointment.startAt, timeZone, locale)} – {formatAppointmentTime(nextAppointment.endAt, timeZone, locale)}</span>
                  <span className="inline-flex items-center gap-1.5"><Stethoscope aria-hidden="true" className="size-4" />{nextAppointment.assignedDentist?.fullName ?? tAppointments("form.unassigned")}</span>
                  {nextAppointment.operatory && <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4" />{nextAppointment.operatory.name}</span>}
                  <span>{tAppointments("detail.duration", { count: durationMinutes(nextAppointment.startAt, nextAppointment.endAt) })}</span>
                </div>
              </div>
              <Button onClick={() => openDetail(nextAppointment.id)} type="button" variant="outline">{t("detail.appointments.viewDetails")}<ChevronRight aria-hidden="true" /></Button>
            </div>
          ) : (
            <Empty className="border py-10"><EmptyHeader><EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia><EmptyTitle>{t("detail.nextAppointment.emptyTitle")}</EmptyTitle><EmptyDescription>{t("detail.nextAppointment.emptyDescription")}</EmptyDescription></EmptyHeader></Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><CalendarDays aria-hidden="true" className="size-5" /></span>
            <CardTitle>{t("detail.appointments.listTitle")}</CardTitle>
          </div>
          <Button onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" />{tAppointments("actions.create")}</Button>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(15rem,1.4fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_minmax(15rem,1fr)]">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={t("detail.appointments.searchPlaceholder")}
                className="pl-9"
                onChange={(event) => { setGlobalFilter(event.target.value); resetToFirstPage(); }}
                placeholder={t("detail.appointments.searchPlaceholder")}
                value={globalFilter}
              />
            </div>
            <Select onValueChange={(value) => { setStatus(value); resetToFirstPage(); }} value={status}>
              <SelectTrigger aria-label={t("detail.appointments.allStatuses")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("detail.appointments.allStatuses")}</SelectItem>
                {APPOINTMENT_STATUSES.map((value) => <SelectItem key={value} value={value}>{tAppointments(`statuses.${value}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => { setDentistId(value); resetToFirstPage(); }} value={dentistId}>
              <SelectTrigger aria-label={t("detail.appointments.allDentists")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("detail.appointments.allDentists")}</SelectItem>
                {(dentistsQuery.data?.items ?? []).map((dentist) => <SelectItem key={dentist.id} value={dentist.id}>{dentist.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex min-w-0 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button className="min-w-0 flex-1 justify-start overflow-hidden font-normal" type="button" variant="outline">
                    <CalendarDays aria-hidden="true" />
                    <span className="truncate">{dateRangeLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                    captionLayout="dropdown"
                    mode="range"
                    numberOfMonths={1}
                    onSelect={(range) => { setDateRange(range); resetToFirstPage(); }}
                    selected={dateRange}
                  />
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button
                  className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-200 dark:bg-blue-50 dark:text-blue-700 dark:hover:bg-blue-100 dark:hover:text-blue-800"
                  onClick={clearFilters}
                  type="button"
                  variant="outline"
                >
                  <RotateCcw aria-hidden="true" />
                  {t("detail.appointments.clearFilters")}
                </Button>
              )}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={appointmentsQuery.data?.items ?? []}
            emptyState={appointmentsQuery.isError ? (
              <Empty className="border-0 py-10"><EmptyHeader><EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia><EmptyTitle>{t("detail.appointments.loadErrorTitle")}</EmptyTitle><EmptyDescription>{getErrorMessage(appointmentsQuery.error)}</EmptyDescription><Button onClick={() => void appointmentsQuery.refetch()} size="sm" type="button">{t("actions.retry")}</Button></EmptyHeader></Empty>
            ) : (
              <Empty className="border-0 py-10"><EmptyHeader><EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia><EmptyTitle>{t("detail.appointments.emptyTitle")}</EmptyTitle><EmptyDescription>{t("detail.appointments.emptyDescription")}</EmptyDescription></EmptyHeader></Empty>
            )}
            isFetching={appointmentsQuery.isFetching}
            isLoading={appointmentsQuery.isLoading}
            locale={dataTableLocale}
            onRowClick={(appointment) => openDetail(appointment.id)}
            pagination={{
              manual: true,
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              rowCount: appointmentsQuery.data?.meta.total ?? 0,
              onPaginationChange: (next) => setPagination((current) => ({
                pageIndex: next.pageSize === current.pageSize ? next.pageIndex : 0,
                pageSize: next.pageSize,
              })),
            }}
            renderMobileItem={(appointment) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{dateFormatter.format(new Date(appointment.startAt))}</p><p className="text-xs tabular-nums text-muted-foreground">{formatAppointmentTime(appointment.startAt, timeZone, locale)} – {formatAppointmentTime(appointment.endAt, timeZone, locale)}</p></div>
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
                <p className="font-medium">{appointment.service?.name ?? appointment.visitReason ?? t("table.notProvided")}</p>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <span>{appointment.assignedDentist?.fullName ?? tAppointments("form.unassigned")}</span>
                  <span>{appointment.operatory?.name ?? t("table.notProvided")}</span>
                  <span>{tAppointments("detail.duration", { count: durationMinutes(appointment.startAt, appointment.endAt) })}</span>
                  <span className="line-clamp-1">{appointment.operationalNote ?? t("table.notProvided")}</span>
                </div>
              </div>
            )}
            toolbar={{ search: false, viewOptions: false }}
          />
        </CardContent>
      </Card>

      <AppointmentFormDialog
        appointment={editing}
        branchSlug={branchSlug}
        defaultDate={defaultDate}
        initialPatient={patient}
        lockPatient={!editing}
        onOpenChange={closeForm}
        open={createOpen || Boolean(editing)}
        tenantSlug={tenantSlug}
        timeZone={timeZone}
      />
      <AppointmentDetailSheet
        appointmentId={detailId}
        branchSlug={branchSlug}
        canAssign={canAssign}
        onAction={(action, appointment) => setActionSelection({ action, appointment })}
        onAssign={setAssigning}
        onEdit={setEditing}
        onOpenChange={(open) => !open && closeDetail()}
        open={Boolean(detailId)}
        tenantSlug={tenantSlug}
        timeZone={timeZone}
      />
      {assigning && <AppointmentAssignmentDialog appointment={assigning} branchSlug={branchSlug} onOpenChange={(open) => !open && setAssigning(null)} open tenantSlug={tenantSlug} />}
      {actionSelection && <AppointmentActionDialog action={actionSelection.action} appointment={actionSelection.appointment} branchSlug={branchSlug} onOpenChange={(open) => !open && setActionSelection(null)} open tenantSlug={tenantSlug} />}
    </div>
  );
}
