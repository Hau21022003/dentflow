import { Badge } from "@/components/ui/badge";
import type { TreatmentPlanStatus } from "@/features/treatment-plans/treatment-plans.types";
import {
  CheckCircle2,
  Circle,
  CircleCheck,
  CircleDashed,
  Clock3,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const statusStyles: Record<TreatmentPlanStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  PROPOSED: "border-blue-200 bg-blue-100 text-blue-800",
  ACCEPTED: "border-emerald-200 bg-emerald-100 text-emerald-800",
  PARTIALLY_COMPLETED: "border-orange-200 bg-orange-100 text-orange-800",
  COMPLETED: "border-slate-200 bg-slate-200 text-slate-800",
  CANCELLED: "border-red-200 bg-red-100 text-red-800",
};

const statusIcons = {
  DRAFT: CircleDashed,
  PROPOSED: Circle,
  ACCEPTED: CircleCheck,
  PARTIALLY_COMPLETED: Clock3,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
} satisfies Record<TreatmentPlanStatus, typeof Circle>;

export function PatientTreatmentPlanStatusBadge({
  status,
}: {
  status: TreatmentPlanStatus;
}) {
  const { t } = useTranslation("patients");
  const Icon = statusIcons[status];

  return (
    <Badge className={statusStyles[status]} variant="outline">
      <Icon aria-hidden="true" />
      {t(`detail.planStatuses.${status}`)}
    </Badge>
  );
}
