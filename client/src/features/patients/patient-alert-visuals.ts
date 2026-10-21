import type { PatientAlert } from "@/features/patients/patients.types";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconClipboardText,
  IconHeartbeat,
  IconInfoCircle,
  IconPillOff,
  IconPills,
} from "@tabler/icons-react";

type AlertCategory = PatientAlert["category"];
type AlertSeverity = PatientAlert["severity"];

export const PATIENT_ALERT_CATEGORY_VISUALS = {
  ALLERGY: {
    Icon: IconPillOff,
    className: "border-red-200 bg-red-50 text-red-700",
  },
  MEDICAL_CONDITION: {
    Icon: IconHeartbeat,
    className: "border-teal-200 bg-teal-50 text-teal-700",
  },
  MEDICATION: {
    Icon: IconPills,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  OTHER: {
    Icon: IconClipboardText,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
} satisfies Record<
  AlertCategory,
  { Icon: typeof IconPillOff; className: string }
>;

export const PATIENT_ALERT_SEVERITY_VISUALS = {
  CRITICAL: {
    Icon: IconAlertCircle,
    className: "border-red-200 bg-red-100 text-red-700",
  },
  WARNING: {
    Icon: IconAlertTriangle,
    className: "border-amber-200 bg-amber-100 text-amber-700",
  },
  INFO: {
    Icon: IconInfoCircle,
    className: "border-blue-200 bg-blue-100 text-blue-700",
  },
} satisfies Record<
  AlertSeverity,
  { Icon: typeof IconAlertCircle; className: string }
>;
