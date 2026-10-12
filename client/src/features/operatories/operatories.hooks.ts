import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { operatoriesService } from "./operatories.service";
import type { OperatoryListQuery } from "./operatories.types";

export const operatoryQueryKeys = {
  all: ["operatories"] as const,
  branch: (tenantSlug: string, branchSlug: string) =>
    ["operatories", tenantSlug, branchSlug] as const,
  list: (tenantSlug: string, branchSlug: string, query: OperatoryListQuery) =>
    [...operatoryQueryKeys.branch(tenantSlug, branchSlug), "list", query] as const,
};

export function useOperatoriesQuery(
  tenantSlug: string,
  branchSlug: string,
  query: OperatoryListQuery,
) {
  return useQuery({
    queryKey: operatoryQueryKeys.list(tenantSlug, branchSlug, query),
    queryFn: () => operatoriesService.list({ tenantSlug, branchSlug }, query),
    enabled: Boolean(tenantSlug && branchSlug),
  });
}

function useOperatoryMutation<TVariables extends { tenantSlug: string; branchSlug: string }>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: operatoryQueryKeys.branch(
          variables.tenantSlug,
          variables.branchSlug,
        ),
      });
    },
  });
}

export const useCreateOperatoryMutation = () =>
  useOperatoryMutation(operatoriesService.create);
export const useUpdateOperatoryMutation = () =>
  useOperatoryMutation(operatoriesService.update);
export const useChangeOperatoryActivityMutation = () =>
  useOperatoryMutation(operatoriesService.changeActivity);
