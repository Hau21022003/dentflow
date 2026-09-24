import { Alert } from "@/components/ui/alert";
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
import { UserAvatar } from "@/components/UserAvatar";
import {
  agendaRange,
  dateInTimeZone,
  formatAppointmentTime,
  minutesSinceStartOfDay,
} from "@/features/appointments/appointment-time";
import {
  useAppointmentDentistsQuery,
  useAppointmentsAgendaQuery,
} from "@/features/appointments/appointments.hooks";
import {
  APPOINTMENT_STATUSES,
  type Appointment,
  type AppointmentStatus,
} from "@/features/appointments/appointments.types";
import { cn } from "@/shared/lib/utils";
import { RefreshCw, Search, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";
const DENTIST_QUERY = { page: 1, limit: 100 };
const HOUR_HEIGHT = 84;
const DAY_MINUTES = 24 * 60;
const DEFAULT_TIMELINE_START_HOUR = 7;

const statusClass: Record<AppointmentStatus, string> = {
  BOOKED: "border-sky-500 bg-sky-100 text-slate-950",
  CONFIRMED: "border-violet-500 bg-violet-100 text-slate-950",
  CHECKED_IN: "border-teal-500 bg-teal-100 text-slate-950",
  IN_PROGRESS: "border-amber-500 bg-amber-100 text-slate-950",
  COMPLETED: "border-emerald-600 bg-emerald-100 text-slate-950",
  CANCELLED: "border-red-500 bg-red-100 text-slate-950",
  NO_SHOW: "border-orange-500 bg-orange-100 text-slate-950",
};

type Props = {
  branchSlug: string;
  date: string;
  onViewAppointment: (appointment: Appointment) => void;
  tenantSlug: string;
  timeZone: string;
};

type PositionedAppointment = {
  appointment: Appointment;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

function layoutAppointments(
  appointments: Appointment[],
  date: string,
  timeZone: string,
): PositionedAppointment[] {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const output: PositionedAppointment[] = [];
  let group: Array<{
    appointment: Appointment;
    start: number;
    end: number;
    lane: number;
  }> = [];
  let groupEnd = 0;

  const flush = () => {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1));
    output.push(
      ...group.map((item) => ({
        appointment: item.appointment,
        top: Math.max(0, Math.min(DAY_MINUTES, item.start)),
        height: Math.max(
          30,
          Math.min(DAY_MINUTES, item.end) - Math.max(0, item.start),
        ),
        lane: item.lane,
        lanes,
      })),
    );
    group = [];
    groupEnd = 0;
  };

  for (const appointment of sorted) {
    const startDate = dateInTimeZone(appointment.startAt, timeZone);
    const endDate = dateInTimeZone(appointment.endAt, timeZone);
    const start =
      startDate < date
        ? 0
        : minutesSinceStartOfDay(appointment.startAt, timeZone);
    const end =
      endDate > date
        ? DAY_MINUTES
        : minutesSinceStartOfDay(appointment.endAt, timeZone);
    if (group.length > 0 && start >= groupEnd) flush();
    const usedLanes = new Set(
      group.filter((item) => item.end > start).map((item) => item.lane),
    );
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;
    group.push({ appointment, start, end, lane });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length > 0) flush();
  return output;
}

export function AppointmentTimelineView({
  branchSlug,
  date,
  onViewAppointment,
  tenantSlug,
  timeZone,
}: Props) {
  const { i18n, t } = useTranslation("appointments");
  const [status, setStatus] = useState<string>(ALL);
  const [dentistId, setDentistId] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const initiallyScrolledDateRef = useRef<string | null>(null);
  const locale = i18n.resolvedLanguage?.startsWith("vi") ? "vi-VN" : "en-US";
  const range = useMemo(() => agendaRange(date, timeZone), [date, timeZone]);
  const dentistsQuery = useAppointmentDentistsQuery(
    tenantSlug,
    branchSlug,
    DENTIST_QUERY,
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo(
    () => ({
      ...range,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status !== ALL ? { status: status as AppointmentStatus } : {}),
      ...(dentistId !== ALL && dentistId !== UNASSIGNED
        ? { dentistUserId: dentistId }
        : {}),
    }),
    [debouncedSearch, dentistId, range, status],
  );
  const appointmentsQuery = useAppointmentsAgendaQuery(
    tenantSlug,
    branchSlug,
    query,
  );
  const appointments = useMemo(() => {
    const all = appointmentsQuery.data ?? [];
    return dentistId === UNASSIGNED
      ? all.filter((appointment) => !appointment.assignedDentist)
      : all;
  }, [appointmentsQuery.data, dentistId]);
  const dentists = useMemo(
    () => dentistsQuery.data?.items ?? [],
    [dentistsQuery.data?.items],
  );
  const columns = useMemo(() => {
    const visible =
      dentistId === ALL
        ? dentists
        : dentists.filter((dentist) => dentist.id === dentistId);
    if (
      dentistId === UNASSIGNED ||
      (dentistId === ALL && appointments.some((item) => !item.assignedDentist))
    ) {
      return [
        ...visible,
        {
          id: UNASSIGNED,
          fullName: t("timeline.unassigned"),
          avatarUrl: null,
        },
      ];
    }
    return visible;
  }, [appointments, dentistId, dentists, t]);
  const appointmentsByColumn = useMemo(
    () =>
      new Map(
        columns.map((column) => [
          column.id,
          appointments.filter((appointment) =>
            column.id === UNASSIGNED
              ? !appointment.assignedDentist
              : appointment.assignedDentist?.id === column.id,
          ),
        ]),
      ),
    [appointments, columns],
  );
  // Timeline offsets are based on branch-local minutes since midnight. Do not
  // format a UTC date here: doing so applies the branch time-zone offset a
  // second time and shifts the hour labels away from their grid lines.
  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: t("timeline.hourLabel", { hour }),
      })),
    [t],
  );

  useEffect(() => {
    if (
      appointmentsQuery.isLoading ||
      dentistsQuery.isLoading ||
      columns.length === 0 ||
      initiallyScrolledDateRef.current === date ||
      !timelineRef.current
    ) {
      return;
    }

    timelineRef.current.scrollTop = DEFAULT_TIMELINE_START_HOUR * HOUR_HEIGHT;
    initiallyScrolledDateRef.current = date;
  }, [appointmentsQuery.isLoading, columns.length, date, dentistsQuery.isLoading]);

  if (appointmentsQuery.isLoading || dentistsQuery.isLoading) {
    return <div className="h-[38rem] animate-pulse bg-muted/40" />;
  }

  if (appointmentsQuery.isError || dentistsQuery.isError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("timeline.loadError")}</span>
            <Button
              onClick={() => {
                void appointmentsQuery.refetch();
                void dentistsQuery.refetch();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              {t("agenda.retry")}
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1.35fr)_minmax(13rem,1fr)_minmax(13rem,1fr)]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={t("timeline.searchPlaceholder")}
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("timeline.searchPlaceholder")}
            value={search}
          />
        </div>
        <Select onValueChange={setDentistId} value={dentistId}>
          <SelectTrigger aria-label={t("agenda.filterDentist")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("agenda.filterDentist")}</SelectItem>
            <SelectItem value={UNASSIGNED}>
              {t("timeline.unassigned")}
            </SelectItem>
            {dentists.map((dentist) => (
              <SelectItem key={dentist.id} value={dentist.id}>
                {dentist.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={setStatus} value={status}>
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

      {columns.length === 0 ? (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Stethoscope aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("timeline.noDentistsTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("timeline.noDentistsDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          aria-label={t("timeline.gridLabel")}
          className="max-h-[38rem] overflow-auto rounded-xl border"
          data-testid="appointment-timeline"
          ref={timelineRef}
          role="region"
          tabIndex={0}
        >
          <div
            className="grid min-w-[48rem]"
            style={{
              gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(13rem, 1fr))`,
            }}
          >
            <div className="sticky top-0 z-30 flex h-16 items-center justify-center border-r border-b bg-background text-xs font-semibold text-muted-foreground">
              {t("timeline.time")}
            </div>
            {columns.map((dentist) => (
              <div
                className="sticky top-0 z-30 flex h-16 items-center gap-2 border-r border-b bg-background px-3"
                key={dentist.id}
              >
                {dentist.id === UNASSIGNED ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {"\u2014"}
                  </span>
                ) : (
                  <UserAvatar
                    avatarUrl={dentist.avatarUrl}
                    className="size-8 bg-primary/10 text-xs font-bold text-primary"
                    fullName={dentist.fullName}
                  />
                )}
                <p className="truncate text-sm font-semibold">
                  {dentist.fullName}
                </p>
              </div>
            ))}
            <div
              className="relative border-r"
              style={{ height: (DAY_MINUTES / 60) * HOUR_HEIGHT }}
            >
              {hours.map(({ hour, label }, index) => (
                <span
                  className={cn(
                    "absolute right-2 text-xs tabular-nums text-muted-foreground",
                    index === 0 ? "translate-y-0" : "-translate-y-2",
                  )}
                  key={hour}
                  style={{ top: index * HOUR_HEIGHT }}
                >
                  {label}
                </span>
              ))}
            </div>
            {columns.map((dentist) => {
              const columnAppointments =
                appointmentsByColumn.get(dentist.id) ?? [];
              const positioned = layoutAppointments(
                columnAppointments,
                date,
                timeZone,
              );
              return (
                <div
                  className="relative border-r bg-background"
                  key={dentist.id}
                  style={{ height: (DAY_MINUTES / 60) * HOUR_HEIGHT }}
                >
                  {hours.map(({ hour }, index) => (
                    <div
                      aria-hidden="true"
                      className="absolute right-0 left-0 border-t border-border/70"
                      key={hour}
                      style={{ top: index * HOUR_HEIGHT }}
                    />
                  ))}
                  {columnAppointments.length === 0 && (
                    <p className="absolute top-5 right-3 left-3 text-center text-xs text-muted-foreground">
                      {t("timeline.emptyColumn")}
                    </p>
                  )}
                  {positioned.map(
                    ({ appointment, top, height, lane, lanes }) => {
                      return (
                        <button
                          aria-label={t("timeline.viewAppointment", {
                            patient: appointment.patient.fullName,
                            start: formatAppointmentTime(
                              appointment.startAt,
                              timeZone,
                              locale,
                            ),
                          })}
                          className={cn(
                            "absolute z-10 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left shadow-sm outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring",
                            statusClass[appointment.status],
                          )}
                          data-appointment-id={appointment.id}
                          key={appointment.id}
                          onClick={() => onViewAppointment(appointment)}
                          style={{
                            top: (top / 60) * HOUR_HEIGHT + 2,
                            height: Math.max(
                              28,
                              (height / 60) * HOUR_HEIGHT - 4,
                            ),
                            left: `calc(${(lane / lanes) * 100}% + 3px)`,
                            width: `calc(${100 / lanes}% - 6px)`,
                          }}
                          type="button"
                        >
                          <span className="block truncate text-xs font-semibold">
                            {appointment.patient.fullName}
                          </span>
                          <span className="block truncate text-[11px] tabular-nums text-slate-700">
                            {formatAppointmentTime(
                              appointment.startAt,
                              timeZone,
                              locale,
                            )}{" "}
                            –{" "}
                            {formatAppointmentTime(
                              appointment.endAt,
                              timeZone,
                              locale,
                            )}
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!appointmentsQuery.isLoading &&
        appointments.length === 0 &&
        columns.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {t("timeline.emptyDay")}
          </p>
        )}
    </div>
  );
}
