import http from "@/shared/lib/http";
import type {
  PlatformTenantListQuery,
  PlatformTenantPage,
} from "./tenants.types";

export const tenantsService = {
  async list(query: PlatformTenantListQuery): Promise<PlatformTenantPage> {
    const { payload } = await http.get<PlatformTenantPage>(
      "/platform/tenants",
      {
        params: query,
      },
    );

    return payload;
  },
};
