import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { serviceQueryKeys } from "../services/services.hooks";
import { serviceGroupsService } from "./service-groups.service";
import type { ServiceGroupListQuery } from "./service-groups.types";

export const serviceGroupQueryKeys = {
  all: ["service-groups"] as const,
  tenant: (tenantSlug: string) =>
    [...serviceGroupQueryKeys.all, "tenant", tenantSlug] as const,
  list: (tenantSlug: string, query: ServiceGroupListQuery) =>
    [...serviceGroupQueryKeys.tenant(tenantSlug), "list", query] as const,
};

export function useTenantServiceGroupsQuery(
  tenantSlug: string,
  query: ServiceGroupListQuery,
) {
  return useQuery({
    queryKey: serviceGroupQueryKeys.list(tenantSlug, query),
    queryFn: () => serviceGroupsService.list(tenantSlug, query),
    enabled: Boolean(tenantSlug),
    placeholderData: keepPreviousData,
  });
}

function useServiceGroupMutation<
  TVariables extends { tenantSlug: string },
  TResult,
>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async (_result, command) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: serviceGroupQueryKeys.tenant(command.tenantSlug),
        }),
        queryClient.invalidateQueries({
          queryKey: serviceQueryKeys.tenant(command.tenantSlug),
        }),
      ]);
    },
  });
}

export function useCreateServiceGroupMutation() {
  return useServiceGroupMutation(serviceGroupsService.create);
}
export function useUpdateServiceGroupMutation() {
  return useServiceGroupMutation(serviceGroupsService.update);
}
export function useDeactivateServiceGroupMutation() {
  return useServiceGroupMutation(serviceGroupsService.deactivate);
}
export function useActivateServiceGroupMutation() {
  return useServiceGroupMutation(serviceGroupsService.activate);
}
