import { useQuery } from "@tanstack/react-query";
import {
  findTenantAuthorization,
  hasTenantPermission,
} from "@/features/auth/authorization";
import { PERMISSIONS, type AuthUser } from "@/features/auth/auth.types";
import { branchQueryKeys } from "@/features/branches/branches.hooks";
import { branchesService } from "@/features/branches/branches.service";

export type WorkspaceBranchOption = {
  name: string;
  slug: string;
};

/**
 * Đọc đầy đủ branch ACTIVE của tenant cho người có quyền quản lý toàn tenant.
 * API phân trang nên sau trang đầu hàm tải các trang còn lại song song; danh
 * sách đầy đủ là cần thiết để không loại nhầm branch hợp lệ khỏi bộ chọn.
 */
async function listAllActiveTenantBranches(
  tenantSlug: string,
): Promise<WorkspaceBranchOption[]> {
  const firstPage = await branchesService.list(tenantSlug, {
    limit: 100,
    page: 1,
    sortBy: "name",
    sortOrder: "ASC",
    status: "ACTIVE",
  });
  const remainingPages = await Promise.all(
    Array.from(
      { length: Math.max(0, firstPage.meta.totalPages - 1) },
      (_, index) =>
        branchesService.list(tenantSlug, {
          limit: 100,
          page: index + 2,
          sortBy: "name",
          sortOrder: "ASC",
          status: "ACTIVE",
        }),
    ),
  );

  return [firstPage, ...remainingPages]
    .flatMap((page) => page.items)
    .map((branch) => ({ name: branch.name, slug: branch.slug }));
}

/**
 * Cấp nguồn branch cho điều hướng theo scope đã xác minh: Tenant Admin lấy
 * danh sách ACTIVE từ API, các role branch-scoped chỉ dùng các grant đã có
 * trong authorization snapshot. Không nhận tenant/branch từ input người dùng
 * để mở rộng scope.
 */
export function useWorkspaceBranchOptions(
  user: AuthUser | null | undefined,
  tenantSlug: string | undefined,
) {
  const tenant = tenantSlug
    ? findTenantAuthorization(user, { slug: tenantSlug })
    : undefined;
  const canListAllTenantBranches = Boolean(
    tenantSlug &&
      hasTenantPermission(
        user,
        { slug: tenantSlug },
        PERMISSIONS.branchManage,
      ),
  );
  const branchQuery = useQuery({
    queryKey: tenantSlug
      ? [...branchQueryKeys.tenant(tenantSlug), "workspace-options"]
      : [...branchQueryKeys.all, "workspace-options"],
    queryFn: () => listAllActiveTenantBranches(tenantSlug ?? ""),
    enabled: Boolean(tenantSlug && canListAllTenantBranches),
  });
  const directBranchOptions = (tenant?.branches ?? [])
    .filter(({ branch }) => branch.status === "ACTIVE")
    .map(({ branch }) => ({ name: branch.name, slug: branch.slug }));

  return {
    branchOptions: canListAllTenantBranches
      ? branchQuery.data ?? []
      : directBranchOptions,
    isLoading: canListAllTenantBranches && branchQuery.isPending,
  };
}
