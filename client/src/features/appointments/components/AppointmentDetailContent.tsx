import { IconDental, IconNotes, IconUser } from "@tabler/icons-react";
import { PATHS } from "@/app/router/paths";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAppointmentTime } from "@/features/appointments/appointment-time";
import type {
  Appointment,
  AppointmentDetail,
} from "@/features/appointments/appointments.types";
import { formatMinorAmount, localeForLanguage } from "@/shared/lib/money";
import { TZDate } from "@date-fns/tz";
import {
  CalendarDays,
  Check,
  Clock3,
  Ellipsis,
  MessageSquareText,
  Pencil,
  Phone,
  Radio,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { AppointmentAction } from "./AppointmentActionDialog";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";

type Props = {
  appointment: AppointmentDetail | undefined;
  canAssign: boolean;
  isError: boolean;
  isLoading: boolean;
  onAction: (action: AppointmentAction, appointment: Appointment) => void;
  onAssign: (appointment: Appointment) => void;
  onClose: () => void;
  onEdit: (appointment: Appointment) => void;
  onRetry: () => void;
  timeZone: string;
};

function formatAppointmentDate(
  isoTimestamp: string,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(isoTimestamp));
}

function durationInMinutes(startAt: string, endAt: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000,
    ),
  );
}

function ageFromDateOfBirth(dateOfBirth: string | null, timeZone: string): number | null {
  if (!dateOfBirth) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;

  const now = TZDate.tz(timeZone);
  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  const birthdayHasPassed =
    now.getMonth() + 1 > birthMonth ||
    (now.getMonth() + 1 === birthMonth && now.getDate() >= birthDay);
  return Math.max(0, now.getFullYear() - birthYear - (birthdayHasPassed ? 0 : 1));
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function DetailField({
  children,
  icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_1fr] gap-x-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="mt-1 font-medium whitespace-pre-wrap">{children}</dd>
      </div>
    </div>
  );
}

export function AppointmentDetailContent({
  appointment,
  canAssign,
  isError,
  isLoading,
  onAction,
  onAssign,
  onClose,
  onEdit,
  onRetry,
  timeZone,
}: Props) {
  const { i18n, t } = useTranslation("appointments");
  const locale = localeForLanguage(i18n.resolvedLanguage);
  const editable =
    appointment?.status === "BOOKED" ||
    appointment?.status === "CONFIRMED" ||
    appointment?.status === "CHECKED_IN";
  const canEndAppointment =
    appointment?.status === "BOOKED" || appointment?.status === "CONFIRMED";
  const canShowMoreActions = Boolean(
    (canAssign && editable) || canEndAppointment,
  );
  const primaryAction =
    appointment?.status === "BOOKED"
      ? "confirm"
      : appointment?.status === "CONFIRMED"
        ? "checkIn"
        : null;
  const age = appointment
    ? ageFromDateOfBirth(appointment.patient.dateOfBirth, timeZone)
    : null;
  const patientMeta = appointment
    ? [
        t(`detail.genders.${appointment.patient.gender}`),
        age === null ? null : t("detail.age", { count: age }),
      ].filter(Boolean)
    : [];

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
      <header className="border-b border-border/70 bg-background px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("detail.title")}
          </h2>
          <Button
            aria-label={t("actions.close")}
            className="-mr-2 shrink-0"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {appointment ? (
            <AppointmentStatusBadge status={appointment.status} />
          ) : (
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          )}
          {appointment && (
            <div className="flex items-center gap-2">
              {editable && (
                <Button onClick={() => onEdit(appointment)} size="sm" type="button" variant="outline">
                  <Pencil aria-hidden="true" />
                  {t("actions.edit")}
                </Button>
              )}
              {canShowMoreActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={t("detail.more")}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      <Ellipsis aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canAssign && editable && (
                      <DropdownMenuItem onClick={() => onAssign(appointment)}>
                        <IconUser aria-hidden="true" size={18} stroke={2} />
                        {t("actions.assign")}
                      </DropdownMenuItem>
                    )}
                    {canAssign && editable && canEndAppointment && <DropdownMenuSeparator />}
                    {canEndAppointment && (
                      <>
                        <DropdownMenuItem onClick={() => onAction("noShow", appointment)} variant="destructive">
                          {t("actions.noShow")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAction("cancel", appointment)} variant="destructive">
                          {t("actions.cancel")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 overflow-y-auto px-5 py-5">
        {isLoading && (
          <div className="grid gap-5">
            <div className="h-20 animate-pulse rounded-xl bg-muted" />
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
            <div className="h-44 animate-pulse rounded-xl bg-muted" />
          </div>
        )}
        {isError && (
          <Alert variant="destructive">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{t("agenda.loadError")}</span>
              <Button onClick={onRetry} size="sm" type="button" variant="outline">
                {t("agenda.retry")}
              </Button>
            </div>
          </Alert>
        )}
        {appointment && (
          <div className="space-y-6 text-sm">
            <section className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initials(appointment.patient.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">
                  {appointment.patient.fullName}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {patientMeta.join(" · ")}
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone aria-hidden="true" className="size-4" strokeWidth={2} />
                  {appointment.patient.phone}
                </p>
              </div>
            </section>

            <div aria-hidden="true" className="border-t border-border/70" />

            <dl className="space-y-5">
              <DetailField
                icon={<CalendarDays aria-hidden="true" className="size-5" strokeWidth={2} />}
                label={t("detail.date")}
              >
                {formatAppointmentDate(appointment.startAt, timeZone, locale)}
              </DetailField>
              <DetailField
                icon={<Clock3 aria-hidden="true" className="size-5" strokeWidth={2} />}
                label={t("detail.time")}
              >
                <span className="tabular-nums">
                  {formatAppointmentTime(appointment.startAt, timeZone, locale)} – {formatAppointmentTime(appointment.endAt, timeZone, locale)}
                </span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {t("detail.duration", {
                    count: durationInMinutes(appointment.startAt, appointment.endAt),
                  })}
                </span>
              </DetailField>
              <DetailField
                icon={<IconUser aria-hidden="true" size={20} stroke={2} />}
                label={t("detail.dentist")}
              >
                {appointment.assignedDentist?.fullName ?? t("detail.notAssigned")}
              </DetailField>
              <DetailField
                icon={<IconDental aria-hidden="true" size={20} stroke={2} />}
                label={t("detail.service")}
              >
                {appointment.service
                  ? `${appointment.service.code} · ${appointment.service.name} · ${formatMinorAmount(appointment.service.amount, appointment.service.currency, locale)}`
                  : t("detail.notProvided")}
              </DetailField>
              <DetailField
                icon={<MessageSquareText aria-hidden="true" className="size-5" strokeWidth={2} />}
                label={t("detail.reason")}
              >
                {appointment.visitReason ?? t("detail.notProvided")}
              </DetailField>
              <DetailField
                icon={<Radio aria-hidden="true" className="size-5" strokeWidth={2} />}
                label={t("detail.source")}
              >
                {t(`sources.${appointment.source}`)}
              </DetailField>
              <DetailField
                icon={<IconNotes aria-hidden="true" size={20} stroke={2} />}
                label={t("detail.note")}
              >
                {appointment.operationalNote ?? t("detail.notProvided")}
              </DetailField>
            </dl>
          </div>
        )}
      </div>

      {appointment && (
        <footer className="space-y-2 border-t bg-muted/40 p-4">
          <Button asChild className="w-full" type="button" variant="outline">
            <Link to={PATHS.root}>{t("detail.viewProfile")}</Link>
          </Button>
          {primaryAction && (
            <Button
              className="w-full"
              onClick={() => onAction(primaryAction, appointment)}
              type="button"
            >
              <Check aria-hidden="true" />
              {t(`actions.${primaryAction}`)}
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
