import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { authQueryKeys, useMeQuery } from "../../features/auth/auth.hooks";
import { useAuthStore } from "../../features/auth/auth.store";
import { HTTP_STATUS } from "../../shared/constants/http-status.constants";
import { AUTH_EVENTS } from "../../shared/events/auth.events";
import { ApiError } from "../../shared/lib/error";
import { useWorkspacePreferenceStore } from "../workspace/workspace-preference.store";

/**
 * Đồng bộ phiên xác thực toàn ứng dụng. Khi session không còn hợp lệ, preference
 * workspace cũng bị xóa để tài khoản kế tiếp không thừa hưởng gợi ý cũ.
 */
export function AuthSessionBootstrap() {
  const queryClient = useQueryClient();
  const { data: user, error } = useMeQuery();
  const setAuthenticatedUser = useAuthStore(
    (state) => state.setAuthenticatedUser,
  );
  const clearSession = useAuthStore((state) => state.clearSession);
  const clearWorkspacePreference = useWorkspacePreferenceStore(
    (state) => state.clearPreference,
  );

  useEffect(() => {
    if (user) {
      setAuthenticatedUser(user);
    }
  }, [setAuthenticatedUser, user]);

  useEffect(() => {
    if (error && ApiError.from(error).status === HTTP_STATUS.UNAUTHORIZED) {
      clearWorkspacePreference();
      clearSession();
    }
  }, [clearSession, clearWorkspacePreference, error]);

  useEffect(() => {
    const handleTokenExpired = () => {
      queryClient.removeQueries({ queryKey: authQueryKeys.me() });
      clearWorkspacePreference();
      clearSession();
    };

    window.addEventListener(AUTH_EVENTS.TOKEN_EXPIRED, handleTokenExpired);

    return () => {
      window.removeEventListener(AUTH_EVENTS.TOKEN_EXPIRED, handleTokenExpired);
    };
  }, [clearSession, clearWorkspacePreference, queryClient]);

  return null;
}
