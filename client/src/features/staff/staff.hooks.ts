import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { branchesService } from "@/features/branches/branches.service";
import type { Branch } from "@/features/branches/branches.types";
import { staffService } from "./staff.service";
import type { StaffListQuery } from "./staff.types";

export const staffQueryKeys = {
  all: ["staff"] as const,
  tenant: (tenantSlug: string) =>
    [...staffQueryKeys.all, "tenant", tenantSlug] as const,
  list: (tenantSlug: string, query: StaffListQuery) =>
    [...staffQueryKeys.tenant(tenantSlug), "list", query] as const,
  branches: (tenantSlug: string) =>
    [...staffQueryKeys.tenant(tenantSlug), "branches"] as const,
};

export function useTenantStaffQuery(
  tenantSlug: string,
  query: StaffListQuery,
) {
  return useQuery({
    queryKey: staffQueryKeys.list(tenantSlug, query),
    queryFn: () => staffService.list(tenantSlug, query),
    enabled: Boolean(tenantSlug),
    placeholderData: keepPreviousData,
  });
}

/** Loads every branch so existing inactive scopes can still be named. */
export function useTenantStaffBranchesQuery(tenantSlug: string) {
  return useQuery({
    queryKey: staffQueryKeys.branches(tenantSlug),
    enabled: Boolean(tenantSlug),
    queryFn: async (): Promise<Branch[]> => {
      const items: Branch[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const response = await branchesService.list(tenantSlug, {
          page,
          limit: 100,
          sortBy: "name",
          sortOrder: "ASC",
        });
        items.push(...response.items);
        totalPages = response.meta.totalPages;
        page += 1;
      }

      return items;
    },
  });
}

function useStaffMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSuccess: async (_result, command) => {
      const tenantSlug = (command as { tenantSlug?: string }).tenantSlug;
      if (tenantSlug) {
        await queryClient.invalidateQueries({
          queryKey: staffQueryKeys.tenant(tenantSlug),
        });
      }
    },
  });
}

export function useCreateStaffInvitationMutation() {
  return useStaffMutation(staffService.createInvitation);
}

export function useResendStaffInvitationMutation() {
  return useStaffMutation(staffService.resendInvitation);
}

export function useRevokeStaffInvitationMutation() {
  return useStaffMutation(staffService.revokeInvitation);
}

export function useDisableStaffMutation() {
  return useStaffMutation(staffService.disable);
}

export function useEnableStaffMutation() {
  return useStaffMutation(staffService.enable);
}

export function useGrantStaffRolesMutation() {
  return useStaffMutation(staffService.grantRoles);
}

export function useRevokeStaffRoleMutation() {
  return useStaffMutation(staffService.revokeRole);
}

export function useAcceptStaffInvitationMutation() {
  return useMutation({ mutationFn: staffService.acceptInvitation });
}
