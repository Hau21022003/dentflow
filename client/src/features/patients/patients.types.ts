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

export type PatientSortBy = "fullName" | "dateOfBirth" | "createdAt";

export type SortOrder = "ASC" | "DESC";

export type PatientListQuery = {
  page: number;
  limit: number;
  search?: string;
  sortBy?: PatientSortBy;
  sortOrder?: SortOrder;
};

export type PatientPage = {
  items: Patient[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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
