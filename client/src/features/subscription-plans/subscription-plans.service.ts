import http from "@/shared/lib/http";
import type {
  CreateSubscriptionPlanInput,
  SubscriptionPlan,
  UpdateSubscriptionPlanInput,
} from "./subscription-plans.types";

export type CreateSubscriptionPlanCommand = {
  input: CreateSubscriptionPlanInput;
  idempotencyKey: string;
};

export type UpdateSubscriptionPlanCommand = {
  planId: string;
  input: UpdateSubscriptionPlanInput;
  idempotencyKey: string;
};

export const subscriptionPlansService = {
  async list(): Promise<SubscriptionPlan[]> {
    const { payload } = await http.get<SubscriptionPlan[]>("/platform/plans");

    return payload;
  },

  async create({
    input,
    idempotencyKey,
  }: CreateSubscriptionPlanCommand): Promise<SubscriptionPlan> {
    const { payload } = await http.post<SubscriptionPlan>(
      "/platform/plans",
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );

    return payload;
  },

  async update({
    planId,
    input,
    idempotencyKey,
  }: UpdateSubscriptionPlanCommand): Promise<SubscriptionPlan> {
    const { payload } = await http.patch<SubscriptionPlan>(
      `/platform/plans/${encodeURIComponent(planId)}`,
      input,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );

    return payload;
  },
};
