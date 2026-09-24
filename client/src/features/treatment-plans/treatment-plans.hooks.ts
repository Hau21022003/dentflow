import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { treatmentPlansService, type TreatmentPlanScope } from "./treatment-plans.service";
import type { TreatmentPlan } from "./treatment-plans.types";

export const treatmentPlanQueryKeys = {
  all: ["treatment-plans"] as const,
  branch: (tenantSlug: string, branchSlug: string) => [...treatmentPlanQueryKeys.all, "branch", tenantSlug, branchSlug] as const,
  list: (scope: TreatmentPlanScope) => [...treatmentPlanQueryKeys.branch(scope.tenantSlug, scope.branchSlug), "visit", scope.visitId, "list"] as const,
  detail: (scope: TreatmentPlanScope, planId: string) => [...treatmentPlanQueryKeys.list(scope), "detail", planId] as const,
  events: (scope: TreatmentPlanScope, planId: string, itemId: string) => [...treatmentPlanQueryKeys.detail(scope, planId), "item", itemId, "events"] as const,
};

export function useTreatmentPlansQuery(scope: TreatmentPlanScope, enabled = true) {
  return useQuery({
    queryKey: treatmentPlanQueryKeys.list(scope),
    queryFn: () => treatmentPlansService.list(scope),
    enabled: Boolean(scope.tenantSlug && scope.branchSlug && scope.visitId && enabled),
  });
}

export function useTreatmentPlanQuery(scope: TreatmentPlanScope, planId: string | null, enabled = true) {
  return useQuery({
    queryKey: treatmentPlanQueryKeys.detail(scope, planId ?? ""),
    queryFn: () => treatmentPlansService.get(scope, planId!),
    enabled: Boolean(scope.tenantSlug && scope.branchSlug && scope.visitId && planId && enabled),
  });
}

export function useTreatmentItemEventsQuery(scope: TreatmentPlanScope, planId: string | null, itemId: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: treatmentPlanQueryKeys.events(scope, planId ?? "", itemId ?? ""),
    queryFn: ({ pageParam }) => treatmentPlansService.listEvents({ ...scope, planId: planId!, itemId: itemId!, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(scope.tenantSlug && scope.branchSlug && scope.visitId && planId && itemId && enabled),
  });
}

function usePlanMutation<TVariables, TResult extends TreatmentPlan>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async (plan, command) => {
      const scope = command as Partial<TreatmentPlanScope>;
      if (!scope.tenantSlug || !scope.branchSlug || !scope.visitId) return;
      const resolvedScope = scope as TreatmentPlanScope;
      queryClient.setQueryData(treatmentPlanQueryKeys.detail(resolvedScope, plan.id), plan);
      await queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.list(resolvedScope) });
    },
  });
}

export const useCreateTreatmentPlanMutation = () => usePlanMutation(treatmentPlansService.create);
export const useSyncTreatmentPlanMutation = () => usePlanMutation(treatmentPlansService.sync);
export const useProposeTreatmentPlanMutation = () => usePlanMutation(treatmentPlansService.propose);
export const useReopenTreatmentPlanMutation = () => usePlanMutation(treatmentPlansService.reopen);
export const useCancelTreatmentPlanMutation = () => usePlanMutation(treatmentPlansService.cancel);

export function useRecordTreatmentItemEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: treatmentPlansService.recordEvent,
    onSuccess: async (_result, command) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.list(command) }),
        queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.detail(command, command.planId) }),
        queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.events(command, command.planId, command.itemId) }),
      ]);
    },
  });
}
