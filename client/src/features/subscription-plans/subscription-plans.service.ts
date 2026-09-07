import http from "@/shared/lib/http";
import type { IdempotentCommand } from "@/shared/lib/idempotency";
import type {
  CreateSubscriptionPlanInput,
  SubscriptionPlan,
  UpdateSubscriptionPlanInput,
} from "./subscription-plans.types";

export type CreateSubscriptionPlanCommand = IdempotentCommand & {
  input: CreateSubscriptionPlanInput;
};

export type UpdateSubscriptionPlanCommand = IdempotentCommand & {
  planId: string;
  input: UpdateSubscriptionPlanInput;
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
      { idempotencyKey },
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
      { idempotencyKey },
    );

    return payload;
  },
};
