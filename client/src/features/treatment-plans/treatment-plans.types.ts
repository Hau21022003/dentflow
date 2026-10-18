export const TREATMENT_PLAN_STATUSES = [
  "DRAFT",
  "PROPOSED",
  "ACCEPTED",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const TREATMENT_ITEM_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const TREATMENT_ITEM_EVENT_TYPES = [
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "PROGRESS_NOTE",
] as const;

export const TREATMENT_ITEM_STATE_EVENT_TYPES = [
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const TREATMENT_PLAN_CANCELLATION_REASON_CODES = [
  "PATIENT_REQUEST",
  "ENTERED_IN_ERROR",
  "DUPLICATE",
  "NO_LONGER_APPLICABLE",
  "TRANSFER_OF_CARE",
  "OTHER",
] as const;

export const TREATMENT_ITEM_CANCELLATION_REASON_CODES = [
  "PATIENT_REQUEST",
  "ENTERED_IN_ERROR",
  "NO_LONGER_APPLICABLE",
  "DUPLICATE",
  "OTHER",
] as const;

export type TreatmentPlanStatus = (typeof TREATMENT_PLAN_STATUSES)[number];
export type TreatmentItemStatus = (typeof TREATMENT_ITEM_STATUSES)[number];
export type TreatmentItemEventType =
  (typeof TREATMENT_ITEM_EVENT_TYPES)[number];
export type TreatmentItemStateEventType =
  (typeof TREATMENT_ITEM_STATE_EVENT_TYPES)[number];
export type TreatmentPlanCancellationReasonCode =
  (typeof TREATMENT_PLAN_CANCELLATION_REASON_CODES)[number];
export type TreatmentItemCancellationReasonCode =
  (typeof TREATMENT_ITEM_CANCELLATION_REASON_CODES)[number];

export type TreatmentPlanItem = {
  id: string;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  listUnitAmount: number;
  currency: string;
  quantity: number;
  discountAmount: number;
  finalUnitAmount: number;
  toothPosition: string | null;
  indication: string | null;
  plannedDentistUserId: string;
  status: TreatmentItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type TreatmentPlan = {
  id: string;
  code: string;
  originVisitId: string;
  patientId: string;
  status: TreatmentPlanStatus;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  items: TreatmentPlanItem[];
};

export type TreatmentPlanListItem = TreatmentPlan & {
  plannedDentists: Array<{ id: string; fullName: string }>;
};

export type TreatmentPlanListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: TreatmentPlanStatus;
};

export type TreatmentPlanPage = {
  items: TreatmentPlanListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type SyncTreatmentPlanItemInput = {
  id?: string;
  serviceId: string;
  quantity: number;
  discountAmount: number;
  plannedDentistUserId: string;
  toothPosition?: string | null;
  indication?: string | null;
};

export type SyncTreatmentPlanInput = { items: SyncTreatmentPlanItemInput[] };
export type TreatmentReasonInput = { reasonCode: string };
export type CancelTreatmentPlanInput = {
  reasonCode: TreatmentPlanCancellationReasonCode;
  note?: string;
};
export type CancelTreatmentItemInput = {
  reasonCode: TreatmentItemCancellationReasonCode;
  note?: string;
};
export type RecordTreatmentItemEventInput = {
  eventType: TreatmentItemStateEventType;
  reasonCode?: string;
  note?: string;
};

export type TreatmentItemEvent = {
  id: string;
  visitId: string;
  performedByUserId: string;
  performedBy: { id: string; fullName: string };
  eventType: TreatmentItemEventType;
  content: string | null;
  reasonCode: string | null;
  note: string | null;
  images: Array<{
    id: string;
    contentType: string;
    sizeBytes: number;
    url: string | null;
  }>;
  createdAt: string;
};

export type TreatmentItemEventPage = {
  items: TreatmentItemEvent[];
  nextCursor: string | null;
};

export type RecordTreatmentItemEventResponse = {
  id: string;
  visitId: string;
  performedByUserId: string;
  eventType: TreatmentItemStateEventType;
  createdAt: string;
  itemStatus: TreatmentItemStatus;
  planStatus: TreatmentPlanStatus;
};

export type CreateTreatmentProgressNoteInput = {
  content: string;
  imageObjectKeys: string[];
};
