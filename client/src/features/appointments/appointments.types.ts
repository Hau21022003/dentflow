export const APPOINTMENT_STATUSES = [
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const APPOINTMENT_SOURCES = ["PHONE", "WALK_IN", "ONLINE", "OTHER"] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];
export type RescheduleReasonCode = "PATIENT_REQUEST" | "CLINIC_RESCHEDULE";
export type CancellationReasonCode =
  | "PATIENT_CANCELLED"
  | "CLINIC_CANCELLED"
  | "DUPLICATE_BOOKING";
export type NoShowReasonCode = "PATIENT_NO_SHOW";

export type Appointment = {
  id: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  startAt: string;
  endAt: string;
  patient: { id: string; fullName: string; phone: string };
  assignedDentist: { id: string; fullName: string } | null;
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

export type PatientGender = "MALE" | "FEMALE" | "OTHER";

export type AppointmentDetail = Omit<Appointment, "patient"> & {
  patient: Appointment["patient"] & {
    gender: PatientGender;
    dateOfBirth: string | null;
  };
};

export type AssignedAppointment = {
  id: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  patient: {
    id: string;
    fullName: string;
    gender: PatientGender;
    dateOfBirth: string | null;
  };
  service: { id: string; code: string; name: string } | null;
  visitReason: string | null;
};

export type AppointmentDentistOption = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

export type AppointmentServiceOption = {
  id: string;
  code: string;
  name: string;
  amount: number;
  currency: string;
  durationMinutes: number;
};

export type AppointmentPage<TAppointment = Appointment> = {
  items: TAppointment[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type AppointmentListQuery = {
  from: string;
  to: string;
  page: number;
  limit: number;
  search?: string;
  status?: AppointmentStatus;
  patientId?: string;
  dentistUserId?: string;
};

export type AppointmentAgendaQuery = Omit<
  AppointmentListQuery,
  "page" | "limit"
>;

export type AppointmentCalendarSummary = {
  month: string;
  timeZone: string;
  days: Array<{
    date: string;
    total: number;
    statuses: Record<AppointmentStatus, number>;
  }>;
};

export type BookingOptionQuery = {
  page: number;
  limit: number;
  search?: string;
};

export type CreateAppointmentInput = {
  patientId: string;
  source: AppointmentSource;
  startAt: string;
  endAt: string;
  serviceId?: string | null;
  assignedDentistUserId?: string | null;
  visitReason?: string | null;
  operationalNote?: string | null;
};

export type UpdateAppointmentInput = Partial<
  Omit<CreateAppointmentInput, "patientId" | "assignedDentistUserId">
> & {
  reasonCode?: RescheduleReasonCode;
};
