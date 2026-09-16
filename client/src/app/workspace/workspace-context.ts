import {
  findTenantAuthorization,
  hasBranchAccess,
  hasTenantPermission,
} from "@/features/auth/authorization";
import {
  PERMISSIONS,
  type AuthUser,
  type TenantAuthorization,
} from "@/features/auth/auth.types";
import type { WorkspaceBranchOption } from "./workspace-branch-options";
import type { WorkspacePreference } from "./workspace-preference.store";

export type WorkspaceSelection = {
  branchSlug: string | null;
  tenantSlug: string;
};

export type NavigationWorkspaceContext = WorkspaceSelection & {
  source: "default" | "preference" | "route";
  tenant: TenantAuthorization;
};

/**
 * Chỉ Tenant Admin có trang phạm vi toàn tenant. Hàm này chỉ phục vụ quyết
 * định UI/route; API vẫn phải xác minh tenant context ở phía máy chủ.
 */
export function canUseTenantWorkspaceHome(
  user: AuthUser | null | undefined,
  tenantSlug: string,
): boolean {
  return hasTenantPermission(
    user,
    { slug: tenantSlug },
    PERMISSIONS.tenantSettingsManage,
  );
}

/**
 * Lấy branch ACTIVE đầu tiên đã xuất hiện trong authorization snapshot. Dùng
 * cho người không có scope toàn tenant để luôn đáp xuống một branch trực tiếp
 * được cấp quyền, thay vì suy đoán branch từ URL hay localStorage.
 */
export function getDirectActiveBranchSelection(
  tenant: TenantAuthorization,
): WorkspaceSelection | undefined {
  const branch = tenant.branches.find(({ branch: candidate }) =>
    candidate.status === "ACTIVE",
  );

  return branch
    ? { branchSlug: branch.branch.slug, tenantSlug: tenant.tenant.slug }
    : undefined;
}

/**
 * Xác định điểm vào ổn định khi không có route/preference: duyệt theo thứ tự
 * tenant từ backend, ưu tiên trang tenant nếu được phép, rồi branch ACTIVE
 * được gán trực tiếp.
 */
export function getDefaultWorkspaceSelection(
  user: AuthUser | null | undefined,
): WorkspaceSelection | undefined {
  for (const tenant of user?.authorization.tenants ?? []) {
    if (canUseTenantWorkspaceHome(user, tenant.tenant.slug)) {
      return { branchSlug: null, tenantSlug: tenant.tenant.slug };
    }

    const branchSelection = getDirectActiveBranchSelection(tenant);
    if (branchSelection) {
      return branchSelection;
    }
  }

  return undefined;
}

/**
 * Tạo điểm vào của một tenant cụ thể. Không đọc preference toàn cục ở đây để
 * việc đổi tenant không vô tình đưa người dùng sang branch của tenant khác.
 */
export function getTenantWorkspaceLandingSelection(
  user: AuthUser | null | undefined,
  tenantSlug: string,
): WorkspaceSelection | undefined {
  const tenant = findTenantAuthorization(user, { slug: tenantSlug });
  if (!tenant) {
    return undefined;
  }

  if (canUseTenantWorkspaceHome(user, tenantSlug)) {
    return { branchSlug: null, tenantSlug };
  }

  return getDirectActiveBranchSelection(tenant);
}

/**
 * Preference từ localStorage phải gắn với đúng user và đúng phiên bản schema.
 * Điều kiện này ngăn lựa chọn còn sót lại của tài khoản trước được tái dùng.
 */
export function isPreferenceOwnedByUser(
  preference: WorkspacePreference | null,
  user: AuthUser | null | undefined,
): preference is WorkspacePreference {
  return preference?.version === 1 && preference.userId === user?.id;
}

/** Chỉ branch ACTIVE có mặt trong danh sách đã được xác minh mới được chọn. */
export function isActiveBranchOption(
  branchOptions: readonly WorkspaceBranchOption[],
  branchSlug: string,
): boolean {
  return branchOptions.some((branch) => branch.slug === branchSlug);
}

/**
 * Kiểm tra lại toàn bộ gợi ý workspace trước khi dùng: tenant phải thuộc
 * authorization snapshot, tenant scope cần đúng permission, còn branch scope
 * vừa cần quyền vừa cần trạng thái ACTIVE. Preference không bao giờ là nguồn
 * cấp quyền.
 */
export function isSelectionAccessible(
  user: AuthUser | null | undefined,
  selection: WorkspaceSelection,
  branchOptions: readonly WorkspaceBranchOption[],
): boolean {
  const tenant = findTenantAuthorization(user, { slug: selection.tenantSlug });
  if (!tenant) {
    return false;
  }

  if (!selection.branchSlug) {
    return canUseTenantWorkspaceHome(user, selection.tenantSlug);
  }

  return (
    hasBranchAccess(user, { slug: selection.tenantSlug }, selection.branchSlug) &&
    isActiveBranchOption(branchOptions, selection.branchSlug)
  );
}
