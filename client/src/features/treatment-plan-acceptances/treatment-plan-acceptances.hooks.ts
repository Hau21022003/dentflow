import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  treatmentPlanAcceptancesService,
  type TreatmentPlanAcceptanceScope,
} from "./treatment-plan-acceptances.service";

export const treatmentPlanAcceptanceQueryKeys = {
  all: ["treatment-plan-acceptances"] as const,
  branch: (tenantSlug: string, branchSlug: string) =>
    [...treatmentPlanAcceptanceQueryKeys.all, tenantSlug, branchSlug] as const,
  list: (scope: TreatmentPlanAcceptanceScope, page: number, limit: number) =>
    [...treatmentPlanAcceptanceQueryKeys.branch(scope.tenantSlug, scope.branchSlug), page, limit] as const,
};

export function useTreatmentPlanAcceptancesQuery(
  scope: TreatmentPlanAcceptanceScope,
  page: number,
  limit: number,
) {
  return useQuery({
    queryKey: treatmentPlanAcceptanceQueryKeys.list(scope, page, limit),
    queryFn: () => treatmentPlanAcceptancesService.list(scope, page, limit),
    enabled: Boolean(scope.tenantSlug && scope.branchSlug),
  });
}

export function useAcceptTreatmentPlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: treatmentPlanAcceptancesService.accept,
    onSuccess: async (_receipt, command) => {
      await queryClient.invalidateQueries({
        queryKey: treatmentPlanAcceptanceQueryKeys.branch(
          command.tenantSlug,
          command.branchSlug,
        ),
      });
    },
  });
}
