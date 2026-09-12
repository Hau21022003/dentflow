export const SHARED_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    ME: "/auth/me",
    REFRESH: "/auth/refresh",
    TENANT_OWNER_INVITATIONS_ACCEPT:
      "/auth/tenant-owner-invitations/accept",
    STAFF_INVITATIONS_ACCEPT: "/auth/staff-invitations/accept",
  },
} as const;
