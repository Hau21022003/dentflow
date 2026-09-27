export const VISIT_CLINICAL_FIELDS = [
  "symptoms",
  "relevantHistory",
  "examination",
  "diagnosis",
  "clinicalNote",
] as const;

export type VisitClinicalField = (typeof VISIT_CLINICAL_FIELDS)[number];
export type VisitStatus = "OPEN" | "COMPLETED";

export type VisitAddendum = {
  id: string;
  content: string;
  author: { id: string; fullName: string };
  createdAt: string;
};

export type Visit = {
  id: string;
  appointmentId: string;
  status: VisitStatus;
  openedByUserId: string;
  symptoms: string | null;
  relevantHistory: string | null;
  examination: string | null;
  diagnosis: string | null;
  clinicalNote: string | null;
  createdAt: string;
  updatedAt: string;
  addenda: VisitAddendum[];
};

export type UpdateVisitInput = Partial<
  Record<VisitClinicalField, string | null>
>;

export type CreateVisitAddendumInput = {
  content: string;
};
