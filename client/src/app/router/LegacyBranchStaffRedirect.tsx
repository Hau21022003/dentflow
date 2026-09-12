import { Navigate, useParams } from "react-router-dom";
import { PATHS, pathFor } from "./paths";

export function LegacyBranchStaffRedirect() {
  const { tenantSlug } = useParams();
  return (
    <Navigate
      replace
      to={tenantSlug ? pathFor.workspaceTenantStaff(tenantSlug) : PATHS.forbidden}
    />
  );
}
