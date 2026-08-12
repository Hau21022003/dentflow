import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/features/auth/auth.store";
import { PATHS } from "../paths";
import { AuthSessionPending } from "./AuthSessionPending";

export function RedirectIfAuthenticated() {
  const status = useAuthStore((state) => state.status);

  if (status === "unknown") {
    return <AuthSessionPending />;
  }

  if (status === "authenticated") {
    return <Navigate replace to={PATHS.patients} />;
  }

  return <Outlet />;
}
