import { SHARED_ENDPOINTS } from "../../shared/constants/endpoint.constants";
import http from "../../shared/lib/http";
import type {
  AcceptTenantOwnerInvitationInput,
  AcceptTenantOwnerInvitationResponse,
  AuthResponse,
  AuthUser,
  LoginInput,
  UpdateMyProfileInput,
  UserProfile,
} from "./auth.types";

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

  async updateMyProfile(input: UpdateMyProfileInput): Promise<UserProfile> {
    const { payload } = await http.patch<UserProfile>("/users/me", input);
    return payload;
  },

  async acceptTenantOwnerInvitation(
    input: AcceptTenantOwnerInvitationInput,
  ): Promise<AcceptTenantOwnerInvitationResponse> {
    const { payload } = await http.post<AcceptTenantOwnerInvitationResponse>(
      SHARED_ENDPOINTS.AUTH.TENANT_OWNER_INVITATIONS_ACCEPT,
      input,
      { authRequired: false },
    );
    return payload;
  },
};
