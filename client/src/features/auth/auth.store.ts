import { create } from "zustand";
import type { AuthStatus, AuthUser } from "./auth.types";

type AuthStore = {
  status: AuthStatus;
  user: AuthUser | null;
  setAuthenticatedUser: (user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: "unknown",
  user: null,
  setAuthenticatedUser: (user) => {
    set({ status: "authenticated", user });
  },
  clearSession: () => {
    set({ status: "unauthenticated", user: null });
  },
}));
