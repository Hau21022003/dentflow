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
  onClose: () => void;
  onEdit: (appointment: Appointment) => void;
  tenantSlug: string;
  timeZone: string;
};

export function AppointmentDetailPanel({
  appointmentId,
  branchSlug,
  canAssign,
  onAction,
  onAssign,
  onClose,
  onEdit,
  tenantSlug,
  timeZone,
}: Props) {
  const { t } = useTranslation("appointments");
  const query = useAppointmentDetailQuery(tenantSlug, branchSlug, appointmentId);

  return (
    <aside aria-label={t("timeline.detailPanelLabel")} className="flex min-h-0 flex-col border-l bg-background">
      <AppointmentDetailContent
        appointment={query.data}
        canAssign={canAssign}
        isError={query.isError}
        isLoading={query.isLoading}
        onAction={onAction}
        onAssign={onAssign}
        onClose={onClose}
        onEdit={onEdit}
        onRetry={() => void query.refetch()}
        timeZone={timeZone}
      />
    </aside>
  );
}
