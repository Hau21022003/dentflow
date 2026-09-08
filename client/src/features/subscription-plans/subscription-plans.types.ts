export type SubscriptionPlanBillingInterval = "MONTHLY" | "YEARLY";

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billingInterval: SubscriptionPlanBillingInterval;
  amount: number;
  currency: string;
  providerPlanId: string | null;
  trialDays: number | null;
  entitlements: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateSubscriptionPlanInput = {
  code: string;
  name: string;
  description: string | null;
  billingInterval: SubscriptionPlanBillingInterval;
  amount: number;
  currency: string;
  providerPlanId: string | null;
  trialDays: number | null;
  entitlements: Record<string, unknown>;
};

export type UpdateSubscriptionPlanInput = Partial<
  Omit<CreateSubscriptionPlanInput, "code">
> & {
  isActive?: boolean;
  reason?: string;
};
