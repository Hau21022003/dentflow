export const PATIENT_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export type PatientGender = (typeof PATIENT_GENDERS)[number];

export type PatientEmergencyContact = {
  fullName: string;
  phone: string;
  relationship: string | null;
};

export type Patient = {
  id: string;
  fullName: string;
  phone: string;
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

export type CreatePatientInput = {
  fullName: string;
  phone: string;
  gender: PatientGender;
  dateOfBirth?: string | null;
  address?: string | null;
  emergencyContact?: PatientEmergencyContact | null;
  referralSource?: string | null;
};

export type UpdatePatientInput = Partial<CreatePatientInput>;
