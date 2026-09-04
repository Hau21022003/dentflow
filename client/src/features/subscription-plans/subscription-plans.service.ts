import http from "@/shared/lib/http";
import type {
  CreateSubscriptionPlanInput,
  SubscriptionPlan,
  UpdateSubscriptionPlanInput,
} from "./subscription-plans.types";

export const subscriptionPlansService = {
  async list(): Promise<SubscriptionPlan[]> {
    const { payload } = await http.get<SubscriptionPlan[]>(
      "/platform/plans",
    );

    return payload;
  },

  async create(input: CreateSubscriptionPlanInput): Promise<SubscriptionPlan> {
    const { payload } = await http.post<SubscriptionPlan>(
      "/platform/plans",
      input,
    );

    return payload;
  },

  async update({
    planId,
    input,
  }: {
    planId: string;
    input: UpdateSubscriptionPlanInput;
  }): Promise<SubscriptionPlan> {
    const { payload } = await http.patch<SubscriptionPlan>(
      `/platform/plans/${encodeURIComponent(planId)}`,
      input,
    );

    return payload;
  },
};
