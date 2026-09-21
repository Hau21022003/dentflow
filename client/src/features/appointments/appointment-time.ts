import { TZDate } from "@date-fns/tz";

function parseDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Expected YYYY-MM-DD date.");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayInTimeZone(timeZone: string): string {
  const date = TZDate.tz(timeZone);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDaysInTimeZone(dateInput: string, days: number, timeZone: string): string {
  const [year, month, day] = parseDate(dateInput);
  const date = new TZDate(year, month - 1, day + days, timeZone);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthForDate(dateInput: string): string {
  const [year, month] = parseDate(dateInput);
  return `${year}-${pad(month)}`;
}

export function startOfMonthInTimeZone(dateInput: string, timeZone: string): string {
  const [year, month] = parseDate(dateInput);
  const date = new TZDate(year, month - 1, 1, timeZone);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function addMonthsInTimeZone(
  dateInput: string,
  months: number,
  timeZone: string,
): string {
  const [year, month, day] = parseDate(dateInput);
  const target = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(target / 12);
  const targetMonth = (target % 12) + 1;
  const lastDay = new TZDate(targetYear, targetMonth, 0, timeZone).getDate();
  const date = new TZDate(targetYear, targetMonth - 1, Math.min(day, lastDay), timeZone);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function agendaRange(dateInput: string, timeZone: string): { from: string; to: string } {
  const [year, month, day] = parseDate(dateInput);
  const from = new TZDate(year, month - 1, day, 0, 0, 0, timeZone);
  const to = new TZDate(year, month - 1, day + 1, 0, 0, 0, timeZone);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function toDateTimeLocal(isoTimestamp: string, timeZone: string): string {
  const date = new TZDate(isoTimestamp, timeZone);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new TZDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    timeZone,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatAppointmentTime(
  isoTimestamp: string,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

/**
 * Returns the position within the operational day in the branch time zone.
 * This deliberately does not use the browser's local time zone.
 */
export function minutesSinceStartOfDay(isoTimestamp: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const value = (type: "hour" | "minute") =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return value("hour") * 60 + value("minute");
}

export function dateInTimeZone(isoTimestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoTimestamp));
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "01";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function formatAppointmentDate(
  dateInput: string,
  timeZone: string,
  locale: string,
): string {
  const { from } = agendaRange(dateInput, timeZone);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(from));
}
