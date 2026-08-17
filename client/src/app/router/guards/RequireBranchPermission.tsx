import { Outlet, useParams } from "react-router-dom";
import { ForbiddenPage } from "./ForbiddenPage";
import { hasBranchAccess, hasBranchPermission } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";
import type { Permission } from "@/features/auth/auth.types";

type RequireBranchPermissionProps = {
  permission: Permission;
};

export function RequireBranchPermission({ permission }: RequireBranchPermissionProps) {
  const user = useAuthStore((state) => state.user);
  const { branchSlug, tenantSlug } = useParams();

  return branchSlug &&
    tenantSlug &&
    hasBranchAccess(user, { slug: tenantSlug }, branchSlug) &&
    hasBranchPermission(user, { slug: tenantSlug }, branchSlug, permission) ? (
    <Outlet />
  ) : (
    <ForbiddenPage />
  );
}
