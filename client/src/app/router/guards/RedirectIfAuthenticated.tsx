import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/features/auth/auth.store";
import { resolveDefaultAuthenticatedPath } from "../auth-redirect";
import { AuthSessionPending } from "./AuthSessionPending";

export function RedirectIfAuthenticated() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === "unknown") {
    return <AuthSessionPending />;
  }

  if (status === "authenticated") {
    return <Navigate replace to={resolveDefaultAuthenticatedPath(user)} />;
  }

  return <Outlet />;
}
