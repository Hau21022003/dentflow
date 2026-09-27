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
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
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
        <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
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
            <CardTitle className="min-w-[8.75rem] text-xl">
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
          <Button onClick={onToday} size="sm" type="button" variant="outline">
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
                  className="h-11 animate-pulse rounded-md bg-muted"
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
                        "mx-auto flex size-10 flex-col items-center justify-center rounded-md text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                      className="mx-auto flex size-10 items-center justify-center text-sm text-muted-foreground/45"
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {t("doctorSchedule.daySummaryTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {formatLongDate(date, locale, timeZone)}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("doctorSchedule.appointmentCount", { count: selectedDay.total })}
          </p>
          {selectedDay.total > 0 ? (
            <ul className="mt-4 space-y-3">
              {APPOINTMENT_STATUSES.filter(
                (status) => selectedDay.statuses[status] > 0,
              ).map((status) => (
                <li
                  className="flex items-center justify-between text-sm"
                  key={status}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        statusDotClass[status],
                      )}
                    />
                    {t(`statuses.${status}`)}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {selectedDay.statuses[status]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("month.emptyDay")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
