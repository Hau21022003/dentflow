import { Outlet, useParams } from "react-router-dom";
import { ForbiddenPage } from "./ForbiddenPage";
import { hasBranchAccess } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";

export function RequireBranchAccess() {
  const user = useAuthStore((state) => state.user);
  const { branchSlug, tenantSlug } = useParams();

  return branchSlug &&
    tenantSlug &&
    hasBranchAccess(user, { slug: tenantSlug }, branchSlug) ? (
    <Outlet />
  ) : (
    <ForbiddenPage />
  );
}
