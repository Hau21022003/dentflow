export const PATIENT_FILE_CATEGORIES = [
  "CLINICAL_PHOTO",
  "XRAY",
  "DOCUMENT",
  "FORM",
  "OTHER",
] as const;

export type PatientFileCategory = (typeof PATIENT_FILE_CATEGORIES)[number];

export interface PatientFile {
  id: string;
  sourceVisitId: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  category: PatientFileCategory;
  note: string | null;
  fileDate: string;
  previewUrl: string | null;
  createdBy: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface PatientFileListQuery {
  page?: number;
  limit?: number;
  q?: string;
  category?: PatientFileCategory;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "fileDate" | "createdAt";
  sortOrder?: "ASC" | "DESC";
}

export interface PatientFilePage {
  items: PatientFile[];
  meta: {
    page: number;
    limit: number;
    total: number;
    categoryCounts: Record<PatientFileCategory, number>;
  };
}

export interface CreatePatientFileInput {
  objectKey: string;
  originalFileName: string;
  category: PatientFileCategory;
  note?: string | null;
  fileDate: string;
}

export type UpdatePatientFileInput = Partial<
  Pick<CreatePatientFileInput, "category" | "note" | "fileDate">
>;

export interface PatientFileAccess {
  url: string;
  expiresAt: string;
}
