import { useParams } from "react-router-dom";
import {
  findBranchAuthorization,
  findTenantAuthorization,
} from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";

export function useWorkspaceContext() {
  const user = useAuthStore((state) => state.user);
  const { branchSlug = "", tenantSlug = "" } = useParams();
  const tenant = tenantSlug
    ? findTenantAuthorization(user, { slug: tenantSlug })
    : undefined;
  const branch = tenantSlug && branchSlug
    ? findBranchAuthorization(user, { slug: tenantSlug }, branchSlug)
    : undefined;

  return { branch, branchSlug, tenant, tenantSlug, user };
}
