import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionPlansService } from "./subscription-plans.service";

export const subscriptionPlanQueryKeys = {
  all: ["subscription-plans"] as const,
  catalog: () => [...subscriptionPlanQueryKeys.all, "catalog"] as const,
};

export function useSubscriptionPlansQuery() {
  return useQuery({
    queryKey: subscriptionPlanQueryKeys.catalog(),
    queryFn: subscriptionPlansService.list,
  });
}

export function useCreateSubscriptionPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscriptionPlansService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: subscriptionPlanQueryKeys.catalog(),
      });
    },
  });
}

export function useUpdateSubscriptionPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscriptionPlansService.update,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: subscriptionPlanQueryKeys.catalog(),
      });
    },
  });
}
