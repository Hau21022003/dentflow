import { Navigate, useParams } from "react-router-dom";
import { PATHS, pathFor } from "./paths";

export function LegacyBranchStaffRedirect() {
  const { branchSlug, tenantSlug } = useParams();
  return (
    <Navigate
      replace
      to={
        tenantSlug && branchSlug
          ? pathFor.workspaceBranchStaff(tenantSlug, branchSlug)
          : PATHS.forbidden
      }
    />
  );
}
