import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  TreatmentPlanAcceptancePage,
  TreatmentPlanAcceptanceReceipt,
} from "./treatment-plan-acceptances.types";

export type TreatmentPlanAcceptanceScope = {
  tenantSlug: string;
  branchSlug: string;
};

function queueRoute({ tenantSlug, branchSlug }: TreatmentPlanAcceptanceScope) {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/treatment-plan-acceptances`;
}

export const treatmentPlanAcceptancesService = {
  async list(
    scope: TreatmentPlanAcceptanceScope,
    page = 1,
    limit = 10,
  ): Promise<TreatmentPlanAcceptancePage> {
    const { payload } = await http.get<TreatmentPlanAcceptancePage>(queueRoute(scope), {
      params: { page, limit },
    });
    return payload;
  },
  async accept(
    command: TreatmentPlanAcceptanceScope & IdempotentCommand & { planId: string },
  ): Promise<TreatmentPlanAcceptanceReceipt> {
    const { tenantSlug, branchSlug, planId, idempotencyKey } = command;
    const { payload } = await http.post<TreatmentPlanAcceptanceReceipt>(
      `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/treatment-plans/${encodeURIComponent(planId)}/accept`,
      {},
      { idempotencyKey },
    );
    return payload;
  },
};
