import { TZDate } from "@date-fns/tz";

function parseDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Expected YYYY-MM-DD date.");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
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
