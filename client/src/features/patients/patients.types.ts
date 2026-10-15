import type {
  AppointmentSource,
  AppointmentStatus,
} from "@/features/appointments/appointments.types";
import type { VisitStatus } from "@/features/visits/visits.types";

export const PATIENT_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export type PatientGender = (typeof PATIENT_GENDERS)[number];

export type PatientEmergencyContact = {
  fullName: string;
  phone: string;
  relationship: string | null;
};

export type Patient = {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: PatientGender;
  address: string | null;
  emergencyContact: PatientEmergencyContact | null;
  referralSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientSortBy =
  | "fullName"
  | "dateOfBirth"
  | "createdAt"
  | "nextAppointmentAt"
  | "lastVisitAt";

export type PatientScheduleFilter = "WITH_UPCOMING" | "WITHOUT_UPCOMING";

export type PatientAppointmentSummary = {
  startAt: string;
  serviceName: string | null;
  visitReason: string | null;
};

export type PatientLastVisitSummary = {
  completedAt: string;
};

export type PatientListItem = Patient & {
  nextAppointment: PatientAppointmentSummary | null;
  lastVisit: PatientLastVisitSummary | null;
};

export type AssignedPatientListItem = Pick<
  Patient,
  "id" | "fullName" | "phone" | "dateOfBirth" | "gender"
> & {
  nextAppointment: PatientAppointmentSummary | null;
  lastVisit: PatientLastVisitSummary | null;
};

export type SortOrder = "ASC" | "DESC";

export type PatientListQuery = {
  page: number;
  limit: number;
  search?: string;
  sortBy?: PatientSortBy;
  sortOrder?: SortOrder;
  scheduleFilter?: PatientScheduleFilter;
};

export type PatientPage<TPatient = PatientListItem> = {
  items: TPatient[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    scheduleCounts: {
      all: number;
      withUpcoming: number;
      withoutUpcoming: number;
    };
  };
};

export type PatientAppointmentListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: AppointmentStatus;
  dentistUserId?: string;
  from?: string;
  to?: string;
  sortBy?: "startAt";
  sortOrder?: SortOrder;
};

export type PatientAppointmentListItem = {
  id: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  startAt: string;
  endAt: string;
  assignedDentist: { id: string; fullName: string } | null;
  operatory: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
  service: {
    id: string;
    code: string;
    name: string;
    amount: number;
    currency: string;
    durationMinutes: number;
  } | null;
  visitReason: string | null;
  operationalNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientAppointmentPage = {
  items: PatientAppointmentListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PatientVisitListQuery = {
  page: number;
  limit: number;
  status?: VisitStatus;
  dentistUserId?: string;
  from?: string;
  to?: string;
  sortOrder?: SortOrder;
};

export type PatientVisitListItem = {
  id: string;
  appointmentId: string;
  status: VisitStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  dentist: { id: string; fullName: string };
  operatory: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
  diagnosisSummary: string | null;
};

export type PatientVisitPage = {
  items: PatientVisitListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    completed: number;
    inProgress: number;
  };
  filterOptions: {
    dentists: Array<{ id: string; fullName: string }>;
  };
};

export type CreatePatientInput = {
  fullName: string;
  phone: string;
  email?: string | null;
  gender: PatientGender;
  dateOfBirth?: string | null;
  address?: string | null;
  emergencyContact?: PatientEmergencyContact | null;
  referralSource?: string | null;
};

export type UpdatePatientInput = Partial<CreatePatientInput>;

export type PatientAlert = {
  id: string;
  category: "ALLERGY" | "MEDICAL_CONDITION" | "MEDICATION" | "OTHER";
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientAlertInput = Pick<
  PatientAlert,
  "category" | "severity" | "message"
>;
export type ResolvePatientAlertReasonCode =
  | "NO_LONGER_APPLICABLE"
  | "ENTERED_IN_ERROR"
  | "DUPLICATE";

export type PatientOverview = {
  patient: Patient;
  activityStatus: "ACTIVE" | "INACTIVE";
  activeAlerts: PatientAlert[];
  nextAppointment: {
    id: string;
    status: AppointmentStatus;
    startAt: string;
    endAt: string;
    serviceName: string | null;
    visitReason: string | null;
    assignedDentist: { id: string; fullName: string } | null;
    operatory: { id: string; code: string; name: string } | null;
  } | null;
  treatmentSummary: {
    activePlanCount: number;
    totalItems: number;
    completedItems: number;
    pendingItems: number;
    featuredPlan: {
      id: string;
      code: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      serviceName: string | null;
      totalItems: number;
      completedItems: number;
      pendingItems: number;
    } | null;
  };
};

export type PatientTreatmentPlan = {
  id: string;
  code: string;
  patientId: string;
  originVisitId: string;
  status: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    service: { id: string; code: string; name: string };
    listUnitAmount: number;
    finalUnitAmount: number;
    discountAmount: number;
    currency: string;
    quantity: number;
    toothPosition: string | null;
    indication: string | null;
    status: string;
    plannedDentist: { id: string; fullName: string } | null;
  }>;
};
