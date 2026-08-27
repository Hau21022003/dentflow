import { Outlet } from "react-router-dom";
import { ForbiddenPage } from "./ForbiddenPage";
import { hasPlatformPermission } from "@/features/auth/authorization";
import { useAuthStore } from "@/features/auth/auth.store";
import type { Permission } from "@/features/auth/auth.types";

type RequirePlatformPermissionProps = {
  permission: Permission;
};

export function RequirePlatformPermission({
  permission,
}: RequirePlatformPermissionProps) {
  const user = useAuthStore((state) => state.user);

  return hasPlatformPermission(user, permission) ? <Outlet /> : <ForbiddenPage />;
}
