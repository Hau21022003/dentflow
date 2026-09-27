export type TreatmentPlanAcceptanceQueueItem = {
  id: string;
  patient: { fullName: string; phone: string };
  status: "PROPOSED";
  createdAt: string;
  updatedAt: string;
};

export type TreatmentPlanAcceptancePage = {
  items: TreatmentPlanAcceptanceQueueItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type TreatmentPlanAcceptanceReceipt = {
  id: string;
  status: "ACCEPTED";
  acceptedByUserId: string;
  acceptedAt: string;
};
