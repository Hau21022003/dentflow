import { Outlet, useParams } from "react-router-dom";
import { ForbiddenPage } from "./ForbiddenPage";
import { hasTenantAccess } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";

export function RequireTenantAccess() {
  const user = useAuthStore((state) => state.user);
  const { tenantSlug } = useParams();

  return tenantSlug && hasTenantAccess(user, { slug: tenantSlug }) ? (
    <Outlet />
  ) : (
    <ForbiddenPage />
  );
}
