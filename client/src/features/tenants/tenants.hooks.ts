import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { tenantsService } from "./tenants.service";
import type { PlatformTenantListQuery } from "./tenants.types";

export const tenantQueryKeys = {
  all: ["platform-tenants"] as const,
  list: (query: PlatformTenantListQuery) =>
    [...tenantQueryKeys.all, "list", query] as const,
  detail: (tenantId: string) =>
    [...tenantQueryKeys.all, "detail", tenantId] as const,
};

export function usePlatformTenantsQuery(query: PlatformTenantListQuery) {
  return useQuery({
    queryKey: tenantQueryKeys.list(query),
    queryFn: () => tenantsService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformTenantQuery(tenantId: string) {
  return useQuery({
    queryKey: tenantQueryKeys.detail(tenantId),
    queryFn: () => tenantsService.get(tenantId),
    enabled: Boolean(tenantId),
  });
}

function useTenantMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
    },
  });
}

export function useCreatePlatformTenantMutation() {
  return useTenantMutation(tenantsService.create);
}

export function useUpdatePlatformTenantMutation() {
  return useTenantMutation(tenantsService.update);
}

export function useResendTenantOwnerInviteMutation() {
  return useTenantMutation(tenantsService.resendOwnerInvite);
}

export function useExtendTenantTrialMutation() {
  return useTenantMutation(tenantsService.extendTrial);
}

export function useSuspendTenantMutation() {
  return useTenantMutation(tenantsService.suspend);
}

export function useReactivateTenantMutation() {
  return useTenantMutation(tenantsService.reactivate);
}
