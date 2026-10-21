import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monthForDate } from "@/features/appointments/appointment-time";
import {
  APPOINTMENT_STATUSES,
  type AppointmentCalendarSummary,
  type AppointmentStatus,
} from "@/features/appointments/appointments.types";
import { cn } from "@/shared/lib/utils";
import { TZDate } from "@date-fns/tz";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type CalendarCell = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
};

type Props = {
  date: string;
  isError: boolean;
  isLoading: boolean;
  locale: string;
  onDateChange: (date: string) => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onRetry: () => void;
  onToday: () => void;
  summary: AppointmentCalendarSummary | undefined;
  timeZone: string;
};

const statusDotClass: Record<AppointmentStatus, string> = {
  BOOKED: "bg-blue-500",
  CONFIRMED: "bg-cyan-500",
  CHECKED_IN: "bg-emerald-500",
  IN_PROGRESS: "bg-orange-500",
  COMPLETED: "bg-slate-500",
  CANCELLED: "bg-red-500",
  NO_SHOW: "bg-amber-500",
};

const statusSummaryClass: Record<AppointmentStatus, string> = {
  BOOKED:
    "border-blue-500/15 bg-blue-500/[0.04] dark:border-blue-400/20 dark:bg-blue-400/[0.07]",
  CONFIRMED:
    "border-cyan-500/15 bg-cyan-500/[0.04] dark:border-cyan-400/20 dark:bg-cyan-400/[0.07]",
  CHECKED_IN:
    "border-emerald-500/15 bg-emerald-500/[0.04] dark:border-emerald-400/20 dark:bg-emerald-400/[0.07]",
  IN_PROGRESS:
    "border-orange-500/15 bg-orange-500/[0.04] dark:border-orange-400/20 dark:bg-orange-400/[0.07]",
  COMPLETED:
    "border-slate-500/15 bg-slate-500/[0.04] dark:border-slate-400/20 dark:bg-slate-400/[0.07]",
  CANCELLED:
    "border-red-500/15 bg-red-500/[0.04] dark:border-red-400/20 dark:bg-red-400/[0.07]",
  NO_SHOW:
    "border-amber-500/15 bg-amber-500/[0.04] dark:border-amber-400/20 dark:bg-amber-400/[0.07]",
};

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthCells(month: string): CalendarCell[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const leadingDays = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const calendarDate = new Date(
      Date.UTC(year, monthNumber - 1, index - leadingDays + 1),
    );
    const cellMonth = calendarDate.getUTCMonth() + 1;
    return {
      date: formatDate(
        calendarDate.getUTCFullYear(),
        cellMonth,
        calendarDate.getUTCDate(),
      ),
      day: calendarDate.getUTCDate(),
      isCurrentMonth: cellMonth === monthNumber,
    };
  });
}

function emptyStatuses(): Record<AppointmentStatus, number> {
  return Object.fromEntries(
    APPOINTMENT_STATUSES.map((status) => [status, 0]),
  ) as Record<AppointmentStatus, number>;
}

function formatMonth(date: string, locale: string, timeZone: string): string {
  const [year, month] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone,
    year: "numeric",
  }).format(new TZDate(year, month - 1, 1, 12, timeZone));
}

function formatLongDate(
  date: string,
  locale: string,
  timeZone: string,
): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long",
    year: "numeric",
  }).format(new TZDate(year, month - 1, day, 12, timeZone));
}

export function DoctorScheduleCalendar({
  date,
  isError,
  isLoading,
  locale,
  onDateChange,
  onNextMonth,
  onPreviousMonth,
  onRetry,
  onToday,
  summary,
  timeZone,
}: Props) {
  const { t } = useTranslation("appointments");
  const month = monthForDate(date);
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const summaries = useMemo(
    () => new Map(summary?.days.map((day) => [day.date, day]) ?? []),
    [summary],
  );
  const selectedDay = summaries.get(date) ?? {
    date,
    total: 0,
    statuses: emptyStatuses(),
  };
  const selectedStatuses = APPOINTMENT_STATUSES.filter(
    (status) => selectedDay.statuses[status] > 0,
  );
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(
          new TZDate(2024, 0, index + 1, 12, timeZone),
        ),
      ),
    [locale, timeZone],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-3">
          <div className="flex items-center gap-1">
            <Button
              aria-label={t("doctorSchedule.previousMonth")}
              onClick={onPreviousMonth}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <CardTitle className="min-w-0 text-sm sm:min-w-[8.75rem] sm:text-xl">
              {formatMonth(date, locale, timeZone)}
            </CardTitle>
            <Button
              aria-label={t("doctorSchedule.nextMonth")}
              onClick={onNextMonth}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <Button
            className="px-2 text-xs sm:px-2.5"
            onClick={onToday}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("agenda.today")}
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
          {isLoading ? (
            <div
              className="grid grid-cols-7 gap-2"
              aria-label={t("month.calendarLabel")}
            >
              {Array.from({ length: 35 }, (_, index) => (
                <div
                  className="h-9 animate-pulse rounded-md bg-muted sm:h-11"
                  key={index}
                />
              ))}
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <div className="flex items-center justify-between gap-3">
                <span>{t("doctorSchedule.summaryLoadError")}</span>
                <Button
                  onClick={onRetry}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" />
                  {t("agenda.retry")}
                </Button>
              </div>
            </Alert>
          ) : (
            <div aria-label={t("month.calendarLabel")}>
              <div className="mb-2 grid grid-cols-7">
                {weekdays.map((weekday) => (
                  <span
                    className="text-center text-xs font-medium text-muted-foreground"
                    key={weekday}
                  >
                    {weekday}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((cell) => {
                  const day = summaries.get(cell.date);
                  const isSelected = cell.date === date;
                  return cell.isCurrentMonth ? (
                    <button
                      aria-current={isSelected ? "date" : undefined}
                      aria-label={t("month.selectDay", {
                        count: day?.total ?? 0,
                        date: formatLongDate(cell.date, locale, timeZone),
                      })}
                      className={cn(
                        "mx-auto flex size-9 flex-col items-center justify-center rounded-md text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10 sm:text-sm",
                        isSelected &&
                          "bg-primary text-primary-foreground hover:bg-primary",
                      )}
                      data-date={cell.date}
                      key={cell.date}
                      onClick={() => onDateChange(cell.date)}
                      type="button"
                    >
                      <span>{cell.day}</span>
                      {day && day.total > 0 && (
                        <span className="mt-0.5 flex gap-0.5">
                          {APPOINTMENT_STATUSES.filter(
                            (status) => day.statuses[status] > 0,
                          ).map((status) => (
                            <span
                              className={cn(
                                "size-1 rounded-full",
                                isSelected
                                  ? "bg-primary-foreground"
                                  : statusDotClass[status],
                              )}
                              key={status}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="mx-auto flex size-9 items-center justify-center text-xs text-muted-foreground/45 sm:size-10 sm:text-sm"
                      key={cell.date}
                    >
                      {cell.day}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5 xl:p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight">
                {t("doctorSchedule.daySummaryTitle")}
              </h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {formatLongDate(date, locale, timeZone)}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:size-12"
            >
              <CalendarDays className="size-5 sm:size-6" />
            </span>
          </div>

          <div className="relative mt-4 flex min-h-16 items-end gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/[0.07] to-cyan-500/[0.04] px-4 py-3">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-32"
            >
              <span className="absolute -bottom-8 right-5 size-20 rounded-full bg-primary/[0.04]" />
              <span className="absolute -bottom-3 right-3 h-16 w-7 rotate-45 rounded-full bg-primary/[0.06]" />
              <span className="absolute -bottom-5 right-12 h-16 w-7 rotate-45 rounded-full bg-primary/[0.05]" />
              <span className="absolute bottom-2 right-24 size-3 rounded-full bg-primary/[0.08]" />
            </div>
            <span className="relative shrink-0 text-5xl font-extrabold leading-none tracking-tight text-primary tabular-nums">
              {selectedDay.total}
            </span>
            <span className="relative min-w-0 pb-0.5 text-2xl font-bold leading-tight tracking-tight">
              {t("doctorSchedule.appointmentLabel", {
                count: selectedDay.total,
              })}
            </span>
          </div>

          {selectedDay.total > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {selectedStatuses.map((status) => (
                <div
                  className={cn(
                    "min-w-0 rounded-xl border px-2.5 py-3",
                    statusSummaryClass[status],
                  )}
                  key={status}
                >
                  <div className="flex min-w-0 items-center justify-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        statusDotClass[status],
                      )}
                    />
                    <p className="truncate text-[0.6875rem] font-medium leading-4 text-foreground/75">
                      {t(`statuses.${status}`)}
                    </p>
                  </div>
                  <p className="mt-2 text-center text-2xl font-bold leading-none tabular-nums">
                    {selectedDay.statuses[status]}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
              {t("month.emptyDay")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
