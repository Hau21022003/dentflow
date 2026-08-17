import { Outlet, useParams } from "react-router-dom";
import { ForbiddenPage } from "./ForbiddenPage";
import { hasTenantPermission } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";
import type { Permission } from "@/features/auth/auth.types";

type RequireTenantPermissionProps = {
  permission: Permission;
};

export function RequireTenantPermission({ permission }: RequireTenantPermissionProps) {
  const user = useAuthStore((state) => state.user);
  const { tenantSlug } = useParams();

  return tenantSlug && hasTenantPermission(user, { slug: tenantSlug }, permission) ? (
    <Outlet />
  ) : (
    <ForbiddenPage />
  );
}
