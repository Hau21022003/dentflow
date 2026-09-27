import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  monthForDate,
  todayInTimeZone,
} from "@/features/appointments/appointment-time";
import { useAppointmentCalendarSummaryQuery } from "@/features/appointments/appointments.hooks";
import {
  APPOINTMENT_STATUSES,
  type AppointmentCalendarSummary,
  type AppointmentStatus,
} from "@/features/appointments/appointments.types";
import { cn } from "@/shared/lib/utils";
import { TZDate } from "@date-fns/tz";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type CalendarCell = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
};

type Props = {
  branchSlug: string;
  date: string;
  locale: string;
  onDateChange: (date: string) => void;
  onViewTimeline: (date: string) => void;
  tenantSlug: string;
  timeZone: string;
};

const statusDotClass: Record<AppointmentStatus, string> = {
  BOOKED: "bg-blue-500",
  CONFIRMED: "bg-cyan-500",
  CHECKED_IN: "bg-emerald-500",
  IN_PROGRESS: "bg-violet-500",
  COMPLETED: "bg-teal-600",
  CANCELLED: "bg-red-500",
  NO_SHOW: "bg-orange-500",
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
    const cellYear = calendarDate.getUTCFullYear();
    const cellMonth = calendarDate.getUTCMonth() + 1;
    return {
      date: formatDate(cellYear, cellMonth, calendarDate.getUTCDate()),
      day: calendarDate.getUTCDate(),
      isCurrentMonth: cellMonth === monthNumber,
    };
  });
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

function emptyStatuses(): Record<AppointmentStatus, number> {
  return Object.fromEntries(
    APPOINTMENT_STATUSES.map((status) => [status, 0]),
  ) as Record<AppointmentStatus, number>;
}

function formatCompactCount(count: number): string {
  return count > 9 ? "9+" : String(count);
}

function summaryByDate(summary: AppointmentCalendarSummary | undefined) {
  return new Map(summary?.days.map((day) => [day.date, day]) ?? []);
}

export function AppointmentMonthView({
  branchSlug,
  date,
  locale,
  onDateChange,
  onViewTimeline,
  tenantSlug,
  timeZone,
}: Props) {
  const { t } = useTranslation("appointments");
  const month = monthForDate(date);
  const summaryQuery = useAppointmentCalendarSummaryQuery(
    tenantSlug,
    branchSlug,
    month,
  );
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const days = useMemo(
    () => summaryByDate(summaryQuery.data),
    [summaryQuery.data],
  );
  const selectedDay = days.get(date) ?? {
    date,
    total: 0,
    statuses: emptyStatuses(),
  };
  const today = todayInTimeZone(timeZone);
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(
          new TZDate(2024, 0, index + 1, 12, timeZone),
        ),
      ),
    [locale, timeZone],
  );

  if (summaryQuery.isLoading) {
    return (
      <div className="grid gap-4 p-3 sm:p-6 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border">
          {Array.from({ length: 35 }, (_, index) => (
            <div
              className="min-h-20 animate-pulse border-r border-b bg-muted/50 sm:min-h-28"
              key={index}
            />
          ))}
        </div>
        <div className="min-h-56 animate-pulse rounded-xl bg-muted/50" />
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("month.loadError")}</span>
            <Button
              onClick={() => void summaryQuery.refetch()}
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
    <div className="p-3 sm:p-6">
      <div className="overflow-hidden rounded-xl border xl:grid xl:grid-cols-[minmax(0,1fr)_15rem]">
        <section aria-label={t("month.calendarLabel")}>
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {weekdays.map((weekday) => (
              <div
                className="px-1 py-2 text-center text-[11px] font-semibold text-muted-foreground sm:px-2 sm:py-3 sm:text-xs"
                key={weekday}
              >
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const day = days.get(cell.date);
              const isSelected = cell.date === date;
              const isToday = cell.date === today;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-1 sm:gap-2">
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-md text-sm font-semibold",
                        isSelected && "bg-primary text-primary-foreground",
                        !isSelected && isToday && "bg-muted text-foreground",
                      )}
                    >
                      {cell.day}
                    </span>
                    {day && day.total > 0 && (
                      <span className="hidden min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground min-[430px]:inline-flex sm:hidden">
                        {formatCompactCount(day.total)}
                      </span>
                    )}
                    {day && day.total > 0 && (
                      <span className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground sm:inline 2xl:hidden">
                        {t("month.countCompact", { count: day.total })}
                      </span>
                    )}
                    {day && day.total > 0 && (
                      <span className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground 2xl:inline">
                        {t("month.count", { count: day.total })}
                      </span>
                    )}
                  </div>
                  {day && day.total > 0 && (
                    <div className="mt-auto flex items-center gap-1 pt-2 sm:pt-3">
                      {APPOINTMENT_STATUSES.filter(
                        (status) => day.statuses[status] > 0,
                      ).map((status) => (
                        <span
                          aria-label={t("month.statusCount", {
                            count: day.statuses[status],
                            status: t(`statuses.${status}`),
                          })}
                          className={cn(
                            "size-1.5 rounded-full sm:size-2",
                            statusDotClass[status],
                          )}
                          key={status}
                          role="img"
                        />
                      ))}
                    </div>
                  )}
                </>
              );

              if (!cell.isCurrentMonth) {
                return (
                  <div
                    aria-hidden="true"
                    className="flex min-h-20 flex-col border-r border-b p-1.5 text-muted-foreground/45 sm:min-h-28 sm:p-2"
                    key={cell.date}
                  >
                    <span className="inline-flex size-7 items-center justify-center text-sm">
                      {cell.day}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={t("month.selectDay", {
                    count: day?.total ?? 0,
                    date: formatLongDate(cell.date, locale, timeZone),
                  })}
                  className={cn(
                    "flex min-h-20 flex-col border-r border-b p-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-28 sm:p-2",
                    isSelected && "bg-primary/5",
                  )}
                  data-date={cell.date}
                  key={cell.date}
                  onClick={() => onDateChange(cell.date)}
                  type="button"
                >
                  {content}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="border-t bg-muted/20 p-5 xl:border-t-0 xl:border-l">
          <p className="text-sm font-semibold">
            {formatLongDate(date, locale, timeZone)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("month.count", { count: selectedDay.total })}
          </p>

          {selectedDay.total > 0 ? (
            <ul className="mt-5 space-y-2">
              {APPOINTMENT_STATUSES.filter(
                (status) => selectedDay.statuses[status] > 0,
              ).map((status) => (
                <li
                  className="flex items-center justify-between gap-3 text-sm"
                  key={status}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
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
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              {t("month.emptyDay")}
            </p>
          )}

          <Button
            className="mt-6 w-full"
            onClick={() => onViewTimeline(date)}
            type="button"
            variant="outline"
          >
            <CalendarDays aria-hidden="true" />
            {t("month.viewDay")}
          </Button>
        </aside>
      </div>
    </div>
  );
}
