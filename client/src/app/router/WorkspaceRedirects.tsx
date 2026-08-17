import { Navigate, useParams } from "react-router-dom";
import { ForbiddenPage } from "./guards/ForbiddenPage";
import { findTenantAuthorization } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";
import { pathFor } from "./paths";

function resolveWorkspacePath(tenant: NonNullable<ReturnType<typeof findTenantAuthorization>>) {
  const branch = tenant.branches[0];

  return branch
    ? pathFor.workspaceBranch(tenant.tenant.slug, branch.branch.slug)
    : pathFor.workspaceTenantHome(tenant.tenant.slug);
}

export function WorkspaceRootRedirect() {
  const user = useAuthStore((state) => state.user);
  const tenant = user?.authorization.tenants[0];

  return tenant ? <Navigate replace to={resolveWorkspacePath(tenant)} /> : <ForbiddenPage />;
}

export function WorkspaceTenantRedirect() {
  const user = useAuthStore((state) => state.user);
  const { tenantSlug } = useParams();
  const tenant = tenantSlug
    ? findTenantAuthorization(user, { slug: tenantSlug })
    : undefined;

  return tenant ? <Navigate replace to={resolveWorkspacePath(tenant)} /> : <ForbiddenPage />;
}
