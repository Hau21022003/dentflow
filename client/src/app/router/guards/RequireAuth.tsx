import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/auth.store";
import { PATHS } from "../paths";
import { AuthSessionPending } from "./AuthSessionPending";

export function RequireAuth() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);

  if (status === "unknown") {
    return <AuthSessionPending />;
  }

  if (status === "unauthenticated") {
    return <Navigate replace state={{ from: location }} to={PATHS.login} />;
  }

  return <Outlet />;
}
