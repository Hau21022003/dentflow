import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAppointmentDetailQuery } from "@/features/appointments/appointments.hooks";
import type { Appointment } from "@/features/appointments/appointments.types";
import { useTranslation } from "react-i18next";
import type { AppointmentAction } from "./AppointmentActionDialog";
import { AppointmentDetailContent } from "./AppointmentDetailContent";

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

export function AppointmentDetailSheet({
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
  const { t } = useTranslation("appointments");
  const query = useAppointmentDetailQuery(tenantSlug, branchSlug, appointmentId);

  function closeThen(callback: () => void) {
    onOpenChange(false);
    callback();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        aria-describedby={undefined}
        className="w-full max-w-lg p-0 sm:max-w-lg"
        side="right"
      >
        <SheetTitle className="sr-only">{t("detail.title")}</SheetTitle>
        <AppointmentDetailContent
          appointment={query.data}
          canAssign={canAssign}
          isError={query.isError}
          isLoading={query.isLoading}
          onAction={(action, appointment) => closeThen(() => onAction(action, appointment))}
          onAssign={(appointment) => closeThen(() => onAssign(appointment))}
          onClose={() => onOpenChange(false)}
          onEdit={(appointment) => closeThen(() => onEdit(appointment))}
          onRetry={() => void query.refetch()}
          timeZone={timeZone}
        />
      </SheetContent>
    </Sheet>
  );
}
