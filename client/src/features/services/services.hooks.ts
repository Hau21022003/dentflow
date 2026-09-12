import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { servicesService } from "./services.service";
import type { ServiceListQuery } from "./services.types";

export const serviceQueryKeys = {
  all: ["services"] as const,
  tenant: (tenantSlug: string) =>
    [...serviceQueryKeys.all, "tenant", tenantSlug] as const,
  list: (tenantSlug: string, query: ServiceListQuery) =>
    [...serviceQueryKeys.tenant(tenantSlug), "list", query] as const,
};

export function useTenantServicesQuery(
  tenantSlug: string,
  query: ServiceListQuery,
) {
  return useQuery({
    queryKey: serviceQueryKeys.list(tenantSlug, query),
    queryFn: () => servicesService.list(tenantSlug, query),
    enabled: Boolean(tenantSlug),
    placeholderData: keepPreviousData,
  });
}

function useServiceMutation<TVariables extends { tenantSlug: string }, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async (_result, command) => {
      await queryClient.invalidateQueries({
        queryKey: serviceQueryKeys.tenant(command.tenantSlug),
      });
    },
  });
}

export function useCreateServiceMutation() {
  return useServiceMutation(servicesService.create);
}

export function useUpdateServiceMutation() {
  return useServiceMutation(servicesService.update);
}

export function useDeactivateServiceMutation() {
  return useServiceMutation(servicesService.deactivate);
}

export function useActivateServiceMutation() {
  return useServiceMutation(servicesService.activate);
}
