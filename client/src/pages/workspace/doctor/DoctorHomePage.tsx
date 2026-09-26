import { pathFor } from "@/app/router/paths";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  addMonthsInTimeZone,
  agendaRange,
  dateInTimeZone,
  formatAppointmentDate,
  formatAppointmentTime,
  monthForDate,
  todayInTimeZone,
} from "@/features/appointments/appointment-time";
import { AppointmentStatusBadge } from "@/features/appointments/components/AppointmentStatusBadge";
import {
  useAssignedAppointmentCalendarSummaryQuery,
  useAssignedAppointmentsAgendaQuery,
} from "@/features/appointments/appointments.hooks";
import type {
  AssignedAppointment,
  AppointmentStatus,
} from "@/features/appointments/appointments.types";
import { useStartVisitMutation } from "@/features/visits/visits.hooks";
import { handleApiError } from "@/shared/lib/error";
import {
  idempotencyKeyForIntent,
  type IdempotencyIntent,
} from "@/shared/lib/idempotency";
import { localeForLanguage } from "@/shared/lib/money";
import { cn } from "@/shared/lib/utils";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DoctorScheduleCalendar } from "./DoctorScheduleCalendar";
import { useRouteWorkspaceContext } from "../use-route-workspace-context";

const ACTIVE_DURATION_STATUSES = new Set<AppointmentStatus>([
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
]);

const statusAccentClass: Record<AppointmentStatus, string> = {
  BOOKED: "bg-blue-500",
  CONFIRMED: "bg-cyan-500",
  CHECKED_IN: "bg-emerald-500",
  IN_PROGRESS: "bg-orange-500",
  COMPLETED: "bg-slate-500",
  CANCELLED: "bg-red-500",
  NO_SHOW: "bg-amber-500",
};

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function ageAt(dateOfBirth: string | null, date: string): number | null {
  if (!dateOfBirth) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const [year, month, day] = date.split("-").map(Number);
  if (![birthYear, birthMonth, birthDay, year, month, day].every(Number.isFinite)) {
    return null;
  }
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}

function durationMinutes(appointments: AssignedAppointment[]): number {
  return appointments.reduce((total, appointment) => {
    if (!ACTIVE_DURATION_STATUSES.has(appointment.status)) return total;
    return total + (new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000;
  }, 0);
}

export function DoctorHomePage() {
  const { branch, branchSlug, tenantSlug } = useRouteWorkspaceContext();
  const { i18n, t } = useTranslation("appointments");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [startError, setStartError] = useState("");
  const [startIntent, setStartIntent] = useState<IdempotencyIntent | null>(null);
  const timeZone = branch?.branch.timezone ?? "Asia/Ho_Chi_Minh";
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const dateParam = searchParams.get("date");
  const date = isValidDate(dateParam) ? dateParam : todayInTimeZone(timeZone);
  const range = useMemo(() => agendaRange(date, timeZone), [date, timeZone]);
  const agenda = useAssignedAppointmentsAgendaQuery(tenantSlug, branchSlug, range);
  const summary = useAssignedAppointmentCalendarSummaryQuery(
    tenantSlug,
    branchSlug,
    monthForDate(date),
  );
  const startVisitMutation = useStartVisitMutation();
  const appointments = agenda.data ?? [];
  const totalMinutes = durationMinutes(appointments);

  function setDate(nextDate: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("date", nextDate);
    setSearchParams(nextSearchParams);
  }

  function openVisit(appointment: AssignedAppointment) {
    navigate(
      pathFor.workspaceDoctorVisit(
        tenantSlug,
        branchSlug,
        appointment.id,
        dateInTimeZone(appointment.startAt, timeZone),
      ),
    );
  }

  async function startVisit(appointment: AssignedAppointment) {
    setStartError("");
    try {
      const nextIntent = idempotencyKeyForIntent(startIntent, {
        appointmentId: appointment.id,
        branchSlug,
        operation: "clinical.visit.start",
        tenantSlug,
      });
      setStartIntent(nextIntent);
      await startVisitMutation.mutateAsync({
        tenantSlug,
        branchSlug,
        appointmentId: appointment.id,
        idempotencyKey: nextIntent.key,
      });
      setStartIntent(null);
      openVisit(appointment);
    } catch (error) {
      handleApiError({ error, onMessage: setStartError });
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("doctorTitle")}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          {t("doctorDescription")}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[23rem_minmax(0,1fr)] xl:items-start">
        <DoctorScheduleCalendar
          date={date}
          isError={summary.isError}
          isLoading={summary.isLoading}
          locale={locale}
          onDateChange={setDate}
          onNextMonth={() => setDate(addMonthsInTimeZone(date, 1, timeZone))}
          onPreviousMonth={() => setDate(addMonthsInTimeZone(date, -1, timeZone))}
          onRetry={() => void summary.refetch()}
          onToday={() => setDate(todayInTimeZone(timeZone))}
          summary={summary.data}
          timeZone={timeZone}
        />

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b px-5 py-5 sm:px-7">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {formatAppointmentDate(date, timeZone, locale)}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("doctorSchedule.agendaMeta", {
                  count: appointments.length,
                  duration: t("doctorSchedule.totalDuration", {
                    hours: Math.floor(totalMinutes / 60),
                    minutes: totalMinutes % 60,
                  }),
                })}
              </p>
            </div>

            {startError && <Alert className="m-5" variant="destructive">{startError}</Alert>}

            {agenda.isLoading ? (
              <div className="space-y-3 p-5 sm:p-7">
                {[1, 2, 3, 4].map((index) => (
                  <div className="h-24 animate-pulse rounded-xl bg-muted" key={index} />
                ))}
              </div>
            ) : agenda.isError ? (
              <div className="grid justify-items-center gap-3 p-12 text-center">
                <CalendarDays aria-hidden="true" className="size-8 text-muted-foreground" />
                <p className="font-semibold">{t("agenda.loadError")}</p>
                <Button onClick={() => void agenda.refetch()} size="sm" type="button">
                  <RefreshCw aria-hidden="true" />
                  {t("agenda.retry")}
                </Button>
              </div>
            ) : appointments.length === 0 ? (
              <div className="grid justify-items-center gap-3 p-12 text-center">
                <CalendarDays aria-hidden="true" className="size-8 text-muted-foreground" />
                <p className="font-semibold">{t("agenda.emptyTitle")}</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t("doctorSchedule.emptyDescription")}
                </p>
              </div>
            ) : (
              <ol className="divide-y">
                {appointments.map((appointment) => {
                  const appointmentDate = dateInTimeZone(appointment.startAt, timeZone);
                  const age = ageAt(appointment.patient.dateOfBirth, appointmentDate);
                  const isStarting =
                    startVisitMutation.isPending &&
                    startVisitMutation.variables?.appointmentId === appointment.id;
                  const actionLabel =
                    appointment.status === "CHECKED_IN"
                      ? t("doctorSchedule.startVisit")
                      : appointment.status === "IN_PROGRESS"
                        ? t("doctorSchedule.continueVisit")
                        : t("doctorSchedule.viewAppointment");

                  return (
                    <li
                      className="grid gap-4 px-5 py-5 sm:grid-cols-[5.25rem_minmax(13rem,1.15fr)_minmax(10rem,1fr)_auto_auto] sm:items-center sm:px-7 xl:grid-cols-[5.25rem_minmax(12rem,1.2fr)_minmax(10rem,1fr)_8.25rem_8.75rem]"
                      key={appointment.id}
                    >
                      <div className="tabular-nums">
                        <p className="whitespace-nowrap font-bold">
                          {formatAppointmentTime(appointment.startAt, timeZone, locale)}
                        </p>
                        <p className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatAppointmentTime(appointment.endAt, timeZone, locale)}
                        </p>
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                        >
                          {initials(appointment.patient.fullName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{appointment.patient.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {t(`detail.genders.${appointment.patient.gender}`)}
                            {age !== null && ` · ${t("detail.age", { count: age })}`}
                          </p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {appointment.service?.name ?? appointment.visitReason ?? t("detail.notProvided")}
                        </p>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock3 aria-hidden="true" className="size-4" />
                          {t("detail.duration", {
                            count: Math.round(
                              (new Date(appointment.endAt).getTime() -
                                new Date(appointment.startAt).getTime()) /
                                60000,
                            ),
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn("size-2.5 rounded-full", statusAccentClass[appointment.status])}
                        />
                        <AppointmentStatusBadge status={appointment.status} />
                      </div>
                      <Button
                        disabled={isStarting}
                        onClick={() =>
                          appointment.status === "CHECKED_IN"
                            ? void startVisit(appointment)
                            : openVisit(appointment)
                        }
                        size="sm"
                        type="button"
                        variant={appointment.status === "CHECKED_IN" ? "default" : "outline"}
                      >
                        {appointment.status === "CHECKED_IN" && <Stethoscope aria-hidden="true" />}
                        {isStarting ? t("doctorSchedule.startingVisit") : actionLabel}
                        {appointment.status !== "CHECKED_IN" && <ChevronRight aria-hidden="true" />}
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
