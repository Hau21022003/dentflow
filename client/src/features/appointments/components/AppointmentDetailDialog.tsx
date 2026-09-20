import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAppointmentTime } from "@/features/appointments/appointment-time";
import { useAppointmentDetailQuery } from "@/features/appointments/appointments.hooks";
import type { Appointment } from "@/features/appointments/appointments.types";
import { formatMinorAmount, localeForLanguage } from "@/shared/lib/money";
import {
  BriefcaseMedical,
  CalendarDays,
  Check,
  Clock3,
  Ellipsis,
  MapPin,
  MessageSquareText,
  Pencil,
  Stethoscope,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { AppointmentAction } from "./AppointmentActionDialog";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";

type Props = {
  appointmentId: string | null;
  branchSlug: string;
  canAssign: boolean;
  onAction: (action: AppointmentAction, appointment: Appointment) => void;
  onAssign: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantSlug: string;
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

export function AppointmentDetailDialog({
  appointmentId,
  branchSlug,
  canAssign,
  onAction,
  onAssign,
  onEdit,
  onOpenChange,
  open,
  tenantSlug,
  timeZone,
}: Props) {
  const { i18n, t } = useTranslation("appointments");
  const query = useAppointmentDetailQuery(
    tenantSlug,
    branchSlug,
    appointmentId,
  );
  const appointment = query.data;
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

  function closeThen(callback: () => void) {
    onOpenChange(false);
    callback();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="gap-3 px-5 pt-5">
          {appointment && (
            <AppointmentStatusBadge status={appointment.status} />
          )}
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t("detail.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-5">
          {query.isLoading && (
            <div className="grid gap-3">
              <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-36 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          )}
          {query.isError && (
            <Alert variant="destructive">{t("agenda.loadError")}</Alert>
          )}
          {appointment && (
            <div className="space-y-6 text-sm">
              <section className="rounded-xl bg-muted/70 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <CalendarDays
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  {formatAppointmentDate(appointment.startAt, timeZone, locale)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Clock3
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <span className="text-lg font-semibold text-primary">
                    {formatAppointmentTime(
                      appointment.startAt,
                      timeZone,
                      locale,
                    )}{" "}
                    –{" "}
                    {formatAppointmentTime(appointment.endAt, timeZone, locale)}
                  </span>
                  <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border/70">
                    {t("detail.duration", {
                      count: durationInMinutes(
                        appointment.startAt,
                        appointment.endAt,
                      ),
                    })}
                  </span>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("detail.patient")}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-semibold">
                    {appointment.patient.fullName}
                  </p>
                  <Button asChild size="sm" type="button" variant="outline">
                    <Link to="/">{t("detail.viewProfile")}</Link>
                  </Button>
                </div>
              </section>

              <div aria-hidden="true" className="border-t border-border/70" />

              <dl className="space-y-4">
                <div className="grid grid-cols-[1.25rem_1fr] gap-x-3">
                  <Stethoscope
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-muted-foreground"
                  />
                  <div>
                    <dt className="text-muted-foreground">
                      {t("detail.dentist")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {appointment.assignedDentist?.fullName ??
                        t("detail.notAssigned")}
                    </dd>
                  </div>
                </div>
                <div className="grid grid-cols-[1.25rem_1fr] gap-x-3">
                  <BriefcaseMedical
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-muted-foreground"
                  />
                  <div>
                    <dt className="text-muted-foreground">
                      {t("detail.service")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {appointment.service
                        ? `${appointment.service.code} · ${appointment.service.name} · ${formatMinorAmount(appointment.service.amount, appointment.service.currency, locale)}`
                        : t("detail.notProvided")}
                    </dd>
                  </div>
                </div>
                <div className="grid grid-cols-[1.25rem_1fr] gap-x-3">
                  <MessageSquareText
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-muted-foreground"
                  />
                  <div>
                    <dt className="text-muted-foreground">
                      {t("detail.reason")}
                    </dt>
                    <dd className="mt-1 font-medium whitespace-pre-wrap">
                      {appointment.visitReason ?? t("detail.notProvided")}
                    </dd>
                  </div>
                </div>
                <div className="grid grid-cols-[1.25rem_1fr] gap-x-3">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-muted-foreground"
                  />
                  <div>
                    <dt className="text-muted-foreground">
                      {t("detail.source")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {t(`sources.${appointment.source}`)}
                    </dd>
                  </div>
                </div>
              </dl>

              <section className="rounded-xl bg-muted/70 p-4">
                <p className="text-sm font-medium">{t("detail.note")}</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {appointment.operationalNote ?? t("detail.notProvided")}
                </p>
              </section>
            </div>
          )}
        </div>

        {appointment && (editable || canShowMoreActions || primaryAction) && (
          <div className="flex flex-col gap-2 border-t bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-2 flex flex-wrap gap-2 sm:order-1">
              {editable && (
                <Button
                  onClick={() => closeThen(() => onEdit(appointment))}
                  type="button"
                  variant="outline"
                >
                  <Pencil aria-hidden="true" />
                  {t("actions.edit")}
                </Button>
              )}
              {canShowMoreActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline">
                      <Ellipsis aria-hidden="true" />
                      {t("detail.more")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {canAssign && editable && (
                      <DropdownMenuItem
                        onClick={() => closeThen(() => onAssign(appointment))}
                      >
                        <Stethoscope aria-hidden="true" />
                        {t("actions.assign")}
                      </DropdownMenuItem>
                    )}
                    {canAssign && editable && canEndAppointment && (
                      <DropdownMenuSeparator />
                    )}
                    {canEndAppointment && (
                      <>
                        <DropdownMenuItem
                          onClick={() =>
                            closeThen(() => onAction("noShow", appointment))
                          }
                          variant="destructive"
                        >
                          {t("actions.noShow")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            closeThen(() => onAction("cancel", appointment))
                          }
                          variant="destructive"
                        >
                          {t("actions.cancel")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {primaryAction && (
              <Button
                className="order-1 w-full sm:order-2 sm:w-auto"
                onClick={() =>
                  closeThen(() => onAction(primaryAction, appointment))
                }
                type="button"
              >
                <Check aria-hidden="true" />
                {t(`actions.${primaryAction}`)}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
