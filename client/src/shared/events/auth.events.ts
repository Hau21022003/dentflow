/**
 * Authentication-related events for cross-component communication
 */

export const AUTH_EVENTS = {
  TOKEN_EXPIRED: "auth:token-expired",
  LOGOUT: "auth:logout",
  REFRESH_SUCCESS: "auth:refresh-success",
};

/**
 * Dispatch custom events for authentication
 */
export const authEvents = {
  /**
   * Fired when access token has expired
   */
  tokenExpired: () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.TOKEN_EXPIRED));
    }
  },
};
