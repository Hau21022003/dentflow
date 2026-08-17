import { hasPlatformPermission } from "@/features/auth/authorization";
import { PERMISSIONS, type AuthUser } from "@/features/auth/auth.types";
import { PATHS } from "./paths";
import { pathFor } from "./paths";

type RedirectLocation = {
  hash?: unknown;
  pathname?: unknown;
  search?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolveDefaultAuthenticatedPath(
  user: AuthUser | null | undefined,
): string {
  if (hasPlatformPermission(user, PERMISSIONS.platformSystemRead)) {
    return PATHS.platform;
  }

  const tenant = user?.authorization.tenants[0];
  if (!tenant) {
    return PATHS.forbidden;
  }

  return pathFor.workspace(tenant.tenant.slug);
}

export function resolvePostLoginPath(
  state: unknown,
  user: AuthUser | null | undefined,
): string {
  if (!isRecord(state) || !isRecord(state.from)) {
    return resolveDefaultAuthenticatedPath(user);
  }

  const from = state.from as RedirectLocation;
  const { pathname } = from;

  if (
    typeof pathname !== "string" ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname === PATHS.login
  ) {
    return resolveDefaultAuthenticatedPath(user);
  }

  const search =
    typeof from.search === "string" && from.search.startsWith("?")
      ? from.search
      : "";
  const hash =
    typeof from.hash === "string" && from.hash.startsWith("#")
      ? from.hash
      : "";

  return `${pathname}${search}${hash}`;
}
