import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { branchesService } from "./branches.service";
import type { BranchListQuery } from "./branches.types";

export const branchQueryKeys = {
  all: ["branches"] as const,
  tenant: (tenantSlug: string) =>
    [...branchQueryKeys.all, "tenant", tenantSlug] as const,
  list: (tenantSlug: string, query: BranchListQuery) =>
    [...branchQueryKeys.tenant(tenantSlug), "list", query] as const,
};

export function useTenantBranchesQuery(
  tenantSlug: string,
  query: BranchListQuery,
) {
  return useQuery({
    queryKey: branchQueryKeys.list(tenantSlug, query),
    queryFn: () => branchesService.list(tenantSlug, query),
    enabled: Boolean(tenantSlug),
    placeholderData: keepPreviousData,
  });
}

function useBranchMutation<TVariables extends { tenantSlug: string }, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async (_result, command) => {
      await queryClient.invalidateQueries({
        queryKey: branchQueryKeys.tenant(command.tenantSlug),
      });
    },
  });
}

export function useCreateBranchMutation() {
  return useBranchMutation(branchesService.create);
}

export function useUpdateBranchMutation() {
  return useBranchMutation(branchesService.update);
}

export function useDeactivateBranchMutation() {
  return useBranchMutation(branchesService.deactivate);
}

export function useActivateBranchMutation() {
  return useBranchMutation(branchesService.activate);
}
