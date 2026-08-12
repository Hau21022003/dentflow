export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

export type AuthResponse = {
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};
