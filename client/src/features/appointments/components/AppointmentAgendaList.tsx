import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatAppointmentTime } from "@/features/appointments/appointment-time";
import type { Appointment, AssignedAppointment } from "@/features/appointments/appointments.types";
import { CalendarDays, ChevronRight, Stethoscope } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";

type AppointmentAgendaListProps = {
  emptyDescription?: string;
  appointments: Array<Appointment | AssignedAppointment>;
  isLoading: boolean;
  locale: string;
  onView?: (appointment: Appointment) => void;
  timeZone: string;
};

function isManagementAppointment(appointment: Appointment | AssignedAppointment): appointment is Appointment {
  return "assignedDentist" in appointment;
}

export function AppointmentAgendaList({
  emptyDescription,
  appointments,
  isLoading,
  locale,
  onView,
  timeZone,
}: AppointmentAgendaListProps) {
  const { t } = useTranslation("appointments");
  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3].map((index) => <div className="h-24 w-full animate-pulse rounded-2xl bg-muted" key={index} />)}
      </div>
    );
  }
  if (appointments.length === 0) {
    return (
      <Empty className="border border-dashed py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CalendarDays aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>{t("agenda.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{emptyDescription ?? t("agenda.emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="grid gap-3">
      {appointments.map((appointment) => {
        const management = isManagementAppointment(appointment);
        return (
          <Card key={appointment.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="grid min-w-20 gap-0.5 border-r pr-4 text-sm font-semibold tabular-nums">
                <span>{formatAppointmentTime(appointment.startAt, timeZone, locale)}</span>
                <span className="text-muted-foreground">{formatAppointmentTime(appointment.endAt, timeZone, locale)}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{appointment.patient.fullName}</p>
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {appointment.service ? `${appointment.service.code} · ${appointment.service.name}` : management ? appointment.visitReason : t("detail.notProvided")}
                </p>
                {management && (
                  <p className="truncate text-xs text-muted-foreground">
                    <Stethoscope aria-hidden="true" className="mr-1 inline size-3" />
                    {appointment.assignedDentist?.fullName ?? t("detail.notAssigned")}
                  </p>
                )}
              </div>
              {management && onView && (
                <Button aria-label={t("actions.view")} onClick={() => onView(appointment)} size="icon-sm" type="button" variant="ghost">
                  <ChevronRight aria-hidden="true" />
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
