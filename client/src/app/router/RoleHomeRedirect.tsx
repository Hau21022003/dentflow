import { Navigate } from "react-router-dom";
import { resolveDefaultAuthenticatedPath } from "./auth-redirect";
import { useAuthStore } from "@/features/auth/auth.store";

export function RoleHomeRedirect() {
  const user = useAuthStore((state) => state.user);

  return <Navigate replace to={resolveDefaultAuthenticatedPath(user)} />;
}
