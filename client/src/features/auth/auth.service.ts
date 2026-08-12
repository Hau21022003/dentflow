import { SHARED_ENDPOINTS } from "../../shared/constants/endpoint.constants";
import http from "../../shared/lib/http";
import type { AuthResponse, AuthUser, LoginInput } from "./auth.types";

export const authService = {
  async login(credentials: LoginInput): Promise<AuthUser> {
    const { payload } = await http.post<AuthResponse>(
      SHARED_ENDPOINTS.AUTH.LOGIN,
      credentials,
      { authRequired: false },
    );

    return payload.user;
  },

  async getMe(): Promise<AuthUser> {
    const { payload } = await http.get<AuthResponse>(SHARED_ENDPOINTS.AUTH.ME, {
      authRequired: false,
    });

    return payload.user;
  },

  async logout(): Promise<void> {
    await http.post<void>(SHARED_ENDPOINTS.AUTH.LOGOUT, undefined, {
      authRequired: false,
    });
  },
};
