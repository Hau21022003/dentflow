import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  RecordTreatmentItemEventResponse,
  SyncTreatmentPlanInput,
  TreatmentItemEventPage,
  TreatmentItemEventType,
  TreatmentPlan,
  TreatmentPlanPage,
  TreatmentReasonInput,
} from "./treatment-plans.types";

export type TreatmentPlanScope = {
  tenantSlug: string;
  branchSlug: string;
  visitId: string;
};

function plansRoute({ tenantSlug, branchSlug, visitId }: TreatmentPlanScope) {
  return `/tenants/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/visits/${encodeURIComponent(visitId)}/treatment-plans`;
}

function planRoute(scope: TreatmentPlanScope, planId: string) {
  return `${plansRoute(scope)}/${encodeURIComponent(planId)}`;
}

export const treatmentPlansService = {
  async list(scope: TreatmentPlanScope, page = 1, limit = 100): Promise<TreatmentPlanPage> {
    const { payload } = await http.get<TreatmentPlanPage>(plansRoute(scope), {
      params: { page, limit },
    });
    return payload;
  },
  async get(scope: TreatmentPlanScope, planId: string): Promise<TreatmentPlan> {
    const { payload } = await http.get<TreatmentPlan>(planRoute(scope, planId));
    return payload;
  },
  async create(scope: TreatmentPlanScope & IdempotentCommand): Promise<TreatmentPlan> {
    const { idempotencyKey, ...routeScope } = scope;
    const { payload } = await http.post<TreatmentPlan>(plansRoute(routeScope), {}, { idempotencyKey });
    return payload;
  },
  async sync(command: TreatmentPlanScope & IdempotentCommand & { planId: string; input: SyncTreatmentPlanInput }): Promise<TreatmentPlan> {
    const { planId, input, idempotencyKey, ...scope } = command;
    const { payload } = await http.patch<TreatmentPlan>(planRoute(scope, planId), input, { idempotencyKey });
    return payload;
  },
  async propose(command: TreatmentPlanScope & IdempotentCommand & { planId: string }): Promise<TreatmentPlan> {
    const { planId, idempotencyKey, ...scope } = command;
    const { payload } = await http.post<TreatmentPlan>(`${planRoute(scope, planId)}/propose`, {}, { idempotencyKey });
    return payload;
  },
  async reopen(command: TreatmentPlanScope & IdempotentCommand & { planId: string; input: TreatmentReasonInput }): Promise<TreatmentPlan> {
    const { planId, input, idempotencyKey, ...scope } = command;
    const { payload } = await http.post<TreatmentPlan>(`${planRoute(scope, planId)}/reopen`, input, { idempotencyKey });
    return payload;
  },
  async cancel(command: TreatmentPlanScope & IdempotentCommand & { planId: string; input: TreatmentReasonInput }): Promise<TreatmentPlan> {
    const { planId, input, idempotencyKey, ...scope } = command;
    const { payload } = await http.post<TreatmentPlan>(`${planRoute(scope, planId)}/cancel`, input, { idempotencyKey });
    return payload;
  },
  async listEvents(scope: TreatmentPlanScope & { planId: string; itemId: string; cursor?: string | null }): Promise<TreatmentItemEventPage> {
    const { planId, itemId, cursor, ...routeScope } = scope;
    const { payload } = await http.get<TreatmentItemEventPage>(
      `${planRoute(routeScope, planId)}/items/${encodeURIComponent(itemId)}/events`,
      { params: cursor ? { cursor } : undefined },
    );
    return payload;
  },
  async recordEvent(command: TreatmentPlanScope & IdempotentCommand & { planId: string; itemId: string; input: { eventType: TreatmentItemEventType; reasonCode?: string } }): Promise<RecordTreatmentItemEventResponse> {
    const { planId, itemId, input, idempotencyKey, ...scope } = command;
    const { payload } = await http.post<RecordTreatmentItemEventResponse>(
      `${planRoute(scope, planId)}/items/${encodeURIComponent(itemId)}/events`,
      input,
      { idempotencyKey },
    );
    return payload;
  },
};
