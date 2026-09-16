import { Navigate, useParams } from "react-router-dom";
import { PATHS, pathFor } from "./paths";

/** Giữ hoạt động cho URL nhân sự chi nhánh đã được chia sẻ trước khi đổi route. */
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
