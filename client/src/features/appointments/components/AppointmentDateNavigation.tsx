import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addDaysInTimeZone,
  addMonthsInTimeZone,
  monthForDate,
  todayInTimeZone,
} from "@/features/appointments/appointment-time";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export type AppointmentView = "list" | "timeline" | "month";

type Props = {
  date: string;
  locale: string;
  onDateChange: (date: string) => void;
  onViewChange: (view: AppointmentView) => void;
  timeZone: string;
  view: AppointmentView;
};

function dateForCalendar(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateFromCalendar(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNavigationDate(date: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone,
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function AppointmentDateNavigation({
  date,
  locale,
  onDateChange,
  onViewChange,
  timeZone,
  view,
}: Props) {
  const { t } = useTranslation("appointments");
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMonth = view === "month";
  const title = isMonth
    ? new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone,
      }).format(new Date(`${monthForDate(date)}-01T12:00:00Z`))
    : formatNavigationDate(date, timeZone, locale);

  function shift(amount: number) {
    onDateChange(
      isMonth
        ? addMonthsInTimeZone(date, amount, timeZone)
        : addDaysInTimeZone(date, amount, timeZone),
    );
  }

  return (
    <div className="flex flex-col gap-4 border-b border-border/70 px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label={t("navigation.previous")}
          className="size-10 p-0"
          onClick={() => shift(-1)}
          size="default"
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              className="h-10 max-w-full min-w-52 justify-start px-3 sm:min-w-64"
              type="button"
              variant="outline"
            >
              <CalendarDays aria-hidden="true" />
              <span className="truncate">{title}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              onSelect={(selected) => {
                if (!selected) return;
                onDateChange(dateFromCalendar(selected));
                setPickerOpen(false);
              }}
              selected={dateForCalendar(date)}
            />
          </PopoverContent>
        </Popover>
        <Button
          aria-label={t("navigation.next")}
          className="size-10 p-0"
          onClick={() => shift(1)}
          size="default"
          type="button"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button
          onClick={() => onDateChange(todayInTimeZone(timeZone))}
          type="button"
          variant="outline"
        >
          {t("navigation.today")}
        </Button>
      </div>

      <div
        aria-label={t("navigation.viewLabel")}
        className="flex w-full overflow-hidden rounded-lg border bg-background [&>[data-slot=button]+[data-slot=button]]:border-l [&>[data-slot=button]+[data-slot=button]]:border-border xl:w-auto"
        role="group"
      >
        {(
          [
            ["list", List, "views.list"],
            ["timeline", Clock3, "views.timeline"],
            ["month", CalendarDays, "views.month"],
          ] as const
        ).map(([value, Icon, labelKey]) => (
          <Button
            aria-pressed={view === value}
            className="h-10 min-w-0 flex-1 rounded-none border-0 px-3 shadow-none first:rounded-l-md last:rounded-r-md xl:min-w-24"
            key={value}
            onClick={() => onViewChange(value)}
            size="default"
            type="button"
            variant={view === value ? "secondary" : "ghost"}
          >
            <Icon aria-hidden="true" />
            {t(labelKey)}
          </Button>
        ))}
      </div>
    </div>
  );
}
