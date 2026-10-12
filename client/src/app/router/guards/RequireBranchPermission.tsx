import { Outlet, useParams } from "react-router-dom";
import { ForbiddenPage } from "./ForbiddenPage";
import { hasBranchAccess, hasBranchPermission } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";
import type { Permission } from "@/features/auth/auth.types";

type RequireBranchPermissionProps = {
  permission: Permission | Permission[];
};

export function RequireBranchPermission({ permission }: RequireBranchPermissionProps) {
  const user = useAuthStore((state) => state.user);
  const { branchSlug, tenantSlug } = useParams();

  const permissions = Array.isArray(permission) ? permission : [permission];
  return branchSlug &&
    tenantSlug &&
    hasBranchAccess(user, { slug: tenantSlug }, branchSlug) &&
    permissions.every((required) =>
      hasBranchPermission(user, { slug: tenantSlug }, branchSlug, required),
    ) ? (
    <Outlet />
  ) : (
    <ForbiddenPage />
  );
}
