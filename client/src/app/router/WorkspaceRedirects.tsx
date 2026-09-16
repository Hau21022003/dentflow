import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "@/features/auth/auth.store";
import { useNavigationWorkspaceContext } from "../workspace/use-navigation-workspace-context";
import {
  getTenantWorkspaceLandingSelection,
  type WorkspaceSelection,
} from "../workspace/workspace-context";
import { AuthSessionPending } from "./guards/AuthSessionPending";
import { ForbiddenPage } from "./guards/ForbiddenPage";
import { pathFor } from "./paths";

/** Chuẩn hóa selection đã xác minh thành URL workspace nội bộ. */
function pathForWorkspaceSelection(selection: WorkspaceSelection): string {
  return selection.branchSlug
    ? pathFor.workspaceBranch(selection.tenantSlug, selection.branchSlug)
    : pathFor.workspaceTenantHome(selection.tenantSlug);
}

/**
 * Điều hướng /workspace theo context đã resolve, có thể chờ revalidate branch
 * preference trước để không redirect chớp nhoáng vào branch đã bị vô hiệu hóa.
 */
export function WorkspaceRootRedirect() {
  const { context, isResolvingPreference } = useNavigationWorkspaceContext();

  if (isResolvingPreference) {
    return <AuthSessionPending />;
  }

  return context ? (
    <Navigate replace to={pathForWorkspaceSelection(context)} />
  ) : (
    <ForbiddenPage />
  );
}

/**
 * Điều hướng /workspace/:tenantSlug chỉ trong tenant trên URL. Không dùng
 * preference toàn cục để đường dẫn tenant cụ thể luôn có kết quả xác định.
 */
export function WorkspaceTenantRedirect() {
  const user = useAuthStore((state) => state.user);
  const { tenantSlug } = useParams();
  const selection = tenantSlug
    ? getTenantWorkspaceLandingSelection(user, tenantSlug)
    : undefined;

  return selection ? (
    <Navigate replace to={pathForWorkspaceSelection(selection)} />
  ) : (
    <ForbiddenPage />
  );
}
