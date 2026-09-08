import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { tenantsService } from "./tenants.service";
import type { PlatformTenantListQuery } from "./tenants.types";

export const tenantQueryKeys = {
  all: ["platform-tenants"] as const,
  list: (query: PlatformTenantListQuery) =>
    [...tenantQueryKeys.all, "list", query] as const,
};

export function usePlatformTenantsQuery(query: PlatformTenantListQuery) {
  return useQuery({
    queryKey: tenantQueryKeys.list(query),
    queryFn: () => tenantsService.list(query),
    placeholderData: keepPreviousData,
  });
}
