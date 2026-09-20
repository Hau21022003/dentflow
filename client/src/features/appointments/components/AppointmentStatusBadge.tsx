import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/features/appointments/appointments.types";
import { useTranslation } from "react-i18next";

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useTranslation("appointments");
  const variant =
    status === "CANCELLED" || status === "NO_SHOW"
      ? "destructive"
      : status === "CONFIRMED" || status === "CHECKED_IN"
        ? "default"
        : "secondary";
  return <Badge variant={variant}>{t(`statuses.${status}`)}</Badge>;
}
