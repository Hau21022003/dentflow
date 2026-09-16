import { Outlet, useParams } from "react-router-dom";
import { ForbiddenPage } from "./ForbiddenPage";
import { hasBranchAccess } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";
import { useWorkspaceBranchOptions } from "../../workspace/workspace-branch-options";
import { AuthSessionPending } from "./AuthSessionPending";

/**
 * Chặn route branch khi quyền snapshot không cho phép hoặc branch đã inactive.
 * Tenant Admin phải chờ danh sách ACTIVE từ API; role branch-scoped dùng grant
 * trong snapshot. Đây là guard giao diện, backend vẫn là nơi thực thi scope.
 */
export function RequireBranchAccess() {
  const user = useAuthStore((state) => state.user);
  const { branchSlug, tenantSlug } = useParams();
  const { branchOptions, isLoading } = useWorkspaceBranchOptions(user, tenantSlug);

  if (
    !branchSlug ||
    !tenantSlug ||
    !hasBranchAccess(user, { slug: tenantSlug }, branchSlug)
  ) {
    return <ForbiddenPage />;
  }

  if (isLoading) {
    return <AuthSessionPending />;
  }

  return branchOptions.some((branch) => branch.slug === branchSlug) ? (
    <Outlet />
  ) : (
    <ForbiddenPage />
  );
}
