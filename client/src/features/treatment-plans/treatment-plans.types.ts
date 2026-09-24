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
] as const;

export type TreatmentPlanStatus = (typeof TREATMENT_PLAN_STATUSES)[number];
export type TreatmentItemStatus = (typeof TREATMENT_ITEM_STATUSES)[number];
export type TreatmentItemEventType = (typeof TREATMENT_ITEM_EVENT_TYPES)[number];

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

export type TreatmentPlanPage = {
  items: TreatmentPlan[];
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

export type TreatmentItemEvent = {
  id: string;
  visitId: string;
  performedByUserId: string;
  eventType: TreatmentItemEventType;
  createdAt: string;
};

export type TreatmentItemEventPage = {
  items: TreatmentItemEvent[];
  nextCursor: string | null;
};

export type RecordTreatmentItemEventResponse = TreatmentItemEvent & {
  itemStatus: TreatmentItemStatus;
  planStatus: TreatmentPlanStatus;
};

export type TreatmentPlanAcceptanceReceipt = {
  id: string;
  status: "ACCEPTED";
  acceptedByUserId: string;
  acceptedAt: string;
};
